/**
 * functions/_lib/agents/handlers/experiment-agent.js — GRAVITY ARS STEP 2 (slice 5)
 * ---------------------------------------------------------------------------
 * The Experiment Agent's first real capability: implements spec section 8
 * ("เมื่อระบบไม่รู้ ต้องทดลอง ห้ามเดา") for the exact gap Conversion Agent
 * surfaces — products with real clicks but zero conversions.
 *
 * WHAT IT CHANGES, and why it's safe:
 *   - `content` (meta_description) is the ONLY thing touched.
 *     This is copy the system itself wrote — not real-world data like
 *     product_name/price/affiliate_link, which come straight from Amazon
 *     and must stay 100% truthful/unmodified (Amazon Associates terms +
 *     the spec's "never invent values" rule both require this).
 *   - `content` is append-only and the live site always joins the LATEST
 *     row per product+language (see d1-articles.js). So "running an
 *     experiment" here means INSERT a new row — the old one is never
 *     touched, so rollback is always possible by construction.
 *   - The new copy is built ONLY from real product fields already on the
 *     page (price, rating, category) — reformatted, not fabricated.
 *
 * 🔧 GRAVITY FIX (2026-09-20): เดิมต่อท้าย seo_title ด้วย "(ราคา X ⭐ Y/5)"
 * ทำให้ชื่อบทความดูเป็น template ซ้ำกันทุกหน้า และตัวเลขราคาอาจล้าสมัย —
 * ปิดแล้ว (APPEND_PRICE_RATING_TO_TITLE = false) seo_title ไม่ถูกแก้อีก
 *
 * WHAT IT DOES NOT DO: touch price/product_name/affiliate_link, run more
 * than MAX_NEW_EXPERIMENTS_PER_RUN new experiments per cycle, or call any
 * AI model (none is wired into any agent yet — this is a deterministic,
 * rule-based rewrite, which is itself disclosed in the report).
 */

import { writeMemory, readMemory, nowIso } from '../db.js';

const MIN_EXPERIMENT_DAYS = 3;
const MIN_CLICKS_FOR_DECISION = 10;
const MAX_NEW_EXPERIMENTS_PER_RUN = 3;
const APPEND_PRICE_RATING_TO_TITLE = false;

function buildVariantCopy(product, content) {
  const priceText = product.price ? `ราคา ${product.price}` : '';
  const ratingText = product.rating ? `⭐ ${product.rating}/5` : '';
  const categoryText = product.category_th || product.category || '';

  const baseTitle = content.seo_title || product.product_name;
  const afterSeoTitle = (APPEND_PRICE_RATING_TO_TITLE && priceText)
    ? `${baseTitle} (${[priceText, ratingText].filter(Boolean).join(' ')})`
    : content.seo_title;

  const bits = [product.product_name, priceText, ratingText, categoryText].filter(Boolean);
  const tail = content.meta_description ? content.meta_description.slice(0, 80) : 'ดูรีวิวเต็มและซื้อสินค้าได้ที่นี่';
  const afterMetaDescription = `${bits.join(' · ')} — ${tail}`.slice(0, 160);

  return { afterSeoTitle, afterMetaDescription };
}

// Evaluates every currently-running experiment against real click/conversion
// counts measured SINCE that experiment started — never invents a verdict
// before there's enough data (spec: "ห้ามเดา").
export async function evaluateRunningExperiments(env) {
  const { results: running } = await env.DB.prepare(
    `SELECT * FROM experiments WHERE status = 'running'`
  ).all();

  const evaluated = [];
  const now = Date.now();

  for (const exp of running) {
    const startedMs = new Date(exp.started_at).getTime();
    const daysElapsed = (now - startedMs) / (1000 * 60 * 60 * 24);

    const clicksRow = await env.DB.prepare(
      `SELECT COUNT(*) as n FROM clicks WHERE product_id = ? AND event_type = 'click' AND timestamp >= ?`
    ).bind(exp.product_id, exp.started_at).first();
    const convRow = await env.DB.prepare(
      `SELECT COUNT(*) as n FROM conversions WHERE product_id = ? AND timestamp >= ?`
    ).bind(exp.product_id, exp.started_at).first();

    const resultClick = clicksRow?.n || 0;
    const resultConversion = convRow?.n || 0;

    let status = 'running';
    let note;
    if (daysElapsed < MIN_EXPERIMENT_DAYS) {
      note = `เก็บข้อมูลมา ${daysElapsed.toFixed(1)} วัน (ต้องการอย่างน้อย ${MIN_EXPERIMENT_DAYS} วันก่อนสรุปผล) — click ${resultClick}, conversion ${resultConversion} เท่าที่ผ่านมา`;
    } else if (resultClick < MIN_CLICKS_FOR_DECISION) {
      note = `ผ่านมา ${daysElapsed.toFixed(1)} วันแล้วแต่ click สะสมมีแค่ ${resultClick} ครั้ง (ต้องการอย่างน้อย ${MIN_CLICKS_FOR_DECISION}) ยังสรุปผลไม่ได้อย่างมีนัยสำคัญ`;
    } else if (resultConversion > 0) {
      status = 'won';
      note = `หลัง ${daysElapsed.toFixed(1)} วัน มี click ${resultClick} และเกิด conversion ${resultConversion} ครั้ง (เดิมมี click แต่ conversion=0) — สมมติฐานนี้ดูสมเหตุสมผล ควรพิจารณาคงเวอร์ชันใหม่ไว้`;
    } else {
      status = 'lost';
      note = `หลัง ${daysElapsed.toFixed(1)} วัน มี click ${resultClick} ครั้งแต่ conversion ยังคง 0 — การเปลี่ยน meta_description อย่างเดียวไม่พอ ต้องดูสาเหตุอื่น (ราคา/landing/ตัวสินค้าเอง)`;
    }

    await env.DB.prepare(
      `UPDATE experiments SET result_click_30d = ?, result_conversion_30d = ?, result_note = ?, status = ?, evaluated_at = ? WHERE id = ?`
    ).bind(resultClick, resultConversion, note, status, nowIso(), exp.id).run();

    evaluated.push({ id: exp.id, productId: exp.product_id, status, resultClick, resultConversion, note });
  }

  return evaluated;
}

export async function executeExperimentCycle(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const evaluated = await evaluateRunningExperiments(env);

  const conversionReport = await readMemory(env, 'conversion_reports', 'latest');
  const candidates = conversionReport?.leakage?.productsWithClicksNoConversion || [];

  const created = [];
  for (const candidate of candidates) {
    if (created.length >= MAX_NEW_EXPERIMENTS_PER_RUN) break;

    const productId = candidate.productId;

    const alreadyRunning = await env.DB.prepare(
      `SELECT id FROM experiments WHERE product_id = ? AND status = 'running'`
    ).bind(String(productId)).first();
    if (alreadyRunning) continue;

    const product = await env.DB.prepare(
      `SELECT id, product_name, price, rating, category, category_th FROM products WHERE id = ?`
    ).bind(productId).first();
    if (!product) continue;

    const content = await env.DB.prepare(
      `SELECT * FROM content WHERE product_id = ? AND language = 'th' ORDER BY generated_at DESC, id DESC LIMIT 1`
    ).bind(productId).first();
    if (!content || !content.slug || !content.blog_draft) continue;

    const { afterSeoTitle, afterMetaDescription } = buildVariantCopy(product, content);
    if (afterSeoTitle === content.seo_title && afterMetaDescription === content.meta_description) continue;

    const insertResult = await env.DB.prepare(
      `INSERT INTO content (
        product_id, slug, seo_title, meta_description, primary_keyword, tags, faq,
        blog_draft, comparison, alternatives, review, buying_guide, blog_outline,
        generated_at, language, buy_link, quality_score, quality_tier, quality_warnings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      content.product_id, content.slug, afterSeoTitle, afterMetaDescription, content.primary_keyword,
      content.tags, content.faq, content.blog_draft, content.comparison, content.alternatives,
      content.review, content.buying_guide, content.blog_outline, nowIso(), content.language,
      content.buy_link, content.quality_score, content.quality_tier, content.quality_warnings
    ).run();

    const newContentId = insertResult.meta.last_row_id;

    const hypothesis = `Conversion Agent พบ click ${candidate.clickCount} ครั้งใน 30 วันล่าสุดแต่ conversion=0 — ทดลองว่า meta description ที่ระบุราคา/rating ชัดเจนขึ้นจะช่วยให้ตัดสินใจซื้อง่ายขึ้นหรือไม่ (ทดสอบเฉพาะมุม copy ไม่ใช่ราคา/สินค้าจริงซึ่งไม่เปลี่ยน)`;

    const expInsert = await env.DB.prepare(
      `INSERT INTO experiments (
        product_id, language, hypothesis, before_seo_title, after_seo_title,
        before_meta_description, after_meta_description, before_content_id, after_content_id,
        baseline_click_30d, baseline_conversion_30d, status, started_at
      ) VALUES (?, 'th', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)`
    ).bind(
      String(productId), hypothesis, content.seo_title, afterSeoTitle,
      content.meta_description, afterMetaDescription, content.id, newContentId,
      candidate.clickCount, 0, nowIso()
    ).run();

    created.push({
      experimentId: expInsert.meta.last_row_id,
      productId, productName: product.product_name,
      hypothesis, beforeSeoTitle: content.seo_title, afterSeoTitle,
      beforeMetaDescription: content.meta_description, afterMetaDescription
    });
  }

  const { results: activeRows } = await env.DB.prepare(
    `SELECT e.*, p.product_name FROM experiments e LEFT JOIN products p ON CAST(e.product_id AS INTEGER) = p.id WHERE e.status = 'running' ORDER BY e.started_at DESC LIMIT 20`
  ).all();

  const report = {
    generatedAt: nowIso(),
    note: 'การทดลองเปลี่ยนเฉพาะ meta_description (เนื้อหาที่ระบบเขียนเอง) โดยเพิ่มแถวใหม่ใน content แบบ append-only — ไม่แตะ seo_title/ราคา/ชื่อสินค้า/affiliate_link ที่เป็นข้อมูลจริงจาก Amazon เลย ย้อนกลับได้เสมอเพราะแถวเก่ายังอยู่ครบ',
    evaluated,
    created,
    activeExperiments: activeRows.map(r => ({
      id: r.id, productId: r.product_id, productName: r.product_name || `Product #${r.product_id}`,
      status: r.status, startedAt: r.started_at,
      baselineClick30d: r.baseline_click_30d, baselineConversion30d: r.baseline_conversion_30d
    }))
  };

  await writeMemory(env, 'experiment_reports', 'latest', report, 'experiment');
  return report;
}
