/**
 * D1 read layer for the GRAVITY_OS public blog (Cloudflare Pages).
 *
 * Drop-in replacement for _lib/grist.js's getLiveArticles() — same function
 * signature, same output shape, so homepage.js and article.js don't need to
 * change at all. Reads directly from D1 (`gravity_affiliate`) instead of
 * calling the Grist API.
 *
 * ⭐ ASSUMPTION (flagged, needs confirm): D1's `content`/`ai_analysis` tables
 * have NO reviewer_id/author_id column anywhere in the current schema
 * (confirmed via `SELECT sql FROM sqlite_master ... 2026-09-05`). The old
 * grist.js used `c.reviewer_id || c.author_id` for `authorId`. Until that
 * column exists somewhere, authorId is always null here — author badges on
 * article cards will disappear site-wide. This is intentional fail-safe
 * behavior (homepage.js already handles authorId being falsy), not a bug —
 * but it IS a visible regression vs. today's site. Revisit once decided
 * whether to add the column back.
 *
 * ⭐ D1 IS the source of truth here — unlike grist.js, there is no
 * "live Grist fetch failed, read D1 fallback cache instead" path, because
 * there's no other live source to fail. The `articles_fallback_cache` table
 * grist.js maintains is NOT reused here; it stops being written the moment
 * import.js/pipeline.js/etc. no longer call grist.js (phase 4), so it can't
 * be treated as a permanent data source for this file.
 *
 * ⭐ "Latest row per product+language": content/ai_analysis are append-only
 * in D1 (367 content rows / 188 products from phase 1 import — several rows
 * per product), unlike Grist where each product+language pair had exactly
 * one row. Every query below picks the latest via
 * ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY generated_at DESC, id DESC)
 * — id DESC as a tiebreaker for rows sharing an identical generated_at
 * timestamp, so ties are still deterministic instead of picking an
 * arbitrary duplicate.
 */

// Same threshold as ai-prompt.js's scoreReviewMarketFit() -> publishable
// flag, and same constant grist.js already uses. Keep in sync if it
// ever changes there.
const MIN_PUBLISHABLE_QUALITY_SCORE = 70;

// Fallback only, used when quality_score is missing but quality_tier isn't.
// Substring match (case-insensitive), NOT exact equality — tier strings are
// emoji-prefixed (e.g. '❌ Poor') same as in grist.js.
const REJECTED_TIER_SUBSTRINGS = ['poor', 'fair'];

// Same grandfather clause as grist.js: content generated before the quality
// gate started actually enforcing (2026-08-22) is exempt from the score
// check entirely — same fail-open behavior. Content with no generated_at at
// all is grandfathered too, matching grist.js exactly. Remove this + its use
// below once all old content has been reviewed/backfilled.
const QUALITY_GATE_ENFORCED_SINCE = new Date('2026-08-22T00:00:00Z');

const LIVE_STATUSES = ['enriched', 'published'];

// products.price is free-text and can be in different currencies per
// source marketplace ("$16.19", "JPY 3,078", "HKD 2,579.46", ...) — same
// parser as grist.js's normalizeProduct(), unchanged logic.
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

// products.gallery_image_urls — same shapes grist.js's parseGallery()
// already handles (JSON array string, comma/newline list, or real array).
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

function normalizeProductRow(row) {
  const rawRating = row.rating;
  const rating = rawRating != null && rawRating !== '' && !isNaN(Number(rawRating))
    ? Number(rawRating)
    : null;

  const { amount: priceAmount, currency: priceCurrency } = parsePrice(row.price);

  return {
    name: row.product_name || 'สินค้าไม่มีชื่อ',
    brand: row.brand || '',
    price: row.price || null,
    priceAmount,
    priceCurrency,
    image: row.image_url || null,
    image_url: row.image_url || null,
    gallery: parseGallery(row.gallery_image_urls),
    rating,
    // Same priority order as grist.js's normalizeProduct(): affiliate_link
    // first, source_url as fallback. (D1 products has no separate url/
    // product_url columns — those were Grist-doc-shape fallbacks only.)
    buyUrl: row.affiliate_link || row.source_url || null
  };
}

// GRAVITY-FIX PARITY (same rule as grist.js's isBelowPublishableQuality()):
// prefer quality_score (threshold-comparable, immune to string/emoji
// drift). Fall back to substring-matching quality_tier only if score is
// missing but tier isn't. Neither present -> fail-open (not rejected).
function isBelowPublishableQuality(contentRow) {
  const score = contentRow.quality_score;
  if (score != null && score !== '' && !isNaN(Number(score))) {
    return Number(score) < MIN_PUBLISHABLE_QUALITY_SCORE;
  }
  const tier = contentRow.quality_tier;
  if (tier) {
    const tierLower = String(tier).toLowerCase();
    return REJECTED_TIER_SUBSTRINGS.some(s => tierLower.includes(s));
  }
  return false;
}

/**
 * Joins products + latest content + latest ai_analysis (per product+language)
 * for every "live" product in the given language. Same output shape as
 * grist.js's getLiveArticles() — homepage.js/article.js don't need changes.
 *
 * @param {object} env  must have env.DB (D1 binding)
 * @param {'th'|'en'} [lang]
 */
export async function getLiveArticles(env, lang = 'th') {
  // Same 5-min edge-cache pattern grist.js used, for parity — NOTE:
  // homepage.js already caches this same function's result under the same
  // cache key ('live-articles-{lang}') on its own, so this second cache
  // layer is mostly redundant there (pre-existing behavior, not new).
  // Harmless to keep for callers that don't already cache (e.g. a future
  // article.js call), so left in for parity rather than removed here.
  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/live-articles-${lang}`);
  const cached = await cache.match(cacheKey);
  if (cached) return await cached.json();

  const statusPlaceholders = LIVE_STATUSES.map(() => '?').join(',');

  const query = `
    SELECT
      p.id                    AS product_id,
      p.product_name,
      p.brand,
      p.category,
      p.category_th,
      p.affiliate_link,
      p.source_url,
      p.price,
      p.image_url,
      p.rating,
      p.gallery_image_urls,
      p.updated_at            AS product_updated_at,
      c.slug,
      c.seo_title,
      c.meta_description,
      c.blog_draft,
      c.faq,
      c.buying_guide,
      c.tags,
      c.generated_at          AS content_generated_at,
      c.quality_score,
      c.quality_tier,
      a.product_summary,
      a.pros,
      a.cons,
      a.target_audience,
      a.specifications,
      a.features,
      a.estimated_commission,
      a.generated_at          AS analysis_generated_at
    FROM products p
    INNER JOIN (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY product_id ORDER BY generated_at DESC, id DESC
      ) AS rn
      FROM content
      WHERE language = ?
    ) c ON c.product_id = p.id AND c.rn = 1
    LEFT JOIN (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY product_id ORDER BY generated_at DESC, id DESC
      ) AS rn
      FROM ai_analysis
      WHERE language = ?
    ) a ON a.product_id = p.id AND a.rn = 1
    WHERE p.pipeline_status IN (${statusPlaceholders})
      AND c.slug IS NOT NULL AND c.slug != ''
      AND c.blog_draft IS NOT NULL AND c.blog_draft != ''
  `;

  const { results } = await env.DB.prepare(query)
    .bind(lang, lang, ...LIVE_STATUSES)
    .all();

  const articles = [];
  for (const row of results) {
    // Same grandfather-clause quality gate as grist.js — see file header.
    const generatedAt = row.content_generated_at ? new Date(row.content_generated_at) : null;
    const isGrandfathered = !generatedAt || generatedAt < QUALITY_GATE_ENFORCED_SINCE;
    if (!isGrandfathered && isBelowPublishableQuality(row)) {
      continue;
    }

    // LEFT JOIN means every a.* column comes back null when a product has
    // no ai_analysis row at all — treat that as analysis: null, same as
    // grist.js's `analysisByProduct.get(id) || null`.
    const hasAnalysis = row.product_summary != null || row.pros != null;

    articles.push({
      id: row.product_id,
      slug: row.slug,
      product: normalizeProductRow(row),
      seoTitle: row.seo_title || row.slug,
      metaDescription: row.meta_description || '',
      blogDraft: row.blog_draft || '',
      faq: row.faq || '',
      buyingGuide: row.buying_guide || '',
      tags: (row.tags || '').split(',').map(s => s.trim()).filter(Boolean),
      createdAt: row.content_generated_at || null,
      updatedAt: row.product_updated_at || row.content_generated_at || null,
      // ⭐ ASSUMPTION — see file header: no reviewer_id/author_id column
      // anywhere in the current D1 schema. Always null until that's
      // decided/added. homepage.js already handles this being falsy.
      authorId: null,
      category: row.category || null,
      categoryTh: row.category_th || null,
      qualityTier: row.quality_tier || null,
      qualityScore: row.quality_score != null ? Number(row.quality_score) : null,
      analysis: hasAnalysis ? {
        product_summary: row.product_summary,
        pros: row.pros,
        cons: row.cons,
        target_audience: row.target_audience,
        specifications: row.specifications,
        features: row.features,
        estimated_commission: row.estimated_commission,
        generated_at: row.analysis_generated_at,
        language: lang
      } : null
    });
  }

  articles.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  const cacheResp = new Response(JSON.stringify(articles), {
    headers: { 'Cache-Control': 'max-age=300', 'content-type': 'application/json' }
  });
  await cache.put(cacheKey, cacheResp);

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
