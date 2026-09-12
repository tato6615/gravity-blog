/**
 * functions/api/agents/run-all.js — GRAVITY ARS STEP 2 (slice 4)
 * ---------------------------------------------------------------------------
 * POST /api/agents/run-all
 * The "one click" entry point: runs every implemented report agent
 * (revenue, traffic, conversion) in sequence via runFullCycle(), then
 * evaluates the Control Agent's decision — so the Admin no longer has to
 * click each agent individually before the decision card reflects fresh
 * data.
 */

import { runFullCycle } from '../../_lib/agents/control-agent.js';

export async function onRequestPost({ env }) {
  try {
    const { results, decision } = await runFullCycle(env);
    return new Response(JSON.stringify({ ok: true, results, decision }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}
