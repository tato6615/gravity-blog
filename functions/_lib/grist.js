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
 */

const GRIST_BASE = 'https://docs.getgrist.com/api/docs';
const LIVE_STATUSES = new Set(['enriched', 'published']);

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

  const articles = [];
  for (const p of products) {
    const status = p.fields.pipeline_status;
    if (!LIVE_STATUSES.has(status)) continue;
    const c = contentByProduct.get(String(p.id));
    if (!c || !c.slug || !c.blog_draft) continue; // not enriched enough to show yet
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
      analysis: analysisByProduct.get(String(p.id)) || null
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
/**
 * Looks up a single product's buyUrl by its Grist row id — used by the
 * /go/[id] redirect function. Doesn't require the product to have live
 * CONTENT/slug (unlike getLiveArticles) — just needs to exist in
 * PRODUCTS with an affiliate_link.
 * @param {object} env
 * @param {number|string} productId
 */
export async function getProductBuyUrlById(env, productId) {
  const productsTableId = await findProductsTableId(env);
  const products = await fetchTableRecords(env, productsTableId);
  const row = products.find(p => Number(p.id) === Number(productId));
  if (!row) return null;
  return normalizeProduct(row.fields).buyUrl;
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
  const productsTableId = await findProductsTableId(env);
  const products = await fetchTableRecords(env, productsTableId);
  const wanted = new Set(productIds.map(String));
  const map = new Map();
  for (const p of products) {
    if (wanted.has(String(p.id))) {
      map.set(String(p.id), normalizeProduct(p.fields).name);
    }
  }
  return map;
}
