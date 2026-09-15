/**
 * functions/api/agents/webhook.js — GRAVITY ARS AGENT-002 (event-driven wake)
 * ---------------------------------------------------------------------------
 * POST /api/agents/webhook
 * Body: { event: string, payload?: object }
 *
 * Lets external events (new market candidate from Worker af, a new
 * product import, a Telegram command, etc.) wake the relevant agent
 * immediately, instead of waiting up to TICK_COOLDOWN_MINUTES for the
 * next scheduled tick (see functions/api/agents/tick.js).
 *
 * Race safety: reuses the exact same WORKING-status guard tick.js uses —
 * if the target agent is already WORKING (e.g. a tick claimed it a
 * moment ago), this skips instead of double-running it. agents.status in
 * D1 is the single source of truth both tick.js and this file read
 * before calling runAgentOnce() — no new locking mechanism needed.
 *
 * ⚠️ Caller side NOT wired yet: Worker af / Telegram bot / Discord bot
 * still need code added on THEIR end to actually POST here when the
 * relevant event happens. This file only provides the endpoint + routing
 * + race guard (the 3 backlog checklist items) — same honest caveat
 * product-webhook.js already documents for its own caller.
 */

import { reconcileRegistry, runAgentOnce } from '../../_lib/agents/control-agent.js';

// Event type → which agent to wake. Add new event types here as new
// triggers get wired up — single place mapping "what happened" to "who reacts".
const EVENT_AGENT_MAP = {
  new_market_candidate: 'market',   // Worker af's market-discovery.js wrote a new row
  new_product: 'opportunity',       // Worker af imported+enriched a new product
  telegram_command: 'control',      // manual nudge via Telegram bot command
};

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid JSON body' }, 400);
  }

  const { event, payload } = body || {};
  const agentId = EVENT_AGENT_MAP[event];

  if (!agentId) {
    return json({
      ok: false,
      error: `unknown event "${event}"`,
      knownEvents: Object.keys(EVENT_AGENT_MAP)
    }, 400);
  }

  const agents = await reconcileRegistry(env);
  const agent = agents.find(a => a.id === agentId);

  if (agent?.status === 'WORKING') {
    return json({
      ok: true,
      skipped: true,
      agentId,
      reason: 'agent ยังอยู่ในสถานะ WORKING อยู่แล้ว (อาจถูก tick หรือ webhook ก่อนหน้านี้ claim ไปแล้ว) — ไม่ double-run'
    });
  }

  try {
    const { taskId } = await runAgentOnce(env, agentId, { messageType: 'webhook' });
    return json({ ok: true, skipped: false, agentId, taskId, event, payload: payload ?? null });
  } catch (err) {
    return json({ ok: false, agentId, event, error: err.message || String(err) }, 500);
  }
}

export async function onRequestGet() {
  return json({
    ok: true,
    usage: 'POST { "event": "new_market_candidate" | "new_product" | "telegram_command", "payload"?: {} }',
    knownEvents: Object.keys(EVENT_AGENT_MAP)
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
