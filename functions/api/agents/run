/**
 * functions/api/agents/run.js — GRAVITY ARS STEP 2 (slice 1)
 * ---------------------------------------------------------------------------
 * POST /api/agents/run  { agentId }
 * Manually (or on a schedule — see .github/workflows/run-agents.yml) runs
 * one agent's real handler once, end-to-end, through the Control Agent's
 * runAgentOnce(). This is the system's first real autonomous execution
 * path — currently only "revenue" has an implemented handler; every other
 * agent responds with a clear "not implemented yet" instead of pretending
 * to have done something.
 */

import { runAgentOnce } from '../../_lib/agents/control-agent.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const agentId = body.agentId || 'revenue';
    const { taskId, result } = await runAgentOnce(env, agentId, { messageType: body.messageType || 'run' });
    return new Response(JSON.stringify({ ok: true, agentId, taskId, result }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}
