import { getLiveArticles } from './grist.js';
import { renderPage, escapeHtml, toListItems, renderStars, getAuthorInfo } from './layout.js';
import { renderCommunityHub } from './community-hub.js';

// Cache ค่า toggle 60 วิ (pattern เดียวกับ live-articles cache ด้านล่าง)
// ถ้า D1 error หรือยังไม่เคยตั้งค่า -> ซ่อนไว้ก่อนเพื่อความปลอดภัย (fail-safe)
async function isCommunityHubVisible(env) {
  try {
    const cache = caches.default;
    const cacheKey = new Request('https://cache.internal/community-hub-visible');
    const cached = await cache.match(cacheKey);
    if (cached) return (await cached.text()) === 'true';

    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
      .bind('community_hub_visible').first();
    const visible = row ? row.value === 'true' : false;

    const resp = new Response(String(visible), { headers: { 'Cache-Control': 'max-age=60' } });
    await cache.put(cacheKey, resp.clone());
    return visible;
  } catch {
    return false;
  }
}

const STRINGS = {
  th: {
    pageTitle: 'GRAVITY OS — รีวิวสินค้าที่คัดมาให้',
    pageDescription: 'รีวิวและคำแนะนำสินค้า สรุปให้อ่านง่าย ตัดสินใจได้เร็ว',
    heading: 'รีวิวล่าสุด',
    subheading: 'คัดสรรและตรวจสอบโดยทีมงาน อัปเดตอัตโนมัติทุกครั้งที่มีสินค้าใหม่วิเคราะห์เสร็จ',
    rankLabel: 'อันดับ',
    fallbackEyebrow: 'รีวิว',
    noImage: 'ไม่มีรูปสินค้า',
    ctaBtn: 'อ่านรีวิวฉบับเต็ม →',
    updatedPrefix: 'ตรวจสอบและอัปเดตข้อมูลล่าสุด:',
    dateLocale: 'th-TH',
    loadErrorPrefix: 'โหลดบทความไม่สำเร็จ:',
    retry: 'ลองใหม่อีกครั้ง',
    empty: 'ยังไม่มีบทความ',
    emptySub: 'พอ Generate Everything เสร็จในระบบหลัง บทความจะขึ้นที่นี่อัตโนมัติ',
    newBadge: '🆕 ใหม่',
    newArrivalsHeading: 'สินค้าใหม่ล่าสุด',
    newArrivalsSub: 'สินค้าที่เพิ่งเข้าระบบล่าสุด เรียงตามวันที่เจอครั้งแรก ไม่ปนกับยอดคลิก',
    searchPlaceholder: 'ค้นหาสินค้า...',
    searchNoResults: 'ไม่พบสินค้าที่ตรงกับคำค้นหา'
  },
  en: {
    pageTitle: 'GRAVITY OS — Curated product reviews',
    pageDescription: 'Product reviews and buying guides, summarized so you can decide fast.',
    heading: 'Latest reviews',
    subheading: 'Curated and checked by our team, updated automatically whenever a new product finishes analysis.',
    rankLabel: 'Rank',
    fallbackEyebrow: 'Review',
    noImage: 'No product photo',
    ctaBtn: 'Read the full review →',
    updatedPrefix: 'Last checked & updated:',
    dateLocale: 'en-US',
    loadErrorPrefix: 'Failed to load articles:',
    retry: 'Try again',
    empty: 'No articles yet',
    emptySub: "Once a product finishes running through Generate Everything, it'll show up here automatically.",
    newBadge: '🆕 New',
    newArrivalsHeading: 'Newest arrivals',
    newArrivalsSub: 'Recently added products, sorted purely by first-seen date — not mixed with click count.',
    searchPlaceholder: 'Search products...',
    searchNoResults: 'No products match your search.'
  }
};

/**
 * Root-relative link to the given lang's home page.
 */
function homePath(lang) {
  return lang === 'en' ? '/en/' : '/';
}

// How many items appear in the top "most clicked" section before the
// "Newest arrivals" section starts. Matches the original first row of 3.
//
// NOTE: the top section is sorted by real click count ONLY — no new-product
// bonus. A brand-new product (0 clicks) never jumps ahead of an established
// one here; it shows up in the "Newest arrivals" section instead, and only
// earns a Top-section spot once it accumulates enough real clicks on its
// own. This intentionally replaces the earlier "hybrid score" approach
// (clicks + decaying bonus), which let brand-new products briefly outrank
// products with real engagement whenever click counts were low overall.
const TOP_SECTION_COUNT = 3;

/**
 * Self-tracked "first seen" timestamps, stored in our own D1 table instead
 * of trusting any timestamp field from Grist (which gets overwritten by
 * hourly/30-min sync jobs and can't be used to tell new products from old
 * ones). The first time a product shows up here, we record "now" as its
 * first-seen date; every time after that we just read the stored value
 * back, so it never resets no matter how often the product row itself gets
 * touched elsewhere.
 *
 * Requires a table created once via:
 *   CREATE TABLE IF NOT EXISTS product_first_seen (
 *     product_id TEXT PRIMARY KEY,
 *     first_seen_at TEXT NOT NULL
 *   );
 */
async function getOrCreateFirstSeenMap(env, productIds) {
  const firstSeenMap = {};
  const ids = [...new Set(productIds.map(String))].filter(Boolean);
  if (!env.DB || !ids.length) return firstSeenMap;

  try {
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await env.DB.prepare(
      `SELECT product_id, first_seen_at FROM product_first_seen WHERE product_id IN (${placeholders})`
    ).bind(...ids).all();
    results.forEach(r => { firstSeenMap[String(r.product_id)] = r.first_seen_at; });

    const missingIds = ids.filter(id => !(id in firstSeenMap));
    if (missingIds.length) {
      const now = new Date().toISOString();
      const stmts = missingIds.map(id =>
        env.DB.prepare(
          `INSERT INTO product_first_seen (product_id, first_seen_at) VALUES (?, ?)
           ON CONFLICT(product_id) DO NOTHING`
        ).bind(id, now)
      );
      await env.DB.batch(stmts);
      missingIds.forEach(id => { firstSeenMap[id] = now; });
    }
  } catch (e) {
    // Table missing or D1 unavailable — every product falls back to
    // Infinity age (no bonus), so ranking degrades to pure click-count
    // sort rather than breaking the page.
  }

  return firstSeenMap;
}

/**
 * Renders one grid of article cards. `startRank` lets the "new arrivals"
 * section continue the rank numbering after the top section instead of
 * restarting at 1, so badges stay visually consistent across both grids.
 */
function renderCardGrid(articles, { t, lang, clickCounts, hotThreshold, startRank = 0, newProductIds = new Set() }) {
  return articles.map((a, idx) => {
    const i = startRank + idx;
    const topPro = a.analysis ? toListItems(a.analysis.pros)[0] : null;
    const thumb = a.product.image
      ? `<img class="card-thumb" src="${escapeHtml(a.product.image)}" alt="${escapeHtml(a.seoTitle)}" loading="lazy">`
      : `<div class="card-thumb-placeholder">${escapeHtml(t.noImage)}</div>`;
    const stars = renderStars(a.product.rating);
    const href = `${lang === 'en' ? '/en' : ''}/product/${encodeURIComponent(a.slug)}`;
    const searchText = `${a.seoTitle || ''} ${(a.product && a.product.brand) || ''}`.toLowerCase().replace(/"/g, '');

    return `
    <a class="card" href="${href}" data-search="${escapeHtml(searchText)}">
      ${thumb}
      <div class="card-body">
        <div class="card-top">
          <span class="rank-badge${i === 0 ? ' is-top' : ''}">${escapeHtml(t.rankLabel)} ${i + 1}</span>
          ${i < 3 && (clickCounts[String(a.id)] || 0) >= hotThreshold ? '<span class="badge-hot">🔥 มาแรง</span>' : ''}
          ${newProductIds.has(String(a.id)) ? `<span class="badge-new">${escapeHtml(t.newBadge)}</span>` : ''}
          <div class="eyebrow">${escapeHtml(a.product.brand || t.fallbackEyebrow)}</div>
          ${a.authorId ? `<span class="author-badge">${escapeHtml(getAuthorInfo(a.authorId).short)}</span>` : ''}
        </div>
        <h2>${escapeHtml(a.seoTitle)}</h2>
        ${stars ? `<div style="margin-bottom:10px;">${stars}</div>` : ''}
        <p class="excerpt">${escapeHtml(a.metaDescription)}</p>
        ${(clickCounts[String(a.id)] || 0) > 0 ? `<div class="click-count">${clickCounts[String(a.id)]} คลิก</div>` : ''}
        ${topPro ? `<div class="pro-highlight"><span class="check">✓</span><span>${escapeHtml(topPro)}</span></div>` : ''}
        <div class="cta-btn">${escapeHtml(t.ctaBtn)}</div>
      </div>
    </a>
  `;
  }).join('');
}

/**
 * Renders the home/listing page for the given language.
 * @param {object} env
 * @param {'th'|'en'} lang
 * @returns {Promise<Response>}
 */
export async function renderHomePage(env, lang = 'th', request = null) {
  const t = STRINGS[lang] || STRINGS.th;

  let articles = [];
  let errorMsg = null;
  try {
    // Cache the Grist article fetch for 5 min (same pattern as clickCounts
    // below) — Grist free plan caps at 5,000 calls/doc/day + 5 req/sec.
    // Without this, every single page load/refresh hits Grist directly.
    const cache = caches.default;
    const articlesCacheKey = new Request(`https://cache.internal/live-articles-${lang}`);
    const cachedArticlesResp = await cache.match(articlesCacheKey);
    if (cachedArticlesResp) {
      articles = await cachedArticlesResp.json();
    } else {
      articles = await getLiveArticles(env, lang);
      const articlesCacheResp = new Response(JSON.stringify(articles), {
        headers: { 'Cache-Control': 'max-age=300', 'content-type': 'application/json' }
      });
      await cache.put(articlesCacheKey, articlesCacheResp);
    }
  } catch (e) {
    errorMsg = e.message;
  }

  // Cache the clicks aggregation for 5 minutes so repeated homepage loads
  // don't hit D1 on every request.
  let clickCounts = {};
  try {
    const cache = caches.default;
    const cacheKey = new Request('https://cache.internal/click-counts');
    const cached = await cache.match(cacheKey);
    if (cached) {
      clickCounts = await cached.json();
    } else {
      const { results } = await env.DB.prepare(
        `SELECT product_id, COUNT(*) as clicks FROM clicks GROUP BY product_id`
      ).all();
      results.forEach(r => { clickCounts[String(r.product_id)] = r.clicks; });
      const cacheResp = new Response(JSON.stringify(clickCounts), {
        headers: { 'Cache-Control': 'max-age=300', 'content-type': 'application/json' }
      });
      await cache.put(cacheKey, cacheResp);
    }
  } catch (e) {
    // D1/Cache unavailable — fall back to original article order
  }

  const firstSeenMap = await getOrCreateFirstSeenMap(env, articles.map(a => a.id));

  // สินค้าที่ first_seen_at อยู่ภายใน N วันล่าสุด ถือว่า "ใหม่" — โชว์ badge
  // ได้ทุกที่ที่การ์ดไปโผล่ ไม่ว่าจะอยู่ top section (เพราะคลิกเยอะ) หรือ
  // newest arrivals section ก็ตาม
  const NEW_BADGE_DAYS = 3;
  const nowMs = Date.now();
  const newProductIds = new Set(
    articles
      .filter(a => {
        const firstSeen = firstSeenMap[String(a.id)];
        if (!firstSeen) return false;
        const ageDays = (nowMs - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24);
        return ageDays <= NEW_BADGE_DAYS;
      })
      .map(a => String(a.id))
  );

  // Top section: pure click count, high to low. New products (0 clicks)
  // never outrank established ones here — they surface in the "Newest
  // arrivals" section below instead, and only earn a spot up here once
  // they've actually accumulated clicks.
  const scoredArticles = [...articles].sort((a, b) => {
    const clicksA = clickCounts[String(a.id)] || 0;
    const clicksB = clickCounts[String(b.id)] || 0;
    return clicksB - clicksA;
  });

  // Relative "hot" threshold: 1.5x the average clicks among products that
  // have at least one click, with a floor of 3 so it still means something
  // when overall traffic is very low.
  const clickedValues = Object.values(clickCounts).filter(v => v > 0);
  const avgClicks = clickedValues.length
    ? clickedValues.reduce((sum, v) => sum + v, 0) / clickedValues.length
    : 0;
  const hotThreshold = Math.max(3, Math.round(avgClicks * 1.5));

  const selectedCategory = request ? new URL(request.url).searchParams.get('category') : null;

  // นับจำนวนสินค้าต่อหมวด แล้วโชว์เฉพาะหมวดที่มีสินค้า >= 2 ชิ้น (กันแถบ pills รกเวลาสินค้าเยอะขึ้น)
  const MIN_PRODUCTS_PER_CATEGORY = 2;
  const categoryCounts = {};
  articles.forEach(a => {
    if (a.category) categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
  });
  const categories = Object.keys(categoryCounts)
    .filter(cat => categoryCounts[cat] >= MIN_PRODUCTS_PER_CATEGORY)
    .sort((a, b) => categoryCounts[b] - categoryCounts[a]);

  const displayScoredArticles = selectedCategory
    ? scoredArticles.filter(a => a.category === selectedCategory)
    : scoredArticles;

  const filterHtml = categories.length > 0 ? `<div class="category-filter">
    <a href="${homePath(lang)}" class="filter-pill${!selectedCategory ? ' is-active' : ''}">${lang === 'en' ? 'All' : 'ทั้งหมด'}</a>
    ${categories.map(cat => `<a href="${homePath(lang)}?category=${encodeURIComponent(cat)}" class="filter-pill${selectedCategory === cat ? ' is-active' : ''}">${escapeHtml(cat)}</a>`).join('')}
  </div>` : '';

  // Split into two independent groups instead of one long hybrid-sorted
  // list: a top section by hybrid score, and a "newest arrivals" section
  // sorted purely by first_seen_at (most recent first) with no click
  // weighting at all. Items already shown in the top section are excluded
  // from the arrivals section so nothing appears twice.
  const topArticles = displayScoredArticles.slice(0, TOP_SECTION_COUNT);
  const topIds = new Set(topArticles.map(a => String(a.id)));

  const newArrivalArticles = displayScoredArticles
    .filter(a => !topIds.has(String(a.id)))
    .sort((a, b) => {
      const dateA = firstSeenMap[String(a.id)] ? new Date(firstSeenMap[String(a.id)]).getTime() : -Infinity;
      const dateB = firstSeenMap[String(b.id)] ? new Date(firstSeenMap[String(b.id)]).getTime() : -Infinity;
      return dateB - dateA; // newest first_seen_at first
    });

  const topCardsHtml = renderCardGrid(topArticles, { t, lang, clickCounts, hotThreshold, startRank: 0, newProductIds });
  const newArrivalsCardsHtml = renderCardGrid(newArrivalArticles, { t, lang, clickCounts, hotThreshold, startRank: TOP_SECTION_COUNT, newProductIds });

  const newArrivalsSectionHtml = newArrivalArticles.length ? `
    <h2 style="font-size:20px;margin:36px 0 4px;">${escapeHtml(t.newArrivalsHeading)}</h2>
    <p class="meta" style="margin-bottom:20px;">${escapeHtml(t.newArrivalsSub)}</p>
    <div class="card-grid">${newArrivalsCardsHtml}</div>
  ` : '';

  const searchBoxHtml = articles.length ? `
  <style>
    .search-box{ margin-bottom:20px; }
    .search-input{
      width:100%; box-sizing:border-box; padding:12px 16px; font-size:15px;
      border:1px solid var(--hairline); border-radius:10px; background:var(--surface);
      color:var(--ink); font-family:inherit;
    }
    .search-input:focus{ outline:none; border-color:var(--accent); }
    .search-no-results{ display:none; color:var(--ink-muted); padding:20px 0; }
  </style>
  <div class="search-box">
    <input type="text" id="productSearchInput" class="search-input" placeholder="${escapeHtml(t.searchPlaceholder)}" autocomplete="off" oninput="filterProductCards(this.value)">
  </div>
  <p id="searchNoResults" class="search-no-results">${escapeHtml(t.searchNoResults)}</p>
  <script>
    function filterProductCards(query) {
      const q = query.trim().toLowerCase();
      const cards = document.querySelectorAll('.card[data-search]');
      let visibleCount = 0;
      cards.forEach(function(card) {
        const match = !q || card.getAttribute('data-search').indexOf(q) !== -1;
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      const noResultsEl = document.getElementById('searchNoResults');
      if (noResultsEl) {
        noResultsEl.style.display = (q && visibleCount === 0) ? 'block' : 'none';
      }
    }
  </script>
` : '';

  const communityHubVisible = await isCommunityHubVisible(env);
  const communityHubHtml = communityHubVisible ? renderCommunityHub({ mode: 'compact' }) : '';

  const body = errorMsg
    ? `<div class="error-page">
        <h1>⚠️</h1>
        <p>${escapeHtml(t.loadErrorPrefix)} ${escapeHtml(errorMsg)}</p>
        <p><a href="${homePath(lang)}">${t.retry}</a></p>
      </div>`
    : (displayScoredArticles.length
      ? `${communityHubHtml}${searchBoxHtml}${filterHtml}<div class="card-grid">${topCardsHtml}</div>${newArrivalsSectionHtml}`
      : `${filterHtml}<div class="error-page">
          <p>${escapeHtml(t.empty)}</p>
          <p>${escapeHtml(t.emptySub)}</p>
        </div>`);

  // No altLangPath for the home page yet — the equivalent listing in the
  // other language always exists at a fixed URL ('/' <-> '/en/'), unlike
  // article pages where the slug can differ per language. We still pass
  // it explicitly so the switcher shows up in the header.
  const altLangPath = lang === 'en' ? '/' : '/en/';

  const html = renderPage({
    title: t.pageTitle,
    description: t.pageDescription,
    canonicalPath: homePath(lang),
    lang,
    altLangPath,
    wide: true,
    bodyHtml: `<h1 style="font-size:26px;margin-bottom:6px;">${escapeHtml(t.heading)}</h1>
    <p class="meta" style="margin-bottom:28px;">${escapeHtml(t.subheading)}</p>
${body}`
  });

  return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
}
