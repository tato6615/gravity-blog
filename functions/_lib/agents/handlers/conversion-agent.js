/**
 * functions/_lib/agents/handlers/conversion-agent.js — GRAVITY ARS STEP 2 (slice 3)
 * ---------------------------------------------------------------------------
 * The Conversion Agent's first real capability: read `clicks` (view vs
 * click events) and `conversions` per product, and produce a conversion
 * report. 100% read-only, same honesty rules as revenue-agent.js /
 * traffic-agent.js:
 *   - Every number comes straight from `clicks`/`conversions`. Nothing is
 *     estimated.
 *   - Rates (CTR, conversion rate) are AGGREGATE per product — there is no
 *     session/order table linking a specific click to a specific
 *     conversion, so this is a product-level correlation, not a real
 *     per-visitor funnel. Claiming otherwise would be fabrication.
 *   - `leakage` surfaces products with real clicks but zero conversions —
 *     this IS measured data. The root cause (bad CTA, price, landing copy)
 *     is explicitly marked as needing qualitative data this system does
 *     not have yet (heatmaps, session recordings) — never invented.
 */

import { writeMemory } from '../db.js';

export async function executeConversionReport(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const totalClicks = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM clicks WHERE event_type = 'click'`
  ).first();
  const totalConversions = await env.DB.prepare(`SELECT COUNT(*) as n FROM conversions`).first();

  const last30dClicks = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM clicks WHERE event_type = 'click' AND timestamp >= ?`
  ).bind(since30d).first();
  const last30dConversions = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM conversions WHERE timestamp >= ?`
  ).bind(since30d).first();

  const { results: byProductRaw } = await env.DB.prepare(`
    SELECT
      cl.product_id as productId,
      p.product_name as productName,
      COALESCE(SUM(CASE WHEN cl.event_type = 'view' THEN 1 ELSE 0 END), 0) as viewCount,
      COALESCE(SUM(CASE WHEN cl.event_type = 'click' THEN 1 ELSE 0 END), 0) as clickCount
    FROM clicks cl
    LEFT JOIN products p ON CAST(cl.product_id AS INTEGER) = p.id
    WHERE cl.timestamp >= ?
    GROUP BY cl.product_id
  `).bind(since30d).all();

  const { results: conversionsByProductRaw } = await env.DB.prepare(`
    SELECT product_id as productId, COUNT(*) as conversionCount
    FROM conversions
    WHERE timestamp >= ?
    GROUP BY product_id
  `).bind(since30d).all();
  const conversionMap = new Map(conversionsByProductRaw.map(r => [String(r.productId), r.conversionCount]));

  const byProduct = byProductRaw.map(r => {
    const conversionCount = conversionMap.get(String(r.productId)) || 0;
    const clickCount = r.clickCount || 0;
    const viewCount = r.viewCount || 0;
    return {
      productId: r.productId,
      productName: r.productName || `Product #${r.productId} (ไม่พบชื่อ — อาจถูกลบไปแล้ว)`,
      viewCount, clickCount, conversionCount,
      clickThroughRate: viewCount ? Math.round((clickCount / viewCount) * 10000) / 100 : null,
      conversionRate: clickCount ? Math.round((conversionCount / clickCount) * 10000) / 100 : null
    };
  }).sort((a, b) => b.clickCount - a.clickCount);

  const leakageProducts = byProduct
    .filter(p => p.clickCount > 0 && p.conversionCount === 0)
    .sort((a, b) => b.clickCount - a.clickCount)
    .slice(0, 10);

  const overallConversionRate = last30dClicks?.n
    ? Math.round(((last30dConversions?.n || 0) / last30dClicks.n) * 10000) / 100
    : null;

  const report = {
    generatedAt: new Date().toISOString(),
    attribution: 'AGGREGATE (product-level counts from clicks/conversions — no session/order table links a specific click to a specific conversion, so rates are aggregate correlations, not per-visitor funnel tracking)',
    totals: {
      clickCount: totalClicks?.n || 0,
      conversionCount: totalConversions?.n || 0
    },
    last30d: {
      clickCount: last30dClicks?.n || 0,
      conversionCount: last30dConversions?.n || 0,
      overallConversionRate
    },
    byProduct,
    leakage: {
      status: leakageProducts.length ? 'ISSUES_FOUND' : 'NONE_DETECTED',
      note: 'สินค้าที่มี click จริงใน 30 วันล่าสุดแต่ conversion = 0 เป็นตัวเลขจริง ไม่ใช่การประเมิน แต่สาเหตุที่แท้จริง (CTA, ราคา, landing) ต้องมีข้อมูลเชิงคุณภาพเพิ่ม (heatmap, session recording) ที่ระบบนี้ยังไม่มี — ห้ามเดาสาเหตุ',
      productsWithClicksNoConversion: leakageProducts
    },
    limitations: {
      status: 'PARTIAL',
      reason: 'ไม่มีตาราง session/order เชื่อม click กับ conversion แบบ 1:1 ดังนั้น conversionRate เป็นอัตราส่วนระดับ product เท่านั้น ไม่ใช่ funnel ต่อผู้เข้าชมจริงคนเดียวกัน'
    }
  };

  await writeMemory(env, 'conversion_reports', 'latest', report, 'conversion');

  return report;
}
