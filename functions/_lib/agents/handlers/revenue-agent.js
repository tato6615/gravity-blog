/**
 * functions/_lib/agents/handlers/revenue-agent.js — GRAVITY ARS STEP 2 (slice 1)
 * ---------------------------------------------------------------------------
 * The Revenue Agent's first real capability: read the `conversions` table
 * (the only real-revenue table — see 13_DATA/SCHEMA.md) and produce an
 * economics report. 100% read-only — cannot break anything else.
 *
 * Honesty rules enforced here (per the ARS spec, section 10/11):
 *   - Every number comes straight from `conversions`/`products`. Nothing
 *     is estimated or invented.
 *   - `byProduct` is DIRECT attribution — `conversions.product_id` is a
 *     real foreign key, no guessing involved.
 *   - `byChannel` is explicitly UNKNOWN: `conversions` has no channel/subid
 *     column, so there is no real link between a conversion and which
 *     distribution channel (Facebook/Threads/etc.) drove it. Claiming a
 *     per-channel revenue split without that data would be fabrication —
 *     the spec explicitly forbids this ("never invent values... show
 *     UNKNOWN"). Adding real channel attribution (e.g. affiliate sub-IDs
 *     per channel) is future work, not something this handler can fake.
 */

import { writeMemory } from '../db.js';

export async function executeRevenueReport(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const totals = await env.DB.prepare(
    `SELECT COUNT(*) as n, COALESCE(SUM(commission), 0) as total FROM conversions`
  ).first();

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const last30d = await env.DB.prepare(
    `SELECT COUNT(*) as n, COALESCE(SUM(commission), 0) as total FROM conversions WHERE timestamp >= ?`
  ).bind(since30d).first();

  // DIRECT attribution: conversions.product_id is a real FK into products.
  // product_id is stored as TEXT in conversions but products.id is an
  // INTEGER primary key — cast to join correctly.
  const { results: byProductRaw } = await env.DB.prepare(`
    SELECT c.product_id as productId, p.product_name as productName,
           COALESCE(SUM(c.commission), 0) as revenue, COUNT(*) as conversionCount
    FROM conversions c
    LEFT JOIN products p ON CAST(c.product_id AS INTEGER) = p.id
    GROUP BY c.product_id
    ORDER BY revenue DESC
    LIMIT 10
  `).all();

  const report = {
    generatedAt: new Date().toISOString(),
    attribution: 'DIRECT (conversions.product_id is a real foreign key — no inference involved)',
    totals: {
      grossRevenue: Math.round((totals?.total || 0) * 100) / 100,
      conversionCount: totals?.n || 0,
      avgCommission: totals?.n ? Math.round((totals.total / totals.n) * 100) / 100 : 0
    },
    last30d: {
      grossRevenue: Math.round((last30d?.total || 0) * 100) / 100,
      conversionCount: last30d?.n || 0
    },
    byProduct: byProductRaw.map(r => ({
      productId: r.productId,
      productName: r.productName || `Product #${r.productId} (ไม่พบชื่อ — อาจถูกลบไปแล้ว)`,
      revenue: Math.round(r.revenue * 100) / 100,
      conversionCount: r.conversionCount
    })),
    byChannel: {
      status: 'UNKNOWN',
      reason: 'ตาราง conversions ไม่มีคอลัมน์ channel/sub-id — ไม่มีข้อมูลจริงที่เชื่อมโยง conversion กับช่องทางที่พาเข้ามา การแตกยอดรายได้ตามช่องทางตอนนี้จะเป็นการเดา ไม่ใช่ของจริง'
    }
  };

  // Store for the Admin panel to read without recomputing, and as the
  // agent's persistent memory of its own most recent finding.
  await writeMemory(env, 'revenue_reports', 'latest', report, 'revenue');

  return report;
}
