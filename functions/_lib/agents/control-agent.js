import { AGENT_REGISTRY } from './registry.js';
import { getCapabilities } from './capabilities.js';
import { registerAgent, listAgents, createTask, updateAgentStatus, completeTask, failTask, writeLog, readMemory, writeMemory } from './db.js';
import { executeRevenueReport } from './handlers/revenue-agent.js';
import { executeTrafficReport } from './handlers/traffic-agent.js';
import { executeConversionReport } from './handlers/conversion-agent.js';
import { executeExperimentCycle } from './handlers/experiment-agent.js';
import { executeGrowthCycle } from './handlers/growth-agent.js';
import { executeMarketScan } from './handlers/market-agent.js';
import { executeOpportunityReview } from './handlers/opportunity-agent.js';
import { executeAudienceAnalysis } from './handlers/audience-agent.js';
import { executeOfferMatching } from './handlers/offer-agent.js';
import { executeContentGeneration } from './handlers/content-agent.js';
import { executeMediaWorkflow } from './handlers/media-agent.js';
import { executeDistribution } from './handlers/distribution-agent.js';

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

export function detectStale(agents) {
  const cutoff = Date.now() - STALE_WORKING_MINUTES * 60 * 1000;
  return agents.filter(a => {
    if (a.status !== 'WORKING') return false;
    const last = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
    return last < cutoff;
  });
}

const AGENT_HANDLERS = {
  market: { execute: executeMarketScan, taskMessageType: 'market_scan' },
  opportunity: { execute: executeOpportunityReview, taskMessageType: 'opportunity_review' },
  audience: { execute: executeAudienceAnalysis, taskMessageType: 'audience_analysis' },
  offer: { execute: executeOfferMatching, taskMessageType: 'offer_matching' },
  content: { execute: executeContentGeneration, taskMessageType: 'content_generation' },
  media: { execute: executeMediaWorkflow, taskMessageType: 'media_workflow' },
  distribution: { execute: executeDistribution, taskMessageType: 'distribution' },
  revenue: { execute: executeRevenueReport, taskMessageType: 'revenue_report' },
  traffic: { execute: executeTrafficReport, taskMessageType: 'traffic_report' },
  conversion: { execute: executeConversionReport, taskMessageType: 'conversion_report' },
  experiment: { execute: executeExperimentCycle, taskMessageType: 'experiment_cycle' },
  growth: { execute: executeGrowthCycle, taskMessageType: 'growth_cycle' },
  control: { execute: async (env, task) => { const { evaluateSystemPriority } = await import('./control-agent.js'); return evaluateSystemPriority(env); }, taskMessageType: 'control_cycle' },
  control: { execute: async (env, task) => { const { evaluateSystemPriority } = await import('./control-agent.js'); return evaluateSystemPriority(env); }, taskMessageType: 'control_cycle' }
};
const ORDERED_IMPLEMENTED_IDS = ['market', 'opportunity', 'audience', 'offer', 'content', 'media', 'distribution', 'revenue', 'traffic', 'conversion', 'experiment', 'growth'];

export const IMPLEMENTED_AGENT_IDS = Object.keys(AGENT_HANDLERS);

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
    const conversion = await readMemory(env, 'conversion_reports', 'latest');
    decision = {
      status: 'REVENUE_LEAKAGE',
      reasoning: `มี click ${traffic.last30d.clickCount} ครั้งใน 30 วันล่าสุด แต่ conversion = 0 — ตรงกับกฎ "traffic สูงแต่ไม่เกิด revenue ต้องหาสาเหตุ ไม่ใช่ประกาศว่าสำเร็จ"`,
      recommendedNextAction: conversion
        ? (conversion.leakage.status === 'ISSUES_FOUND'
            ? `Conversion Agent วิเคราะห์แล้ว: พบ ${conversion.leakage.productsWithClicksNoConversion.length} สินค้าที่มี click แต่ conversion=0 — ควรดู CTA/ราคา/landing ของสินค้ากลุ่มนี้ก่อน (ต้องใช้ข้อมูลเชิงคุณภาพเพิ่ม เช่น heatmap เพื่อหาสาเหตุจริง)`
            : 'Conversion Agent วิเคราะห์แล้วยังไม่พบ pattern ชัดเจนจากข้อมูลที่มี')
        : 'ต้องรัน Conversion Agent ก่อนเพื่อดูรายละเอียดว่าสินค้าไหนมีปัญหา',
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

export async function runFullCycle(env) {
  const results = {};
  for (const agentId of ORDERED_IMPLEMENTED_IDS) {
    try {
      const r = await runAgentOnce(env, agentId, { messageType: `${agentId}_report` });
      results[agentId] = { ok: true, taskId: r.taskId };
    } catch (err) {
      results[agentId] = { ok: false, error: err.message || String(err) };
    }
  }

  let decision = null;
  try {
    decision = await evaluateSystemPriority(env);
  } catch (err) {
    decision = { status: 'ERROR', reasoning: err.message || String(err), recommendedNextAction: null };
  }

  return { results, decision };
}
