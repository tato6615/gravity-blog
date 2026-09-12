/**
 * functions/api/agents/tick.js — GRAVITY ARS STEP 3 (Autonomous Tick, slice 1)
 * ---------------------------------------------------------------------------
 * POST/GET /api/agents/tick
 * The Control Agent's heartbeat — called on a schedule by
 * .github/workflows/agent-tick.yml (Cloudflare Pages Functions have no
 * native cron trigger, so scheduling lives in GitHub Actions instead,
 * matching this repo's existing pattern for scheduled jobs).
 *
 * Step 3 slice 1 decision rule (deliberately simple, honest about its
 * limits): of the agents with a REAL implemented handler (see
 * control-agent.js's AGENT_HANDLERS), run any that haven't completed
 * within TICK_COOLDOWN_MINUTES and aren't already WORKING.
 *
 * Step 3 slice 2 (added alongside the Traffic Agent handler): after the
 * run loop, evaluateSystemPriority() compares the latest revenue + traffic
 * reports and writes/returns a `decision` — the spec's section 5 example
 * ("traffic without revenue must be investigated, not declared success")
 * implemented literally, using only the two signals that actually exist.
 *
 * NOT yet implemented here (future work, not faked):
 *   - Cross-agent handoffs (market → opportunity → ... → revenue)
 *   - Full priority scoring across all 13 agents (revenue impact /
 *     evidence / urgency / confidence / cost / effort / risk — section 6)
 *   - Reacting to new data events in real time (this only re-checks the
 *     signal once per tick, not on new-click/new-transaction webhooks)
 *   - Auto-executing the decision's recommendedNextAction — it's
 *     surfaced, not yet acted on (no Conversion/Experiment/Growth
 *     handler exists to hand it to)
 */

import { reconcileRegistry, runAgentOnce, evaluateSystemPriority, IMPLEMENTED_AGENT_IDS } from '../../_lib/agents/control-agent.js';

const TICK_COOLDOWN_MINUTES = 55; // slightly under the 1h schedule interval

async function handleTick({ env }) {
  const startedAt = new Date().toISOString();
  try {
    const agents = await reconcileRegistry(env);
    const cutoff = Date.now() - TICK_COOLDOWN_MINUTES * 60 * 1000;

    const ran = [];
    const skipped = [];

    for (const agentId of IMPLEMENTED_AGENT_IDS) {
      const agent = agents.find(a => a.id === agentId);
      const lastRun = agent?.last_activity_at ? new Date(agent.last_activity_at).getTime() : 0;

      if (agent?.status === 'WORKING') {
        skipped.push({ agentId, reason: 'ยังอยู่ในสถานะ WORKING (อาจรันค้างจากรอบก่อน)' });
        continue;
      }
      if (lastRun > cutoff) {
        skipped.push({ agentId, reason: `รันไปแล้วภายใน ${TICK_COOLDOWN_MINUTES} นาทีที่ผ่านมา` });
        continue;
      }
      try {
        const { taskId } = await runAgentOnce(env, agentId, { messageType: 'tick' });
        ran.push({ agentId, taskId, ok: true });
      } catch (err) {
        ran.push({ agentId, ok: false, error: err.message || String(err) });
      }
    }

    let decision = null;
    try {
      decision = await evaluateSystemPriority(env);
    } catch (err) {
      decision = { status: 'ERROR', reasoning: err.message || String(err) };
    }

    return new Response(JSON.stringify({
      ok: true, startedAt, finishedAt: new Date().toISOString(), ran, skipped, decision
    }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, startedAt, error: err.message || String(err) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) { return handleTick(context); }
export async function onRequestGet(context) { return handleTick(context); }
