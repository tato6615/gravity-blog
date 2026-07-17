/**
 * Shared Grist read layer for the GRAVITY_OS public blog (Cloudflare Pages).
 *
 * This is intentionally READ-ONLY and separate from worker.js — the blog
 * never writes to Grist, it only queries content that the worker already
 * generated. Requires the same two secrets as the worker, set as Pages
 * environment variables:
 *   GRIST_API_KEY, GRIST_DOC_ID
 *
 * "Live" = pipeline_status is 'enriched' or 'published'. We treat 'enriched'
 * as live on purpose: the site is meant to update automatically the moment
 * Generate Everything finishes, with no separate manual publish step.
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

function normalizeProduct(fields) {
  return {
    name: pickField(fields, ['name', 'product_name', 'title']) || 'สินค้าไม่มีชื่อ',
    brand: pickField(fields, ['brand']) || '',
    price: pickField(fields, ['price']) || null,
    image: pickField(fields, ['image', 'image_url', 'photo']) || null,
    buyUrl: fields.source_url || pickField(fields, ['url', 'product_url']) || null
  };
}

// Joins 03_PRODUCTS + CONTENT + AI_ANALYSIS for every "live" product.
// Small doc sizes assumed (fine for Grist's REST API + a few hundred
// products); if this ever needs to scale past that, add caching here.
export async function getLiveArticles(env) {
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
  // see the content_th / content_en pipeline steps in worker.js). Without
  // filtering by language, whichever row happens to come later in the
  // array silently overwrites the other, so the blog could end up mixing
  // in English content unpredictably. This blog is Thai-only, so we only
  // ever join the 'th' row. (Add an /en/ route later if EN is needed.)
  const contentByProduct = new Map(
    content
      .filter(r => r.fields.language === 'th')
      .map(r => [r.fields.product, r.fields])
  );
  const analysisByProduct = new Map(analysis.map(r => [r.fields.product, r.fields]));

  const articles = [];
  for (const p of products) {
    const status = p.fields.pipeline_status;
    if (!LIVE_STATUSES.has(status)) continue;
    const c = contentByProduct.get(p.id);
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
      analysis: analysisByProduct.get(p.id) || null
    });
  }

  articles.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return articles;
}

export async function getArticleBySlug(env, slug) {
  const articles = await getLiveArticles(env);
  return articles.find(a => a.slug === slug) || null;
}