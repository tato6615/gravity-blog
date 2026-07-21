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
 * content_en steps in worker.js). Every read here takes a `lang` param
 * and filters CONTENT rows by that language, so th/en never mix.
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
      if (key.toLowerCase() === c.toLowerCase()) return fields[key];
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

  return {
    name: pickField(fields, ['name', 'product_name', 'title']) || 'สินค้าไม่มีชื่อ',
    brand: pickField(fields, ['brand']) || '',
    price: pickField(fields, ['price']) || null,
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
  const analysisByProduct = new Map(
    analysis.map(r => [String(r.fields.product), r.fields])
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
      updatedAt: p.fields.updated_at || c.generated_at || null,
      analysis: analysisByProduct.get(String(p.id)) || null
    });
  }

  articles.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
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