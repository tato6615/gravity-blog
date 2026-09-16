/**
 * functions/_lib/affiliate-tracking.js
 * ---------------------------------------------------------------------
 * GRAVITY ENHANCEMENT (2026-09-16): per-click subtag injection
 * ---------------------------------------------------------------------
 * Generates a unique click_id per real (non-bot) click and injects it as
 * a platform-specific subtag into the outbound affiliate URL, so a later
 * conversion report can be matched to the EXACT click that produced it
 * instead of only an aggregate per-product correlation (see
 * conversion-agent.js's own honesty note about that limitation).
 *
 * Platform subtag param names:
 *   - Amazon Associates: ascsubtag
 *   - eBay Partner Network: customid
 *   - Anything else (source_type null/manual/unrecognized): no known
 *     subtag mechanism — URL returned unchanged. Safe no-op, redirect is
 *     never broken by an unsupported platform.
 *
 * IMPORTANT — Amazon short links (amzn.to/...): a subtag cannot be
 * appended to an already-shortened amzn.to URL after the fact; it has to
 * be part of the full amazon.com URL before shortening. So for
 * source_type 'amazon' we prefer sourceUrl (the full resolved amazon.com
 * URL captured at import time, already containing tag=...) over the
 * short affiliate_link, purely as the redirect base. Nothing stored in
 * the DB changes — only which stored value is used as the click-time
 * redirect target. The user never sees our URL rendered either way
 * (it's a 302), so there's no visible difference.
 */

export function buildTrackedUrl(sourceType, affiliateLink, sourceUrl, clickId) {
  const fallback = affiliateLink || sourceUrl || null;
  if (!fallback || !clickId) return fallback;

  try {
    if (sourceType === 'amazon') {
      const base = (sourceUrl && /amazon\.[a-z.]+\//i.test(sourceUrl)) ? sourceUrl : fallback;
      const u = new URL(base);
      u.searchParams.set('ascsubtag', clickId);
      return u.toString();
    }

    if (sourceType === 'ebay') {
      const base = affiliateLink || sourceUrl;
      const u = new URL(base);
      u.searchParams.set('customid', clickId);
      return u.toString();
    }

    // Unknown/unsupported platform — no known subtag param, unchanged.
    return fallback;
  } catch (e) {
    console.error('buildTrackedUrl: failed to inject subtag, falling back:', e.message);
    return fallback;
  }
}
