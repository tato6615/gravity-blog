/**
 * functions/api/agents/status.js — GRAVITY ARS STEP 1
 * ---------------------------------------------------------
 * GET /api/agents/status
 * Same-origin Pages Function (no CORS needed — called directly from
 * admin.html on gravity-blog.pages.dev, same pattern as /api/system-health
 * and /api/stats). Backs the Admin's "🤖 Multi-Agent" tab: SYSTEM / MONEY /
 * AGENTS / ALERTS, per the spec's Admin Foundation requirements.
 *
 * MONEY comes straight from the `conversions` table (real, measurable
 * transactions) — never estimated, per the Revenue Agent rule ("never
 * claim revenue without actual measurable transaction/revenue data").
 */

import { reconcileRegistry, detectStale } from '../../_lib/agents/control-agent.js';
import { listRecentLogs, readMemory } from '../../_lib/agents/db.js';

export async function onRequestGet({ env }) {
  try {
    const agents = await reconcileRegistry(env);

    const system = {
      totalAgents: agents.length,
      idle: agents.filter(a => a.status === 'IDLE').length,
      working: agents.filter(a => a.status === 'WORKING').length,
      waiting: agents.filter(a => a.status === 'WAITING').length,
      success: agents.filter(a => a.status === 'SUCCESS').length,
      failed: agents.filter(a => a.status === 'FAILED').length,
      blocked: agents.filter(a => a.status === 'BLOCKED').length,
      disabled: agents.filter(a => a.status === 'DISABLED').length
    };

    let money = { totalConversions: 0, totalCommission: 0, last30dConversions: 0, last30dCommission: 0 };
    if (env.DB) {
      const totals = await env.DB.prepare(
        `SELECT COUNT(*) as n, COALESCE(SUM(commission), 0) as total FROM conversions`
      ).first();
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recent = await env.DB.prepare(
        `SELECT COUNT(*) as n, COALESCE(SUM(commission), 0) as total FROM conversions WHERE timestamp >= ?`
      ).bind(since).first();
      money = {
        totalConversions: totals?.n || 0,
        totalCommission: Math.round((totals?.total || 0) * 100) / 100,
        last30dConversions: recent?.n || 0,
        last30dCommission: Math.round((recent?.total || 0) * 100) / 100
      };
    }

    const staleAgents = detectStale(agents);
    const alerts = [
      ...agents.filter(a => a.status === 'FAILED').map(a => ({
        level: 'error', agentId: a.id, message: `${a.name} อยู่ในสถานะ FAILED — ล่าสุด: ${a.last_error || 'ไม่มีรายละเอียด error'}`
      })),
      ...agents.filter(a => a.status === 'BLOCKED').map(a => ({
        level: 'warn', agentId: a.id, message: `${a.name} ถูก BLOCKED`
      })),
      ...staleAgents.map(a => ({
        level: 'warn', agentId: a.id, message: `${a.name} อยู่ในสถานะ WORKING มานานผิดปกติ (ไม่มี activity ใหม่)`
      }))
    ];

    const recentLogs = await listRecentLogs(env, { limit: 20 });
    const revenueReport = env.DB ? await readMemory(env, 'revenue_reports', 'latest') : null;

    return new Response(JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      system,
      money,
      agents: agents.map(a => ({
        id: a.id, name: a.name, role: a.role,
        capabilities: (() => { try { return JSON.parse(a.capabilities || '[]'); } catch { return []; } })(),
        status: a.status, currentTaskId: a.current_task_id,
        lastActivityAt: a.last_activity_at, lastResult: a.last_result, lastError: a.last_error,
        executionCount: a.execution_count, successCount: a.success_count, failureCount: a.failure_count
      })),
      alerts,
      recentLogs,
      revenueReport
    }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}
