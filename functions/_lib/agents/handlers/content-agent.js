/**
 * functions/_lib/agents/handlers/content-agent.js — GRAVITY ARS STEP 2 (slice 11)
 * ---------------------------------------------------------------------------
 * Content Agent's first real capability: claims pending `agent_tasks` rows
 * addressed to `content` (created by Offer Agent once it matches a
 * backlog product) and assembles a `content` row for that product from
 * data that already exists in this business (products, ai_analysis,
 * keywords, plus the audienceProfile/contentAngles handed down the
 * pipeline) — same rule as every other agent in this chain (see
 * audience-agent.js, offer-agent.js): never invent facts. No external AI
 * API is called here (none of market/opportunity/audience/offer do
 * either, and no such credential exists yet — adding one is a separate,
 * explicit decision per spec section 13, not assumed here).
 *
 * Because there's no LLM doing free-form writing, "blog_draft" etc. are
 * structured assemblies of the real signals available (target audience,
 * pros/cons, search intent, price, rating) rather than prose paragraphs.
 * quality_score/quality_tier/quality_warnings are computed honestly from
 * how much real signal was actually available — a product with thin
 * ai_analysis/keywords data gets a LOW tier and an explicit warning
 * instead of being presented as equally good content.
 *
 * P0.1: instead of one content row per product, this agent now generates
 * a set of deterministic headline/hook variants (see generateHookVariants)
 * and writes ONE content row PER VARIANT — same body content
 * (blog_draft/review/faq/etc.), different seo_title/slug/variant_id/
 * variant_label. This lets downstream steps (e.g. an A/B test or manual
 * pick) choose among real, non-fabricated hook angles instead of only
 * ever getting a single framing. A product with thin signal data
 * legitimately gets fewer variant rows, never padded/fabricated ones.
 *
 * Each run always creates NEW content row(s) (never updates in place) —
 * matching this table's existing append-only convention (see the
 * Experiment Agent's own note about content being append-only), so
 * regenerating content for the same product keeps prior versions intact.
 *
 * Hands off to `media` next in the spec's pipeline (CONTENT → MEDIA),
 * even though no Media Agent handler exists yet — same reasoning as
 * every earlier handoff in this chain: the task sits safely in the queue
 * until that handler is implemented, rather than silently dropped.
 *
 * NOTE: requires the `variant_id` / `variant_label` columns on `content`.
 * Run this D1 migration BEFORE deploying this file:
 *   ALTER TABLE content ADD COLUMN variant_id TEXT;
 *   ALTER TABLE content ADD COLUMN variant_label TEXT;
 */

import { claimNextTask, completeTask, failTask, createTask, writeMemory, nowIso } from '../db.js';

const MAX_TASKS_PER_RUN = 5;

function uniqueNonEmpty(values) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    if (!v) continue;
    const t = String(v).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function slugify(text, productId) {
  const base = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'product'}-${productId}`;
}

// --- P0.1: hook/headline variants — deterministic, no AI, no invented facts.
// Every variant is built only from real signals already assembled by the
// caller. A product with thin data legitimately gets fewer variants
// rather than padded/fabricated ones.
function generateHookVariants(product, primaryKeyword, targetAudienceSignals, painPointSignals, prosSignals) {
  const variants = [];

  variants.push({
    variant_id: 'specificity',
    variant_label: 'เน้นข้อมูลจริง (ชื่อสินค้า + keyword)',
    headline: `${product.product_name}${primaryKeyword ? ` — ${primaryKeyword}` : ''}`.slice(0, 120)
  });

  if (painPointSignals.length) {
    variants.push({
      variant_id: 'problem_first',
      variant_label: 'เน้นปัญหาที่แก้',
      headline: `${painPointSignals[0]}? ${product.product_name} ช่วยแก้ปัญหานี้ได้`.slice(0, 120)
    });
  }

  if (targetAudienceSignals.length) {
    variants.push({
      variant_id: 'audience_curiosity',
      variant_label: 'กระตุ้นคำถามผ่านกลุ่มเป้าหมายจริง',
      headline: `ทำไม ${product.product_name} ถึงเหมาะกับ ${targetAudienceSignals[0]}`.slice(0, 120)
    });
  }

  if (prosSignals.length && product.price) {
    variants.push({
      variant_id: 'value_anchor',
      variant_label: 'เน้นความคุ้มค่า',
      headline: `${product.product_name} ราคา ${product.price} คุ้มกับ${prosSignals[0]}ไหม?`.slice(0, 120)
    });
  }

  return variants;
}

async function assembleOneContent(env, task) {
  let payload;
  try {
    payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {});
  } catch {
    payload = {};
  }
  const { marketId, marketName, category, country, contentAngles, aiReasoning, audienceProfile, productId, productName } = payload;

  if (!productId) {
    throw new Error('Task payload ไม่มี productId — ไม่มีสินค้าให้เขียน content (ควรมาจาก Offer Agent เสมอ)');
  }

  const product = await env.DB.prepare(`
    SELECT id, product_name, brand, category, category_th, price, rating, affiliate_link, image_url
    FROM products WHERE id = ?
  `).bind(productId).first();

  if (!product) {
    throw new Error(`ไม่พบสินค้า id=${productId} ใน products table (ข้อมูลไม่ตรงกัน)`);
  }

  const analysis = await env.DB.prepare(`
    SELECT target_audience, pros, cons FROM ai_analysis
    WHERE product_id = ? AND language = 'th'
    ORDER BY id DESC LIMIT 1
  `).bind(productId).first();

  const kw = await env.DB.prepare(`
    SELECT primary_keyword, supporting_keywords, search_intent, long_tail,
           comparison_keywords, problem_keywords, best_keywords,
           review_keywords, price_keywords, alternative_keywords, faq_keywords
    FROM keywords WHERE product = ?
    ORDER BY id DESC LIMIT 1
  `).bind(productId).first();

  // --- quality scoring: honest about how much real signal exists ---
  let qualityScore = 0;
  const qualityWarnings = [];

  if (analysis?.target_audience || analysis?.pros || analysis?.cons) {
    qualityScore += 35;
  } else {
    qualityWarnings.push('ไม่มีข้อมูล ai_analysis (target_audience/pros/cons) สำหรับสินค้านี้');
  }

  if (kw?.primary_keyword || kw?.search_intent || kw?.problem_keywords) {
    qualityScore += 35;
  } else {
    qualityWarnings.push('ไม่มีข้อมูล keywords (primary_keyword/search_intent/problem_keywords) สำหรับสินค้านี้');
  }

  if (product.price && product.rating) {
    qualityScore += 15;
  } else {
    qualityWarnings.push('สินค้านี้ไม่มีราคาหรือ rating ครบ');
  }

  if (audienceProfile?.confidence === 'MEDIUM_CONFIDENCE') {
    qualityScore += 15;
  } else if (audienceProfile?.confidence === 'LOW_CONFIDENCE') {
    qualityWarnings.push('Audience Agent ให้ confidence เป็น LOW_CONFIDENCE (หมวดสินค้าใหม่ ข้อมูล audience บางเบา)');
  }

  const qualityTier = qualityScore >= 70 ? 'HIGH' : qualityScore >= 40 ? 'MEDIUM' : 'LOW';

  // --- assemble real signals (no invented facts) ---
  const targetAudienceSignals = uniqueNonEmpty([
    analysis?.target_audience,
    ...(audienceProfile?.targetAudienceSignals || [])
  ]);
  const painPointSignals = uniqueNonEmpty([
    analysis?.cons,
    kw?.problem_keywords,
    ...(audienceProfile?.painPointSignals || [])
  ]);
  const prosSignals = uniqueNonEmpty([analysis?.pros]);
  const faqSignals = uniqueNonEmpty([kw?.faq_keywords, ...(audienceProfile?.searchIntentSignals || [])]);
  const tagsSignals = uniqueNonEmpty([kw?.primary_keyword, kw?.supporting_keywords, kw?.best_keywords]);

  const primaryKeyword = kw?.primary_keyword || product.category_th || product.category || product.product_name;
  const metaDescription = [
    product.product_name,
    product.brand ? `จาก ${product.brand}` : null,
    product.price ? `ราคา ${product.price}` : null,
    product.rating ? `เรตติ้ง ${product.rating}/5` : null,
    targetAudienceSignals[0] ? `เหมาะกับ ${targetAudienceSignals[0]}` : null
  ].filter(Boolean).join(' ').slice(0, 160);

  const blogOutline = [
    'บทนำ: แนะนำสินค้าและกลุ่มเป้าหมาย',
    targetAudienceSignals.length ? 'กลุ่มเป้าหมายที่เหมาะกับสินค้านี้' : null,
    painPointSignals.length ? 'ปัญหาที่สินค้านี้ช่วยแก้' : null,
    prosSignals.length ? 'จุดเด่นของสินค้า' : null,
    'ราคาและความคุ้มค่า',
    faqSignals.length ? 'คำถามที่พบบ่อย (FAQ)' : null,
    'สรุปและลิงก์ซื้อสินค้า'
  ].filter(Boolean).join('\n');

  const blogDraft = [
    `# ${product.product_name}`,
    product.brand ? `แบรนด์: ${product.brand}` : null,
    (product.category_th || product.category) ? `หมวดหมู่: ${product.category_th || product.category}` : null,
    '',
    targetAudienceSignals.length ? `## เหมาะกับใคร\n${targetAudienceSignals.join(', ')}` : null,
    painPointSignals.length ? `## ปัญหาที่ช่วยแก้\n${painPointSignals.join(', ')}` : null,
    prosSignals.length ? `## จุดเด่น\n${prosSignals.join(', ')}` : null,
    (product.price || product.rating) ? `## ราคาและเรตติ้ง\n${product.price ? `ราคา ${product.price}` : ''} ${product.rating ? `⭐ ${product.rating}/5` : ''}`.trim() : null
  ].filter(Boolean).join('\n\n');

  const review = prosSignals.length || painPointSignals.length
    ? `จุดเด่น: ${prosSignals.join(', ') || '-'} | ข้อควรพิจารณา: ${painPointSignals.join(', ') || '-'}`
    : null;

  const comparison = kw?.comparison_keywords || null;
  const alternatives = kw?.alternative_keywords || null;
  const buyingGuide = kw?.price_keywords
    ? `สิ่งที่ควรดูก่อนซื้อ: ${kw.price_keywords}`
    : null;
  const faq = faqSignals.length ? faqSignals.join(' | ') : null;
  const tags = tagsSignals.length ? tagsSignals.join(', ') : null;

  // --- P0.1: build variant set, then INSERT one content row per variant.
  // Body fields (blog_draft/review/faq/etc.) are identical across variants
  // on purpose — only the hook (seo_title) + slug + variant_id/label differ.
  const variants = generateHookVariants(product, primaryKeyword, targetAudienceSignals, painPointSignals, prosSignals);

  const variantResults = [];

  for (const variant of variants) {
    const contentRow = {
      product_id: productId,
      slug: `${slugify(product.product_name, productId)}-${variant.variant_id}`,
      seo_title: variant.headline,
      meta_description: metaDescription || null,
      primary_keyword: primaryKeyword || null,
      tags,
      faq,
      blog_draft: blogDraft || null,
      comparison,
      alternatives,
      review,
      buying_guide: buyingGuide,
      blog_outline: blogOutline || null,
      generated_at: nowIso(),
      language: 'th',
      buy_link: product.affiliate_link || null,
      quality_score: qualityScore,
      quality_tier: qualityTier,
      quality_warnings: qualityWarnings.length ? qualityWarnings.join(' | ') : null,
      variant_id: variant.variant_id,
      variant_label: variant.variant_label
    };

    const insertResult = await env.DB.prepare(`
      INSERT INTO content (
        product_id, slug, seo_title, meta_description, primary_keyword, tags, faq,
        blog_draft, comparison, alternatives, review, buying_guide, blog_outline,
        generated_at, language, buy_link, quality_score, quality_tier, quality_warnings,
        variant_id, variant_label
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      contentRow.product_id, contentRow.slug, contentRow.seo_title, contentRow.meta_description,
      contentRow.primary_keyword, contentRow.tags, contentRow.faq, contentRow.blog_draft,
      contentRow.comparison, contentRow.alternatives, contentRow.review, contentRow.buying_guide,
      contentRow.blog_outline, contentRow.generated_at, contentRow.language, contentRow.buy_link,
      contentRow.quality_score, contentRow.quality_tier, contentRow.quality_warnings,
      contentRow.variant_id, contentRow.variant_label
    ).run();

    const contentId = insertResult.meta?.last_row_id ?? null;

    variantResults.push({
      contentId,
      variantId: variant.variant_id,
      variantLabel: variant.variant_label,
      seoTitle: variant.headline
    });
  }

  // Primary content row = the always-present 'specificity' variant.
  // Used for the media handoff payload (imageUrl etc. don't vary by variant).
  const primaryVariant = variantResults.find(v => v.variantId === 'specificity') || variantResults[0];

  const result = {
    marketId, marketName, category, country, productId, productName: product.product_name,
    status: 'CONTENT_CREATED',
    contentId: primaryVariant?.contentId ?? null,
    variants: variantResults,
    qualityScore, qualityTier, qualityWarnings,
    note: `สร้าง content ${variantResults.length} variant สำหรับสินค้า "${product.product_name}" สำเร็จ (คุณภาพ: ${qualityTier}, คะแนน ${qualityScore}/100) — ประกอบจากข้อมูลจริงใน ai_analysis/keywords ไม่ได้แต่งขึ้นเอง`
  };

  await writeMemory(env, 'content_reports', `product_${productId}`, result, 'content');

  const createdTask = await createTask(env, {
    senderAgent: 'content',
    receiverAgent: 'media',
    messageType: 'content_ready',
    priority: 6,
    payload: {
      marketId, marketName, category, country,
      productId, productName: product.product_name,
      contentId: primaryVariant?.contentId ?? null,
      variantContentIds: variantResults.map(v => v.contentId),
      imageUrl: product.image_url
    }
  });

  return { ...result, nextTaskId: createdTask.id };
}

export async function executeContentGeneration(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const processed = [];
  const failed = [];

  for (let i = 0; i < MAX_TASKS_PER_RUN; i++) {
    const claimed = await claimNextTask(env, 'content');
    if (!claimed) break;

    try {
      const result = await assembleOneContent(env, claimed);
      await completeTask(env, claimed.id, result);
      processed.push(result);
    } catch (err) {
      const msg = err.message || String(err);
      await failTask(env, claimed.id, msg);
      failed.push({ taskId: claimed.id, error: msg });
    }
  }

  const report = {
    generatedAt: nowIso(),
    status: processed.length ? 'PROCESSED' : (failed.length ? 'ERRORS' : 'NO_PENDING_TASKS'),
    note: processed.length
      ? `สร้าง content สำเร็จ ${processed.length} รายการ (สินค้า) ส่งต่อ Media Agent แล้วทุกรายการ`
      : (failed.length ? `พยายามแล้วแต่ล้มเหลว ${failed.length} รายการ` : 'ไม่มี task ค้างอยู่ในคิวสำหรับ content ตอนนี้'),
    processed, failed
  };

  await writeMemory(env, 'content_reports', 'latest', report, 'content');
  return report;
}