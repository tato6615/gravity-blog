/**
 * functions/_lib/agents/handlers/growth-agent.js — GRAVITY ARS STEP 2 (slice 6)
 * ---------------------------------------------------------------------------
 * The Growth Agent's first real capability: implements spec section 7
 * ("เมื่อพบสิ่งที่ทำเงิน ต้องไม่หยุด — REPLICATE/SCALE") for the exact
 * output Experiment Agent produces — a proven copy pattern.
 *
 * Rule: only acts once at least one experiment has status='won'. No
 * "won" experiment yet → does nothing and says so plainly (never invents
 * a pattern to scale). Once there is one, applies the SAME transformation
 * to other products that haven't received it yet, using the same
 * append-only content-row mechanism as Experiment Agent (old rows never
 * touched, always reversible).
 *
 * Deliberately duplicates buildVariantCopy() rather than importing it
 * from experiment-agent.js — Growth Agent is "replicate a validated
 * pattern", not "inherit whatever Experiment Agent's logic happens to be
 * today"; keeping them independent means a future change to Experiment
 * Agent's hypothesis logic can't silently change what Growth Agent scales.
 */

import { writeMemory, nowIso } from '../db.js';

const MAX_GROWTH_ACTIONS_PER_RUN = 5;

function buildVariantCopy(product, content) {
  const priceText = product.price ? `ราคา ${product.price}` : '';
  const ratingText = product.rating ? `⭐ ${product.rating}/5` : '';
  const categoryText = product.category_th || product.category || '';

  const afterSeoTitle = priceText
    ? `${content.seo_title || product.product_name} (${[priceText, ratingText].filter(Boolean).join(' ')})`
    : (content.seo_title || product.product_name);

  const bits = [product.product_name, priceText, ratingText, categoryText].filter(Boolean);
  const tail = content.meta_description ? content.meta_description.slice(0, 80) : 'ดูรีวิวเต็มและซื้อสินค้าได้ที่นี่';
  const afterMetaDescription = `${bits.join(' · ')} — ${tail}`.slice(0, 160);

  return { afterSeoTitle, afterMetaDescription };
}

export async function executeGrowthCycle(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const { results: wonExperiments } = await env.DB.prepare(
    `SELECT * FROM experiments WHERE status = 'won' ORDER BY evaluated_at DESC`
  ).all();

  if (!wonExperiments.length) {
    const report = {
      generatedAt: nowIso(),
      status: 'NO_PROVEN_PATTERN_YET',
      note: 'ยังไม่มีการทดลองไหนถูกตัดสินว่า "ชนะ" (won) เลย — ตามข้อ 7 ของสเปค ต้องมี winner ที่พิสูจน์แล้วก่อนถึงจะ replicate/scale ได้ ยังไม่ควรขยายผลอะไรตอนนี้ (ห้ามเดา)',
      appliedActions: [],
      recentActions: []
    };
    await writeMemory(env, 'growth_reports', 'latest', report, 'growth');
    return report;
  }

  const sourceExperiment = wonExperiments[0];

  const { results: candidates } = await env.DB.prepare(`
    SELECT p.id as productId, p.product_name, p.price, p.rating, p.category, p.category_th,
           c.id as contentId, c.seo_title, c.meta_description, c.slug, c.blog_draft,
           c.primary_keyword, c.tags, c.faq, c.comparison, c.alternatives, c.review,
           c.buying_guide, c.blog_outline, c.language, c.buy_link, c.quality_score,
           c.quality_tier, c.quality_warnings
    FROM products p
    INNER JOIN (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY generated_at DESC, id DESC) as rn
      FROM content WHERE language = 'th'
    ) c ON c.product_id = p.id AND c.rn = 1
    WHERE p.pipeline_status IN ('enriched', 'published')
      AND c.slug IS NOT NULL AND c.slug != ''
      AND c.blog_draft IS NOT NULL AND c.blog_draft != ''
      AND (c.seo_title IS NULL OR c.seo_title NOT LIKE '%(ราคา%')
      AND NOT EXISTS (SELECT 1 FROM experiments e WHERE e.product_id = CAST(p.id AS TEXT) AND e.status = 'running')
    LIMIT 200
  `).all();

  const applied = [];
  for (const candidate of candidates) {
    if (applied.length >= MAX_GROWTH_ACTIONS_PER_RUN) break;
    if (!candidate.price) continue;

    const { afterSeoTitle, afterMetaDescription } = buildVariantCopy(candidate, candidate);
    if (afterSeoTitle === candidate.seo_title && afterMetaDescription === candidate.meta_description) continue;

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const clicksRow = await env.DB.prepare(
      `SELECT COUNT(*) as n FROM clicks WHERE product_id = ? AND event_type = 'click' AND timestamp >= ?`
    ).bind(String(candidate.productId), since30d).first();
    const convRow = await env.DB.prepare(
      `SELECT COUNT(*) as n FROM conversions WHERE product_id = ? AND timestamp >= ?`
    ).bind(String(candidate.productId), since30d).first();

    const insertResult = await env.DB.prepare(`
      INSERT INTO content (
        product_id, slug, seo_title, meta_description, primary_keyword, tags, faq,
        blog_draft, comparison, alternatives, review, buying_guide, blog_outline,
        generated_at, language, buy_link, quality_score, quality_tier, quality_warnings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      candidate.productId, candidate.slug, afterSeoTitle, afterMetaDescription, candidate.primary_keyword,
      candidate.tags, candidate.faq, candidate.blog_draft, candidate.comparison, candidate.alternatives,
      candidate.review, candidate.buying_guide, candidate.blog_outline, nowIso(), candidate.language,
      candidate.buy_link, candidate.quality_score, candidate.quality_tier, candidate.quality_warnings
    ).run();

    const newContentId = insertResult.meta.last_row_id;

    await env.DB.prepare(`
      INSERT INTO growth_actions (
        source_experiment_id, product_id, language, before_seo_title, after_seo_title,
        before_meta_description, after_meta_description, before_content_id, after_content_id,
        baseline_click_30d, baseline_conversion_30d, applied_at
      ) VALUES (?, ?, 'th', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sourceExperiment.id, String(candidate.productId), candidate.seo_title, afterSeoTitle,
      candidate.meta_description, afterMetaDescription, candidate.contentId, newContentId,
      clicksRow?.n || 0, convRow?.n || 0, nowIso()
    ).run();

    applied.push({
      productId: candidate.productId, productName: candidate.product_name,
      beforeSeoTitle: candidate.seo_title, afterSeoTitle,
      beforeMetaDescription: candidate.meta_description, afterMetaDescription
    });
  }

  const { results: recentActions } = await env.DB.prepare(`
    SELECT g.*, p.product_name FROM growth_actions g
    LEFT JOIN products p ON CAST(g.product_id AS INTEGER) = p.id
    ORDER BY g.applied_at DESC LIMIT 20
  `).all();

  const report = {
    generatedAt: nowIso(),
    status: 'SCALING',
    sourceExperiment: {
      id: sourceExperiment.id, productId: sourceExperiment.product_id,
      hypothesis: sourceExperiment.hypothesis, resultNote: sourceExperiment.result_note
    },
    note: `ใช้สูตรที่พิสูจน์แล้วจาก experiment #${sourceExperiment.id} (ใส่ราคา/rating ใน seo_title/meta_description) ขยายผลไปยังสินค้าอื่นที่ยังไม่เคยได้รับสูตรนี้ สูงสุด ${MAX_GROWTH_ACTIONS_PER_RUN} รายการ/รอบ — append-only เหมือนเดิม ย้อนกลับได้เสมอ`,
    applied,
    recentActions: recentActions.map(r => ({
      id: r.id, productId: r.product_id, productName: r.product_name || `Product #${r.product_id}`,
      appliedAt: r.applied_at, baselineClick30d: r.baseline_click_30d, baselineConversion30d: r.baseline_conversion_30d
    }))
  };

  await writeMemory(env, 'growth_reports', 'latest', report, 'growth');
  return report;
}
