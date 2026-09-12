/**
 * functions/_lib/agents/control-agent.js — GRAVITY ARS STEP 1
 * ---------------------------------------------------------
 * The Control Agent's Step 1 responsibilities, kept deliberately small:
 *   1. reconcileRegistry() — make sure all 13 agents exist in D1 and
 *      their identity/capabilities are current (idempotent, safe to call
 *      on every status request).
 *   2. detectStale() — flag agents that claimed a task and went quiet
 *      (WORKING with no activity for a while) as a system-health signal.
 *
 * What it does NOT do yet (Step 2+): decide what task to run next based
 * on business logic, call any AI provider, or perform any revenue action.
 * That's the "entire revenue engine" the spec explicitly says Step 1
 * should not build.
 */

import { AGENT_REGISTRY } from './registry.js';
import { getCapabilities } from './capabilities.js';
import { registerAgent, listAgents, createTask, updateAgentStatus, completeTask, failTask, writeLog, readMemory, writeMemory } from './db.js';
import { executeRevenueReport } from './handlers/revenue-agent.js';
import { executeTrafficReport } from './handlers/traffic-agent.js';

export async function reconcileRegistry(env) {
  for (const identity of AGENT_REGISTRY) {
    await registerAgent(env, {
      id: identity.id,
      name: identity.name,
      role: identity.role,
      capabilities: getCapabilities(identity.id)
    });
  }
  return await listAgents(env);
}

const STALE_WORKING_MINUTES = 30;

// An agent that's been WORKING for longer than this without a fresh
// last_activity_at is presented to the Admin as an alert (system.
// staleAgents) — Step 1 only surfaces this; automatic recovery/retry of
// the underlying task is future work (see spec's "escalate only when the
// system cannot recover automatically").
export function detectStale(agents) {
  const cutoff = Date.now() - STALE_WORKING_MINUTES * 60 * 1000;
  return agents.filter(a => {
    if (a.status !== 'WORKING') return false;
    const last = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
    return last < cutoff;
  });
}

const AGENT_HANDLERS = {
  revenue: { execute: executeRevenueReport, taskMessageType: 'revenue_report' },
  traffic: { execute: executeTrafficReport, taskMessageType: 'traffic_report' }
};

export const IMPLEMENTED_AGENT_IDS = Object.keys(AGENT_HANDLERS);

// The system's first real autonomous execution path (Step 2, slice 1).
// Runs one agent's real handler once, end-to-end: creates a task on the
// shared bus, marks the agent WORKING, executes the handler, then marks
// SUCCESS/FAILED and completes/fails the task. Agents with no implemented
// handler yet fail clearly instead of silently doing nothing (per the
// spec's "never pretend to have done something" rule).
export async function runAgentOnce(env, agentId, { messageType } = {}) {
  const handlerEntry = AGENT_HANDLERS[agentId];
  const task = await createTask(env, {
    senderAgent: 'control',
    receiverAgent: agentId,
    messageType: messageType || handlerEntry?.taskMessageType || 'run',
    payload: {}
  });

  if (!handlerEntry) {
    const msg = `Agent "${agentId}" ยังไม่มี handler ที่ implement จริง (ยังไม่รองรับการรันอัตโนมัติ)`;
    await updateAgentStatus(env, agentId, { status: 'BLOCKED', lastError: msg });
    await failTask(env, task.id, msg);
    await writeLog(env, agentId, 'error', msg, null, task.id);
    throw new Error(msg);
  }

  await updateAgentStatus(env, agentId, { status: 'WORKING', currentTaskId: task.id });
  await writeLog(env, agentId, 'info', `เริ่มรัน task ${task.id}`, null, task.id);

  try {
    const result = await handlerEntry.execute(env, task);
    await completeTask(env, task.id, result);
    await updateAgentStatus(env, agentId, {
      status: 'SUCCESS', currentTaskId: null, lastResult: result, outcome: 'success'
    });
    await writeLog(env, agentId, 'info', `รัน task ${task.id} สำเร็จ`, null, task.id);
    return { taskId: task.id, result };
  } catch (err) {
    const msg = err.message || String(err);
    await failTask(env, task.id, msg);
    await updateAgentStatus(env, agentId, {
      status: 'FAILED', currentTaskId: null, lastError: msg, outcome: 'failure'
    });
    await writeLog(env, agentId, 'error', `รัน task ${task.id} ล้มเหลว: ${msg}`, null, task.id);
    throw err;
  }
}


// The system's first real decision (Step 2, slice 2). Deliberately narrow:
// it implements exactly the spec's section-5 example ("มี Traffic สูงแต่
// ไม่เกิด Revenue → ระบบต้องหาสาเหตุ ไม่ใช่ประกาศว่าสำเร็จ") using only the
// two reports that actually exist (revenue, traffic). It does NOT yet
// implement the full priority formula in section 6 (revenue impact +
// evidence + urgency + confidence + cost + effort + risk) — that needs
// more implemented agents to have real signal to weigh against each
// other. This is honest about ranking two facts, not eleven.
export async function evaluateSystemPriority(env) {
  const revenue = await readMemory(env, 'revenue_reports', 'latest');
  const traffic = await readMemory(env, 'traffic_reports', 'latest');

  let decision;
  if (!revenue || !traffic) {
    decision = {
      status: 'INSUFFICIENT_DATA',
      reasoning: 'ยังไม่มีรายงาน revenue หรือ traffic ล่าสุดให้เทียบกัน (agent ที่เกี่ยวข้องอาจยังไม่เคยรันสำเร็จ)',
      recommendedNextAction: null
    };
  } else if (traffic.last30d.clickCount > 0 && revenue.last30d.conversionCount === 0) {
    decision = {
      status: 'REVENUE_LEAKAGE',
      reasoning: `มี click ${traffic.last30d.clickCount} ครั้งใน 30 วันล่าสุด แต่ conversion = 0 — ตรงกับกฎ "traffic สูงแต่ไม่เกิด revenue ต้องหาสาเหตุ ไม่ใช่ประกาศว่าสำเร็จ"`,
      recommendedNextAction: 'ต้องมี Conversion Agent วิเคราะห์ funnel/landing/CTA (ยังไม่ implement — นี่คือ agent ที่ควร implement ถัดไป)',
      productsWithClicksNoConversion: traffic.revenueLink.productsWithClicksNoConversion
    };
  } else if (traffic.last30d.clickCount > 0 && revenue.last30d.conversionCount > 0) {
    decision = {
      status: 'CONVERTING',
      reasoning: `มี click ${traffic.last30d.clickCount} ครั้ง และ conversion ${revenue.last30d.conversionCount} ครั้งใน 30 วันล่าสุด — ระบบกำลังทำเงินจริง`,
      recommendedNextAction: 'ตามข้อ 7 ของสเปค: หาว่าอะไรทำให้ product/source ที่ convert ได้ผล แล้ว replicate/scale (ต้องมี Experiment/Growth Agent มา implement ต่อ)'
    };
  } else {
    decision = {
      status: 'NO_TRAFFIC',
      reasoning: 'ไม่มี click เลยใน 30 วันล่าสุด',
      recommendedNextAction: 'ตามข้อ 15: อย่าสร้าง content/traffic เพิ่มโดยไม่มี demand ที่พิสูจน์แล้ว — ควรเริ่มจาก Market/Opportunity Agent ก่อน (ยังไม่ implement)'
    };
  }

  const record = { evaluatedAt: new Date().toISOString(), ...decision };
  await writeMemory(env, 'control_decisions', 'latest', record, 'control');
  return record;
}
