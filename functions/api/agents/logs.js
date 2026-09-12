/**
 * functions/api/agents/logs.js — GRAVITY ARS STEP 1
 * ---------------------------------------------------------
 * GET /api/agents/logs?agentId=&level=&limit=
 * Full technical activity log — separate from the Admin's curated
 * "Alerts" list (status.js) per the spec: "Only important problems [go
 * in Alerts]. Technical logs can exist separately."
 */

import { listRecentLogs } from '../../_lib/agents/db.js';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId') || undefined;
    const level = url.searchParams.get('level') || undefined;
    const limit = url.searchParams.get('limit') || 50;
    const logs = await listRecentLogs(env, { agentId, level, limit });
    return new Response(JSON.stringify({ ok: true, logs }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}
