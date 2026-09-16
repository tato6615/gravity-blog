/**
 * D1 replacement for grist.js's getProductBuyUrlById() / getProductNamesByIds().
 * Only reads from `products` table — no join needed, these two functions
 * never touched content/analysis in grist.js either.
 *
 * GRAVITY ENHANCEMENT (2026-09-16): getProductBuyUrlById() now returns an
 * object ({ affiliateLink, sourceUrl, sourceType, buyUrl }) instead of a
 * single string, so /go/[id].js can build a per-click tracked URL
 * (see affiliate-tracking.js). Only consumer of this function is
 * /go/[id].js — confirmed via grep before this change — so this is a
 * safe, non-breaking shape change. `buyUrl` is kept for anyone reading
 * this file who expects the old single-string value.
 */

const D1_CHUNK_SIZE = 90; // D1 caps at 100 bound params/query — chunk to stay safe

/**
 * Used by /go/[id].js — affiliate redirect.
 * @param {object} env
 * @param {number|string} productId
 */
export async function getProductBuyUrlById(env, productId) {
  if (!env.DB) return null;
  try {
    const row = await env.DB.prepare(
      `SELECT affiliate_link, source_url, source_type FROM products WHERE id = ?`
    ).bind(productId).first();
    if (!row) return null;
    const affiliateLink = row.affiliate_link ? String(row.affiliate_link).trim() : null;
    const sourceUrl = row.source_url ? String(row.source_url).trim() : null;
    return {
      affiliateLink,
      sourceUrl,
      sourceType: row.source_type || null,
      buyUrl: affiliateLink || sourceUrl || null,
    };
  } catch (e) {
    console.error(`getProductBuyUrlById: D1 query failed for product ${productId}:`, e.message);
    return null;
  }
}

/**
 * Used by api/email/[[path]].js — weekly newsletter.
 * @param {object} env
 * @param {(number|string)[]} productIds
 * @returns {Promise<Map<string, string>>} id (as string) -> product_name
 */
export async function getProductNamesByIds(env, productIds) {
  const map = new Map();
  const ids = [...new Set((productIds || []).map(String))].filter(Boolean);
  if (!env.DB || !ids.length) return map;

  try {
    for (let i = 0; i < ids.length; i += D1_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + D1_CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT id, product_name FROM products WHERE id IN (${placeholders})`
      ).bind(...chunk).all();
      results.forEach(r => map.set(String(r.id), r.product_name || `Product ${r.id}`));
    }
  } catch (e) {
    console.error('getProductNamesByIds: D1 query failed:', e.message);
  }
  return map;
}
