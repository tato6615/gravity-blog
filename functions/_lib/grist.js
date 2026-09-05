/**
 * Shared Grist read layer for the GRAVITY_OS public blog (Cloudflare Pages).
 *
 * READ-ONLY, separate from worker.js — the blog never writes to Grist.
 * Requires GRIST_API_KEY, GRIST_DOC_ID as Pages environment variables.
 *
 * "Live" = pipeline_status is 'enriched' or 'published'. We treat 'enriched'
 * as live on purpose: the site is meant to update automatically the moment
 * Generate Everything finishes, with no separate manual publish step.
 *
 * Bilingual: CONTENT has one row per product PER LANGUAGE (content_th /
 * content_en steps in worker.js). AI_ANALYSIS follows the same pattern
 * (analysis_th / analysis_en steps in worker.js) — one row per product
 * PER LANGUAGE, with a `language` column. Every read here takes a `lang`
 * param and filters both CONTENT and AI_ANALYSIS rows by that language,
 * so th/en never mix.
 *
 * --- GRAVITY FIX (2026-08-22): quality_tier is now enforced here ---
 * pipeline.js's content_th/content_en steps have computed quality_score /
 * quality_tier / quality_warnings (via scoreReviewMarketFit) for a while,
 * but until now nothing ever read them back — LIVE_STATUSES alone decided
 * whether a product showed up on the site, so AI-flagged low-quality
 * content (generic "มีคุณภาพดีและราคาเหมาะสม"-style boilerplate) went live
 * exactly the same as everything else. getLiveArticles() now also checks
 * CONTENT.quality_tier/quality_score and skips products that don't meet the
 * bar, the same way it already skips products missing slug/blog_draft.
 *
 * --- GRAVITY FIX (2026-08-22c): quality gate was silently a no-op ---
 * The first version of this fix (above) compared `quality_tier` against a
 * guessed set of plain lowercase strings — 'poor'/'low'/'reject'/'fail' —
 * because ai-prompt.js wasn't available yet when it was written. Now that
 * ai-prompt.js has been reviewed, scoreReviewMarketFit() actually returns
 * tier as an EMOJI-PREFIXED string, e.g. '❌ Poor', '⚠️ Fair', '✅ Good',
 * '⭐ Very Good', '🏆 Excellent'. `'❌ Poor'.toLowerCase()` is '❌ poor', which
 * never matched the plain 'poor' string in the old Set via exact
 * Set.has() equality — so the gate NEVER rejected anything, silently,
 * since the day it was deployed.
 *
 * Fixed properly by gating on `quality_score` (a plain number, always
 * reliable) against the SAME threshold (`>= 70`) that ai-prompt.js's own
 * `scoreReviewMarketFit().publishable` flag uses — instead of pattern-
 * matching a display string that can change wording/emoji independently.
 * This also corrects a second bug in the original guess: 'Fair' (60-69)
 * was never in the rejected set at all, even though a 60-69 score is
 * NOT publishable by ai-prompt.js's own definition. Tier string matching
 * is kept ONLY as a fallback for old rows that might have quality_tier
 * populated without quality_score (shouldn't happen going forward, since
 * pipeline.js always sets both together, but this keeps the gate from
 * going fail-open if that ever occurs).
 *
 * Products generated BEFORE quality scoring existed at all may have
 * NEITHER quality_score NOR quality_tier populated — those are treated as
 * passing (no score/tier == never rejected), so nothing existing suddenly
 * disappears. Run handleResetPipeline({ productId, toStep: 2 }) from the
 * admin side to backfill quality scoring for old products if you want
 * them re-evaluated under the real gate.
 *
 * --- GRAVITY FIX (2026-09-03): D1 fallback cache when Grist itself is down ---
 * See readFallbackArticles()/writeFallbackArticles() and the try/catch
 * inside getLiveArticles() below. Summary: the 5-minute Cache API layer
 * only survives 5 minutes — once it expires, a Grist outage (daily OR
 * monthly 429) used to throw straight through to homepage.js, which
 * showed a bare error page to every visitor instead of the article list.
 * Now every successful live fetch also writes a durable copy to D1, and
 * a failed live fetch reads that copy back before giving up, so visitors
 * see (slightly stale) articles instead of an outage page.
 */

const GRIST_BASE = 'https://docs.getgrist.com/api/docs';
const LIVE_STATUSES = new Set(['enriched', 'published']);

// GRAVITY FIX (2026-08-22c): the real publish threshold, matching
// ai-prompt.js's scoreReviewMarketFit() -> `publishable = totalScore >= 70`
// exactly. Keep these in sync if that threshold ever changes there.
const MIN_PUBLISHABLE_QUALITY_SCORE = 70;

// Fallback only — used when quality_score is missing but quality_tier
// isn't (shouldn't normally happen). Matched via substring/includes, NOT
// exact equality, since real tier strings are emoji-prefixed (e.g.
// '❌ Poor', '⚠️ Fair') and exact-matching a bare word here silently never
// matches, which is exactly the bug this fix corrects.
const REJECTED_TIER_SUBSTRINGS = ['poor', 'fair'];

// GRAVITY FIX (2026-08-22d): grandfather clause for the quality gate above.
// The gate was silently a no-op (see 2026-08-22c note in the file header)
// from the day it was deployed until it got fixed today — meaning every
// product ever generated up to now went live regardless of its actual
// quality_score, and nobody ever had to write content that clears 70 to
// get published. Flipping the gate on and immediately re-judging the
// ENTIRE existing catalog against that bar at once caused most/all of the
// site to disappear the moment this fix shipped, which is worse than the
// no-op bug it was meant to fix.
//
// To avoid that, content generated before the gate actually started
// enforcing is grandfathered in — it's exempt from the quality check
// entirely, the same way content with no quality_score/quality_tier at
// all already was. Only content generated FROM THIS POINT ON is held to
// the real >= 70 threshold. This is intentionally temporary: once old
// content has been reviewed/backfilled (see handleResetPipeline note in
// the file header), this constant and its use below should be removed so
// every product is judged by the same rule.
const QUALITY_GATE_ENFORCED_SINCE = new Date('2026-08-22T00:00:00Z');

export async function gristFetch(env, path) {
  const res = await fetch(`${GRIST_BASE}/${env.GRIST_DOC_ID}${path}`, {
    headers: { Authorization: `Bearer ${env.GRIST_API_KEY}` }
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`Grist ${res.status} @ ${path}: ${json.error || text}`);
  return json;
}

async function fetchTableRecords(env, tableId) {
  const res = await gristFetch(env, `/tables/${tableId}/records`);
  return res.records || [];
}

// 03_PRODUCTS column ids aren't fixed across docs, so pick the first
// plausible match instead of hardcoding — same approach worker.js uses.
function pickField(fields, candidates) {
  for (const c of candidates) {
    for (const key of Object.keys(fields)) {
      if (key.toLowerCase() === c.toLowerCase() && fields[key] != null && fields[key] !== '') {
        return fields[key];
      }
    }
  }
  return null;
}

async function findProductsTableId(env) {
  const res = await gristFetch(env, '/tables');
  const t = (res.tables || []).find(t => /PRODUCT/i.test(t.id));
  if (!t) throw new Error('หาตาราง 03_PRODUCTS ไม่เจอ');
  return t.id;
}

// Splits a gallery field into a clean URL array. Grist may return this
// as a JSON array string (e.g. '["url1","url2"]', as seen in the
// "Gallery Image ..." column on PRODUCTS) or a plain comma/newline
// separated list — handle both, and an already-real array too.
function parseGallery(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  const str = String(raw).trim();
  if (str.startsWith('[')) {
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) return arr.filter(Boolean);
    } catch { /* fall through to plain split */ }
  }
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

// Products are imported from different regional marketplaces, so the raw
// `price` string coming out of Grist can be "$16.19", "JPY 3,078",
// "HKD 2,579.46", "KRW 74,457", etc. — whatever currency that market's
// listing was in. Rendering that raw string next to other products'
// prices (which are in different currencies) is misleading, so we parse
// out an explicit ISO currency code here. When nothing matches, both
// fields come back null — callers should treat that as "don't render a
// price" rather than silently assuming USD.
const CURRENCY_PATTERNS = [
  { code: 'USD', re: /^\$\s?([\d,]+\.?\d*)/ },
  { code: 'GBP', re: /£\s?([\d,]+\.?\d*)/ },
  { code: 'EUR', re: /€\s?([\d,]+\.?\d*)/ },
  { code: 'JPY', re: /JPY\s?([\d,]+\.?\d*)/i },
  { code: 'HKD', re: /HKD\s?([\d,]+\.?\d*)/i },
  { code: 'KRW', re: /KRW\s?([\d,]+\.?\d*)/i },
  { code: 'THB', re: /(?:THB|฿)\s?([\d,]+\.?\d*)/i },
];

function parsePrice(raw) {
  if (!raw) return { amount: null, currency: null };
  const str = String(raw).trim();
  for (const { code, re } of CURRENCY_PATTERNS) {
    const m = str.match(re);
    if (m) return { amount: Number(m[1].replace(/,/g, '')), currency: code };
  }
  return { amount: null, currency: null };
}

function normalizeProduct(fields) {
  // rating is optional — only shows in the UI when a real number is
  // entered in Grist. No fallback/mock value here on purpose: showing a
  // made-up star rating would be a misleading claim about the product.
  const rawRating = pickField(fields, ['rating', 'score']);
  const rating = rawRating != null && rawRating !== '' && !isNaN(Number(rawRating))
    ? Number(rawRating)
    : null;

  const image = pickField(fields, ['image', 'image_url', 'photo']) || null;
  const galleryRaw = pickField(fields, ['gallery_images', 'gallery_image_urls', 'gallery', 'images', 'photos']);
  const priceRaw = pickField(fields, ['price']) || null;
  const { amount: priceAmount, currency: priceCurrency } = parsePrice(priceRaw);

  return {
    name: pickField(fields, ['name', 'product_name', 'title']) || 'สินค้าไม่มีชื่อ',
    brand: pickField(fields, ['brand']) || '',
    // kept as-is for backward compat with any template still reading the
    // raw string directly (e.g. homepage.js) — but prefer priceAmount /
    // priceCurrency below for anything display-facing or schema-facing.
    price: priceRaw,
    priceAmount,
    priceCurrency,
    image,
    // article.js reads image_url specifically for og:image — keep both
    // keys pointing at the same value so neither caller breaks.
    image_url: image,
    gallery: parseGallery(galleryRaw),
    rating,
    // 'affiliate_link' is the real column on PRODUCTS — source_url/url/
    // product_url are kept as fallbacks for other doc shapes.
    buyUrl: pickField(fields, ['affiliate_link', 'source_url', 'url', 'product_url']) || null
  };
}

// GRAVITY FIX (2026-08-22c): the real gate. Prefers quality_score (a plain
// number set by pipeline.js alongside quality_tier) since it's threshold-
// comparable and immune to string/emoji drift. Falls back to substring-
// matching quality_tier only if score is missing but tier isn't. Returns
// false (do not reject / fail-open) when neither is present, so products
// generated before quality scoring existed are unaffected.
function isBelowPublishableQuality(contentFields) {
  const score = contentFields.quality_score;
  if (score != null && score !== '' && !isNaN(Number(score))) {
    return Number(score) < MIN_PUBLISHABLE_QUALITY_SCORE;
  }
  const tier = contentFields.quality_tier;
  if (tier) {
    const tierLower = String(tier).toLowerCase();
    return REJECTED_TIER_SUBSTRINGS.some(s => tierLower.includes(s));
  }
  return false;
}

// ─── GRAVITY FIX (2026-09-03): D1 fallback cache สำหรับตอน Grist ล่ม ───────
// ปัญหาเดิม: getLiveArticles() cache แค่ 5 นาที (Cache API) พอหมดอายุแล้ว
// Grist ตอบ 429 (ไม่ว่าจะ daily limit ต่อเอกสาร หรือ monthly limit ต่อ site)
// โค้ดจะ throw ทันที ไม่มีที่พึ่ง -> homepage.js เห็น errorMsg -> ทั้งเว็บ
// กลายเป็นหน้า error แทนรายการบทความ ทั้งที่จริงๆ มีข้อมูลบทความอยู่แล้ว
// แค่ดึงรอบใหม่ไม่ได้ชั่วคราวเท่านั้น
//
// แก้โดยเพิ่ม "ชั้นสำรอง" ที่ทนกว่า edge cache: ทุกครั้งที่ getLiveArticles()
// ดึง Grist สำเร็จ จะบันทึกสำเนาผลลัพธ์ล่าสุดลง D1 (ไม่มีวันหมดอายุเอง)
// ควบคู่ไปกับ edge cache 5 นาทีเดิม แล้วถ้ารอบไหน live fetch ล้ม (throw)
// ก่อนจะยอม throw ต่อให้ homepage.js เห็น error จะลองอ่านสำเนาล่าสุดจาก D1
// มาคืนค่าแทนก่อนเสมอ — ผู้ใช้จะเห็นบทความ (อาจเก่ากว่าปกตินิดหน่อย) แทน
// หน้า error เปล่าๆ
//
// Fail-safe: ทุกจุดที่แตะ D1 ในนี้ครอบ try/catch หมด — ถ้า D1 เองมีปัญหาด้วย
// (ไม่น่าเกิดพร้อมกับ Grist แต่กันไว้) จะแค่ return null / ไม่ทำอะไร แล้วปล่อย
// ให้ error เดิมจาก Grist หลุดออกไปตามปกติ ไม่ทำให้พังหนักกว่าเดิม
//
// ⚠️ ต้องรัน migration สร้างตาราง D1 ก่อน (ดูไฟล์
// 001_create_articles_fallback_cache.sql ที่มาคู่กับไฟล์นี้) ไม่งั้น
// readFallbackArticles/writeFallbackArticles จะ fail เงียบๆ (ตาม design)
// และ fallback จะไม่ทำงาน — โค้ดจะไม่พังเพิ่ม แต่ก็จะยังไม่ได้ประโยชน์จากมัน
const FALLBACK_CACHE_TABLE = 'articles_fallback_cache';

async function readFallbackArticles(env, lang) {
  if (!env.DB) return null;
  try {
    const row = await env.DB.prepare(
      `SELECT data, updated_at FROM ${FALLBACK_CACHE_TABLE} WHERE lang = ?`
    ).bind(lang).first();
    if (!row) return null;
    return { articles: JSON.parse(row.data), updatedAt: row.updated_at };
  } catch (e) {
    return null;
  }
}

async function writeFallbackArticles(env, lang, articles) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `INSERT INTO ${FALLBACK_CACHE_TABLE} (lang, data, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(lang) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).bind(lang, JSON.stringify(articles), new Date().toISOString()).run();
  } catch (e) {
    // best-effort เท่านั้น — ห้ามให้การบันทึก fallback ล้มเหลวจนกระทบ live fetch ที่สำเร็จอยู่แล้ว
  }
}

/**
 * Joins 03_PRODUCTS + CONTENT + AI_ANALYSIS for every "live" product in
 * the given language.
 * @param {object} env
 * @param {'th'|'en'} [lang]
 */
export async function getLiveArticles(env, lang = 'th') {
  // Cache the full Grist join (4 API calls: /tables + PRODUCTS + CONTENT +
  // AI_ANALYSIS) for 5 min, shared across every caller — homepage.js AND
  // getArticleBySlug() below both hit this same function. Grist free plan
  // caps at 5,000 calls/doc/day + 5 req/sec; without a cache here, every
  // single product-page view alone burns 4 calls with zero reuse.
  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/live-articles-${lang}`);
  const cached = await cache.match(cacheKey);
  if (cached) return await cached.json();

  let articles;
  try {
    const productsTableId = await findProductsTableId(env);
    const [products, content, analysis] = await Promise.all([
      fetchTableRecords(env, productsTableId),
      // NOTE: the table is named "CONTENT" in worker.js (no "AI_" prefix —
      // see STAGE_TABLES / TABLE_DEFS there). Using "AI_CONTENT" here would
      // 404 against Grist and take the whole Promise.all down with it.
      fetchTableRecords(env, 'CONTENT'),
      fetchTableRecords(env, 'AI_ANALYSIS')
    ]);

    // CONTENT has TWO rows per product — one per language ('th' and 'en',
    // see the content_th / content_en pipeline steps in worker.js). Filter
    // by the requested lang so th/en never mix or overwrite each other.
    //
    // IMPORTANT: CONTENT.product is a plain Text column in Grist (not a
    // Ref:PRODUCTS link like AI_ANALYSIS.product is), so its value comes
    // back as a STRING (e.g. "1"). p.id from the PRODUCTS table is always
    // a NUMBER. Without String(...) on both sides, contentByProduct.get(p.id)
    // fails a strict-equality Map lookup every single time — normalize
    // both sides to String to fix the join.
    const contentByProduct = new Map(
      content
        .filter(r => r.fields.language === lang)
        .map(r => [String(r.fields.product), r.fields])
    );

    // AI_ANALYSIS follows the same bilingual pattern as CONTENT (analysis_th
    // / analysis_en pipeline steps in worker.js) — one row per product PER
    // LANGUAGE, with a `language` column. Filter by lang here too so th/en
    // analysis (pros/cons/target_audience) never mix, matching how CONTENT
    // is filtered above.
    const analysisByProduct = new Map(
      analysis
        .filter(r => r.fields.language === lang)
        .map(r => [String(r.fields.product), r.fields])
    );

    articles = [];
    for (const p of products) {
      const status = p.fields.pipeline_status;
      if (!LIVE_STATUSES.has(status)) continue;
      const c = contentByProduct.get(String(p.id));
      if (!c || !c.slug || !c.blog_draft) continue; // not enriched enough to show yet

      // GRAVITY FIX (2026-08-22 / corrected 2026-08-22c): honor the quality
      // score scoreReviewMarketFit() already computed in pipeline.js instead
      // of ignoring it. Absent score/tier is treated as "pass" (fail-open),
      // matching how missing columns are handled everywhere else in this
      // file. See file header for why this now checks quality_score instead
      // of pattern-matching the emoji-prefixed tier string.
      //
      // GRAVITY FIX (2026-08-22d): grandfather clause — only enforce the
      // gate on content generated after it started actually working. See
      // QUALITY_GATE_ENFORCED_SINCE above for why: retroactively applying
      // this to the whole existing catalog at once was what emptied the
      // homepage. Content with no generated_at at all is also grandfathered
      // in (treated as old), matching the fail-open behavior used elsewhere.
      const generatedAt = c.generated_at ? new Date(c.generated_at) : null;
      const isGrandfathered = !generatedAt || generatedAt < QUALITY_GATE_ENFORCED_SINCE;
      if (!isGrandfathered && isBelowPublishableQuality(c)) {
        continue;
      }

      articles.push({
        id: p.id,
        slug: c.slug,
        product: normalizeProduct(p.fields),
        seoTitle: c.seo_title || c.slug,
        metaDescription: c.meta_description || '',
        blogDraft: c.blog_draft || '',
        faq: c.faq || '',
        buyingGuide: c.buying_guide || '',
        tags: (c.tags || '').split(',').map(s => s.trim()).filter(Boolean),
        createdAt: c.generated_at || null,
        updatedAt: p.fields.updated_at || c.generated_at || null,
        authorId: c.reviewer_id || c.author_id || null,
        category: p.fields.category || null,
        // ⭐ คำแปลหมวดภาษาไทยจาก AI pipeline (ถ้ามี) ต้นทางเดียวกับ
        // category (EN) แต่เป็นคนละคอลัมน์ใน PRODUCTS. ตั้งแต่ 2026-08-22
        // import.js สั่งให้ AI เขียนคอลัมน์นี้คู่กับ category ทุกครั้งที่
        // import สินค้าใหม่ (ดู import.js) — สินค้าเก่าก่อนหน้านั้นอาจยังว่าง
        // อยู่ ซึ่ง pickField() คืน null เฉยๆ ไม่ throw ตัวรับ (homepage.js)
        // จะ fallback เป็น dictionary hardcode หรือ EN เองเวลาค่านี้เป็น null
        categoryTh: pickField(p.fields, ['category_th', 'category_thai', 'categorythai']) || null,
        // Surfaced mainly for admin/debug use — not currently read by
        // homepage.js, but useful if you want to show a "quality" badge
        // later without another Grist round-trip.
        qualityTier: c.quality_tier || null,
        qualityScore: c.quality_score != null ? Number(c.quality_score) : null,
        analysis: analysisByProduct.get(String(p.id)) || null
      });
    }

    articles.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  } catch (liveError) {
    // Grist ล้ม (429/quota/network/ฯลฯ) — ก่อนยอม throw ให้ homepage.js
    // เห็น error ลองดึงสำเนาล่าสุดที่เคยดึงสำเร็จจาก D1 มาโชว์แทนก่อนเสมอ
    const fallback = await readFallbackArticles(env, lang);
    if (fallback) {
      console.error(
        `getLiveArticles: live fetch failed (${liveError.message}), serving D1 fallback from ${fallback.updatedAt}`
      );
      return fallback.articles;
    }
    throw liveError;
  }

  const cacheResp = new Response(JSON.stringify(articles), {
    headers: { 'Cache-Control': 'max-age=300', 'content-type': 'application/json' }
  });
  await cache.put(cacheKey, cacheResp);

  // ดึงสำเร็จรอบนี้ -> เก็บสำเนาไว้ใน D1 ทับของเก่า เผื่อรอบถัดไป Grist ล่ม
  await writeFallbackArticles(env, lang, articles);

  return articles;
}

/**
 * @param {object} env
 * @param {string} slug
 * @param {'th'|'en'} [lang]
 */
export async function getArticleBySlug(env, slug, lang = 'th') {
  const articles = await getLiveArticles(env, lang);
  return articles.find(a => a.slug === slug) || null;
}

/**
 * Returns which languages a given product has published CONTENT for,
 * mapped to that language's slug — e.g. { th: 'my-slug-th', en: 'my-slug-en' }.
 * Used by article.js to build the TH/EN switcher link. Best-effort: on
 * failure the caller just skips the switcher rather than failing the page.
 * @param {object} env
 * @param {number} productId
 */
export async function getAvailableLanguages(env, productId) {
  const content = await fetchTableRecords(env, 'CONTENT');
  const result = {};
  for (const r of content) {
    if (String(r.fields.product) !== String(productId)) continue;
    const lang = r.fields.language;
    if (lang && r.fields.slug) result[lang] = r.fields.slug;
  }
  return result;
}
// ─── GRAVITY FIX (2026-09-05): cache + D1 fallback for the raw PRODUCTS
// table, shared by getProductBuyUrlById() and getProductNamesByIds() ───────
// Both functions used to call findProductsTableId() + fetchTableRecords()
// fresh on EVERY call — with zero caching, unlike getLiveArticles() which
// already cached its (bigger) join for 5 minutes. That meant:
//   1. Every single affiliate-link click (/go/[id]) burned 2 Grist API
//      calls, all day, every day — the single biggest per-visit driver of
//      API usage on the whole site, and pure waste since PRODUCTS barely
//      changes minute-to-minute.
//   2. When Grist was down (429/quota), /go/[id] had NO fallback at all —
//      it just threw, and the visitor got a raw 500 error page instead of
//      being redirected to the merchant. That's worse than the homepage
//      going down, because it silently costs real affiliate commission on
//      every single click during any Grist outage, not just page views.
//
// getCachedProducts() below adds the same 5-min edge-cache pattern
// getLiveArticles() already uses. getProductBuyUrlById() now also falls
// back to the D1 articles_fallback_cache (same table getLiveArticles()
// already maintains) when the live PRODUCTS fetch itself fails, so a
// Grist outage degrades to "maybe slightly stale buy link" instead of
// "broken link, lost commission".
async function getCachedProducts(env) {
  const cache = caches.default;
  const cacheKey = new Request('https://cache.internal/products-raw');
  const cached = await cache.match(cacheKey);
  if (cached) return await cached.json();

  const productsTableId = await findProductsTableId(env);
  const products = await fetchTableRecords(env, productsTableId);

  const cacheResp = new Response(JSON.stringify(products), {
    headers: { 'Cache-Control': 'max-age=300', 'content-type': 'application/json' }
  });
  await cache.put(cacheKey, cacheResp);

  return products;
}

// Best-effort search through whichever D1 fallback languages exist
// (see readFallbackArticles() above — same table getLiveArticles() writes
// to on every successful live fetch) for a product's buyUrl. Used only
// when the live PRODUCTS fetch itself fails (network/429/etc), not when
// a product is simply genuinely absent from a successful live fetch.
async function getBuyUrlFromFallbackCache(env, productId) {
  for (const lang of ['th', 'en']) {
    const fallback = await readFallbackArticles(env, lang);
    if (!fallback) continue;
    const match = fallback.articles.find(a => Number(a.id) === Number(productId));
    if (match && match.product && match.product.buyUrl) {
      return match.product.buyUrl;
    }
  }
  return null;
}

/**
 * Looks up a single product's buyUrl by its Grist row id — used by the
 * /go/[id] redirect function. Doesn't require the product to have live
 * CONTENT/slug (unlike getLiveArticles) — just needs to exist in
 * PRODUCTS with an affiliate_link.
 * @param {object} env
 * @param {number|string} productId
 */
export async function getProductBuyUrlById(env, productId) {
  try {
    const products = await getCachedProducts(env);
    const row = products.find(p => Number(p.id) === Number(productId));
    // Genuinely not present in a successful live fetch — that's a real
    // "no such product" answer, not an outage. Don't fall back to D1 here;
    // trust the live result.
    return row ? normalizeProduct(row.fields).buyUrl : null;
  } catch (liveError) {
    console.error(
      `getProductBuyUrlById: live fetch failed (${liveError.message}), trying D1 fallback for product ${productId}`
    );
    return await getBuyUrlFromFallbackCache(env, productId);
  }
}

/**
 * Looks up product names for a set of Grist row ids — used by
 * email.js's weekly newsletter so it doesn't need a duplicate D1
 * `products` table. Best-effort per id; missing ids are simply
 * absent from the returned map.
 * @param {object} env
 * @param {(number|string)[]} productIds
 * @returns {Promise<Map<string, string>>} id (as string) -> name
 */
export async function getProductNamesByIds(env, productIds) {
  const products = await getCachedProducts(env);
  const wanted = new Set(productIds.map(String));
  const map = new Map();
  for (const p of products) {
    if (wanted.has(String(p.id))) {
      map.set(String(p.id), normalizeProduct(p.fields).name);
    }
  }
  return map;
}
