/**
 * functions/_lib/agents/handlers/traffic-agent.js — GRAVITY ARS STEP 2 (slice 2)
 * ---------------------------------------------------------------------------
 * The Traffic Agent's first real capability: read the `clicks` table (the
 * only real traffic-event table — see 13_DATA/SCHEMA.md) and produce a
 * traffic report. 100% read-only, same honesty rules as revenue-agent.js:
 *   - Every number comes straight from `clicks`. Nothing is estimated.
 *   - `byProduct` is DIRECT attribution — clicks.product_id is a real
 *     foreign key into products.
 *   - `bySource` uses clicks.utm_source AS-IS. Rows with no utm_source are
 *     grouped under 'direct/unknown' — that IS the real data (most traffic
 *     has no UTM tag), not a gap we're hiding.
 *   - `revenueLink` is explicitly UNKNOWN unless a conversion exists for
 *     the same product_id within the window — clicks has no order/session
 *     id, so a specific click can never be tied to a specific conversion.
 *     Only a same-product correlation is honest; anything stronger would
 *     be fabrication.
 */

import { writeMemory } from '../db.js';

export async function executeTrafficReport(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const totals = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM clicks`
  ).first();

  const last30d = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM clicks WHERE timestamp >= ?`
  ).bind(since30d).first();

  const { results: byEventTypeRaw } = await env.DB.prepare(`
    SELECT COALESCE(event_type, 'click') as eventType, COUNT(*) as n
    FROM clicks WHERE timestamp >= ?
    GROUP BY eventType
  `).bind(since30d).all();

  const { results: bySourceRaw } = await env.DB.prepare(`
    SELECT COALESCE(NULLIF(utm_source, ''), 'direct/unknown') as source, COUNT(*) as n
    FROM clicks WHERE timestamp >= ?
    GROUP BY source ORDER BY n DESC LIMIT 10
  `).bind(since30d).all();

  const { results: byProductRaw } = await env.DB.prepare(`
    SELECT c.product_id as productId, p.product_name as productName, COUNT(*) as clickCount
    FROM clicks c
    LEFT JOIN products p ON CAST(c.product_id AS INTEGER) = p.id
    WHERE c.timestamp >= ?
    GROUP BY c.product_id
    ORDER BY clickCount DESC
    LIMIT 10
  `).bind(since30d).all();

  const { results: noConversionProducts } = await env.DB.prepare(`
    SELECT c.product_id as productId, COUNT(*) as clickCount
    FROM clicks c
    WHERE c.timestamp >= ?
      AND NOT EXISTS (
        SELECT 1 FROM conversions v WHERE v.product_id = c.product_id
      )
    GROUP BY c.product_id
    ORDER BY clickCount DESC
    LIMIT 10
  `).bind(since30d).all();

  const report = {
    generatedAt: new Date().toISOString(),
    attribution: 'DIRECT (clicks.product_id is a real foreign key — no inference involved)',
    totals: { clickCount: totals?.n || 0 },
    last30d: {
      clickCount: last30d?.n || 0,
      byEventType: byEventTypeRaw.map(r => ({ eventType: r.eventType, count: r.n })),
    },
    bySource: bySourceRaw.map(r => ({ source: r.source, count: r.n })),
    byProduct: byProductRaw.map(r => ({
      productId: r.productId,
      productName: r.productName || `Product #${r.productId} (ไม่พบชื่อ — อาจถูกลบไปแล้ว)`,
      clickCount: r.clickCount
    })),
    revenueLink: {
      status: noConversionProducts.length ? 'GAP_DETECTED' : 'OK_OR_NO_DATA',
      note: 'นับเฉพาะ product_id เดียวกันที่มี click ในช่วงนี้แต่ไม่เคยมี conversion เลย — เป็นความสัมพันธ์แบบ correlation ต่อสินค้า ไม่ใช่การยืนยันว่า click เส้นไหนพลาด',
      productsWithClicksNoConversion: noConversionProducts.map(r => ({
        productId: r.productId, clickCount: r.clickCount
      }))
    }
  };

  await writeMemory(env, 'traffic_reports', 'latest', report, 'traffic');

  return report;
}
