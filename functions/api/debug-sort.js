import { getLiveArticles } from '../_lib/grist.js';

function splitCategory(cat) {
  const idx = cat.indexOf(' > ');
  if (idx === -1) return { top: cat, sub: null };
  return { top: cat.slice(0, idx), sub: cat.slice(idx + 3) };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const selectedCategory = url.searchParams.get('category'); // e.g. "Pet Supplies"
  const debug = { selectedCategoryParam: selectedCategory };

  const articles = await getLiveArticles(env, 'th');
  debug.totalArticlesFromGrist = articles.length;

  // ── click counts (same as homepage.js) ──
  const clickCounts = {};
  try {
    const { results } = await env.DB.prepare(
      'SELECT product_id, COUNT(*) as clicks FROM clicks GROUP BY product_id'
    ).all();
    results.forEach(r => { clickCounts[String(r.product_id)] = r.clicks; });
  } catch (e) {
    debug.clickCountsError = e.message;
  }
  debug.harloonClicks = clickCounts['138'] || 0;

  // ── first seen map (same as homepage.js, read-only here) ──
  const firstSeenMap = {};
  try {
    const ids = [...new Set(articles.map(a => String(a.id)))];
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await env.DB.prepare(
      `SELECT product_id, first_seen_at FROM product_first_seen WHERE product_id IN (${placeholders})`
    ).bind(...ids).all();
    results.forEach(r => { firstSeenMap[String(r.product_id)] = r.first_seen_at; });
  } catch (e) {
    debug.firstSeenError = e.message;
  }
  debug.harloonFirstSeen = firstSeenMap['138'] || null;

  // ── sort by clicks (same as homepage.js scoredArticles) ──
  const scoredArticles = [...articles].sort((a, b) => {
    const clicksA = clickCounts[String(a.id)] || 0;
    const clicksB = clickCounts[String(b.id)] || 0;
    return clicksB - clicksA;
  });

  // ── category filter (same logic as homepage.js) ──
  let displayScoredArticles;
  if (!selectedCategory) {
    displayScoredArticles = scoredArticles;
  } else {
    const hasSub = selectedCategory.includes(' > ');
    displayScoredArticles = scoredArticles.filter(a => {
      if (!a.category) return false;
      if (hasSub) return a.category === selectedCategory;
      return a.category === selectedCategory ||
             a.category.startsWith(selectedCategory + ' > ');
    });
  }
  debug.articlesAfterCategoryFilter = displayScoredArticles.length;
  debug.harloonPassesCategoryFilter = displayScoredArticles.some(a => String(a.id) === '138');

  // ── top 3 (same as homepage.js) ──
  const TOP_SECTION_COUNT = 3;
  const topArticles = displayScoredArticles.slice(0, TOP_SECTION_COUNT);
  const topIds = new Set(topArticles.map(a => String(a.id)));
  debug.topArticles = topArticles.map(a => ({
    id: a.id, title: a.seoTitle, clicks: clickCounts[String(a.id)] || 0
  }));
  debug.harloonIsInTop3 = topIds.has('138');

  // ── newArrivalArticles (same as homepage.js) ──
  const newArrivalArticles = displayScoredArticles
    .filter(a => !topIds.has(String(a.id)))
    .sort((a, b) => {
      const dateA = firstSeenMap[String(a.id)] ? new Date(firstSeenMap[String(a.id)]).getTime() : -Infinity;
      const dateB = firstSeenMap[String(b.id)] ? new Date(firstSeenMap[String(b.id)]).getTime() : -Infinity;
      return dateB - dateA;
    });
  debug.newArrivalArticlesTop10 = newArrivalArticles.slice(0, 10).map(a => ({
    id: a.id, title: a.seoTitle, firstSeenAt: firstSeenMap[String(a.id)] || null
  }));
  debug.harloonPositionInNewArrivals = newArrivalArticles.findIndex(a => String(a.id) === '138');

  return new Response(JSON.stringify(debug, null, 2), {
    headers: { 'content-type': 'application/json' }
  });
}
