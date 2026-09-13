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
 * Step 3 slice 3 (added alongside Media + Distribution Agents): confirmed
 * by reading every handler that the full task-queue chain — opportunity
 * → audience → offer → content → media → distribution — already calls
 * createTask() into the next agent (see each handler's own header
 * comment), and IMPLEMENTED_AGENT_IDS iterates in that exact pipeline
 * order (see control-agent.js's AGENT_HANDLERS). That means a single tick
 * already cascades a product end-to-end (selected opportunity → published
 * + distributed) in one pass, PROVIDED every stage in the chain is
 * actually allowed to run on this tick.
 *
 * The one thing that was silently defeating that cascade: EVERY agent,
 * including the queue-draining ones above, shared the same
 * TICK_COOLDOWN_MINUTES gate meant for expensive/slow-changing REPORT
 * agents (market/revenue/traffic/conversion/experiment/growth — these
 * read real external/business data that doesn't change every few minutes,
 * so re-running them constantly wastes nothing dangerous but adds noise
 * for no benefit). A queue-draining agent has no such downside: it's
 * bounded to MAX_TASKS_PER_RUN per handler and is a fast no-op
 * ('NO_PENDING_TASKS') when its queue is empty — so gating it behind the
 * same cooldown as a report agent only ever hurts (a backlog of >5 items,
 * or work created mid-chain by an earlier stage, waits up to
 * TICK_COOLDOWN_MINUTES for no real reason). QUEUE_DRIVEN_AGENT_IDS below
 * are exempt from the cooldown — they still get skipped if already
 * WORKING (that guard stays, to prevent two overlapping ticks from
 * double-claiming), just not gated by recency.
 *
 * NOT yet implemented here (future work, not faked):
 *   - Full priority scoring across all 13 agents (revenue impact /
 *     evidence / urgency / confidence / cost / effort / risk — section 6)
 *     — evaluateSystemPriority() still only compares revenue vs traffic
 *   - Reacting to new data events in real time (this only re-checks the
 *     signal once per tick, not on new-click/new-transaction webhooks)
 *   - Auto-executing the decision's recommendedNextAction for the
 *     REPORT-agent side of the system — it's surfaced in `decision`, not
 *     yet turned into a new createTask() the way the pipeline side above
 *     already does for itself
 *   - Market Agent's own upstream: it only reads what Worker af's
 *     market-discovery.js already wrote into `markets` — if that external,
 *     non-agentic process stops running, DISCOVER has no self-refill
 *     inside this repo (Market Agent reports 'NO_CANDIDATES' honestly
 *     instead of inventing demand, but nothing here restarts discovery)
 */

import { reconcileRegistry, runAgentOnce, evaluateSystemPriority, IMPLEMENTED_AGENT_IDS } from '../../_lib/agents/control-agent.js';
import { updateAgentStatus } from '../../_lib/agents/db.js';

const TICK_COOLDOWN_MINUTES = 55; // slightly under the 1h schedule interval — REPORT agents only, see header comment

// Agents that only ever act on a real pending agent_tasks row addressed to
// them (claimNextTask, bounded to MAX_TASKS_PER_RUN per handler) — safe
// and cheap to attempt every tick regardless of how recently they last ran.
const QUEUE_DRIVEN_AGENT_IDS = new Set(['opportunity', 'audience', 'offer', 'content', 'media', 'distribution']);

async function handleTick({ env }) {
  const startedAt = new Date().toISOString();
  try {
    const agents = await reconcileRegistry(env);
    // Control Agent's own row: IMPLEMENTED_AGENT_IDS deliberately excludes
    // 'control' (it's the orchestrator running THIS tick, not one of the
    // handlers it dispatches), so nothing else in this file ever calls
    // updateAgentStatus(env, 'control', ...) — meaning its row in `agents`
    // would sit at whatever it was seeded as (IDLE) forever, even while the
    // loop below runs correctly. Mark it WORKING now so a mid-tick crash is
    // visible as WORKING/stale rather than a silent, misleading IDLE.
    await updateAgentStatus(env, 'control', { status: 'WORKING' });
    const cutoff = Date.now() - TICK_COOLDOWN_MINUTES * 60 * 1000;

    const ran = [];
    const skipped = [];

    for (const agentId of IMPLEMENTED_AGENT_IDS) {
      const agent = agents.find(a => a.id === agentId);
      const lastRun = agent?.last_activity_at ? new Date(agent.last_activity_at).getTime() : 0;
      const isQueueDriven = QUEUE_DRIVEN_AGENT_IDS.has(agentId);

      if (agent?.status === 'WORKING') {
        skipped.push({ agentId, reason: 'ยังอยู่ในสถานะ WORKING (อาจรันค้างจากรอบก่อน)' });
        continue;
      }
      if (!isQueueDriven && lastRun > cutoff) {
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

    await updateAgentStatus(env, 'control', {
      status: 'SUCCESS',
      lastResult: { ranCount: ran.length, skippedCount: skipped.length, decisionStatus: decision?.status },
      outcome: 'success'
    });

    return new Response(JSON.stringify({
      ok: true, startedAt, finishedAt: new Date().toISOString(), ran, skipped, decision
    }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    try {
      await updateAgentStatus(env, 'control', { status: 'FAILED', lastError: err.message || String(err), outcome: 'failure' });
    } catch (_) { /* best-effort — don't mask the original error */ }
    return new Response(JSON.stringify({ ok: false, startedAt, error: err.message || String(err) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) { return handleTick(context); }
export async function onRequestGet(context) { return handleTick(context); }












