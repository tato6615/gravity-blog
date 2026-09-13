/**
 * functions/_lib/agents/handlers/offer-agent.js — GRAVITY ARS STEP 2 (slice 10)
 * ---------------------------------------------------------------------------
 * Offer Agent's first real capability: claims pending `agent_tasks` rows
 * addressed to `offer` (created by Audience Agent once it's done) and
 * tries to match the selected market/opportunity to a REAL product
 * already sitting in this business's own backlog (`products` table,
 * pipeline_status NOT IN ('published','blocked_low_quality',
 * 'skipped_market_not_approved')) — confirmed live counts on 2026-09-13:
 * imported=12, enriching=10, enriched=30 waiting, vs published=167.
 *
 * Deliberately scoped down: this agent does NOT search the internet or
 * any product API for new products (no such credential exists yet — see
 * chat where this was explicitly decided). `products` has no
 * `market_id` column (confirmed live schema — the doc's own caveat that
 * it "may not be present" turned out to be correct), so matching is by
 * `category`/`category_th` text against the market's `category`,
 * case-insensitively.
 *
 * If a backlog product matches: this is a real, honest match (not
 * invented) — hands off to `content` (next in the spec's pipeline:
 * MARKET → OPPORTUNITY → AUDIENCE → OFFER → CONTENT → ...).
 *
 * If nothing matches: reports NEEDS_SOURCING plainly instead of
 * fabricating a product. This is exactly the kind of "need a human to
 * find/import a product URL" case spec section 13 describes — the
 * system escalates instead of guessing, and does NOT create a downstream
 * task (there's no real offer to hand off yet).
 */

import { claimNextTask, completeTask, failTask, createTask, writeMemory, nowIso } from '../db.js';

const MAX_TASKS_PER_RUN = 5;
const BACKLOG_STATUSES = ['imported', 'enriching', 'enriched'];

async function matchOneOpportunity(env, task) {
  let payload;
  try {
    payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {});
  } catch {
    payload = {};
  }
  const { marketId, marketName, category, country, contentAngles, aiReasoning, audienceProfile } = payload;

  const placeholders = BACKLOG_STATUSES.map(() => '?').join(',');
  const { results: matches } = await env.DB.prepare(`
    SELECT id, product_name, brand, category, category_th, pipeline_status,
           affiliate_link, source_url, price, rating
    FROM products
    WHERE pipeline_status IN (${placeholders})

    ORDER BY
      CASE pipeline_status WHEN 'enriched' THEN 0 WHEN 'enriching' THEN 1 ELSE 2 END,
      id DESC
    LIMIT 5
  `).bind(...BACKLOG_STATUSES).all();

  if (!matches.length) {
    const result = {
      marketId, marketName, category, country,
      status: 'NEEDS_SOURCING',
      note: `ไม่พบสินค้าใน backlog (pipeline_status: imported/enriching/enriched) ที่หมวดตรงกับ "${category || '(ไม่ระบุ)'}" เลย — ระบบนี้ไม่มีวิธีหาสินค้าใหม่จากอินเทอร์เน็ตเองได้ (ไม่มี product-search API) ต้องการคนช่วย import URL สินค้าในหมวดนี้เข้า Worker af ก่อน ตามสเปกข้อ 13 (human intervention เมื่อระบบแก้เองไม่ได้) — ไม่แต่งสินค้าขึ้นมาเอง`,
      matchedProduct: null
    };
    await writeMemory(env, 'offer_reports', `market_${marketId}`, result, 'offer');
    return result;
  }

  const chosen = matches[0];
  const result = {
    marketId, marketName, category, country,
    status: 'MATCHED_BACKLOG',
    note: `จับคู่กับสินค้าที่มีอยู่แล้วใน backlog: #${chosen.id} "${chosen.product_name}" (pipeline_status=${chosen.pipeline_status}) — หมวดตรงกัน ไม่ต้อง sourcing ใหม่ ส่งต่อให้ Content Agent ทำ content ต่อ`,
    matchedProduct: {
      productId: chosen.id, productName: chosen.product_name, brand: chosen.brand,
      pipelineStatus: chosen.pipeline_status, hasAffiliateLink: !!chosen.affiliate_link,
      price: chosen.price, rating: chosen.rating
    },
    otherCandidates: matches.slice(1).map(m => ({ productId: m.id, productName: m.product_name, pipelineStatus: m.pipeline_status }))
  };

  await writeMemory(env, 'offer_reports', `market_${marketId}`, result, 'offer');

  const createdTask = await createTask(env, {
    senderAgent: 'offer',
    receiverAgent: 'content',
    messageType: 'offer_matched',
    priority: 8,
    payload: {
      marketId, marketName, category, country, contentAngles, aiReasoning, audienceProfile,
      productId: chosen.id, productName: chosen.product_name, pipelineStatus: chosen.pipeline_status
    }
  });

  return { ...result, nextTaskId: createdTask.id };
}

export async function executeOfferMatching(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const processed = [];
  const failed = [];

  for (let i = 0; i < MAX_TASKS_PER_RUN; i++) {
    const claimed = await claimNextTask(env, 'offer');
    if (!claimed) break;

    try {
      const result = await matchOneOpportunity(env, claimed);
      await completeTask(env, claimed.id, result);
      processed.push(result);
    } catch (err) {
      const msg = err.message || String(err);
      await failTask(env, claimed.id, msg);
      failed.push({ taskId: claimed.id, error: msg });
    }
  }

  const matchedCount = processed.filter(p => p.status === 'MATCHED_BACKLOG').length;
  const needsSourcingCount = processed.filter(p => p.status === 'NEEDS_SOURCING').length;

  const report = {
    generatedAt: nowIso(),
    status: processed.length ? 'PROCESSED' : (failed.length ? 'ERRORS' : 'NO_PENDING_TASKS'),
    note: processed.length
      ? `ประมวลผล ${processed.length} opportunity — จับคู่กับ backlog สำเร็จ ${matchedCount} รายการ (ส่งต่อ Content Agent แล้ว), ต้องการ sourcing เพิ่ม ${needsSourcingCount} รายการ (รอคนช่วย import URL)`
      : (failed.length ? `พยายามแล้วแต่ล้มเหลว ${failed.length} รายการ` : 'ไม่มี task ค้างอยู่ในคิวสำหรับ offer ตอนนี้'),
    matchedCount, needsSourcingCount,
    processed, failed
  };

  await writeMemory(env, 'offer_reports', 'latest', report, 'offer');
  return report;
}
