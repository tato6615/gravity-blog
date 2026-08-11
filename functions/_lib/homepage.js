import { getLiveArticles } from './grist.js';
import { renderPage, escapeHtml, toListItems, renderStars, getAuthorInfo } from './layout.js';

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
    newBadge: '🆕 ใหม่'
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
    newBadge: '🆕 New'
  }
};

/**
 * Root-relative link to the given lang's home page.
 */
function homePath(lang) {
  return lang === 'en' ? '/en/' : '/';
}

/**
 * Hybrid ranking score: real clicks + a decaying "new product" bonus.
 * New products start with a bonus roughly equal to a strong click count so
 * they surface near the top, then the bonus linearly fades to 0 over
 * NEW_PRODUCT_DECAY_DAYS. This avoids both problems of a pure click sort
 * (new items buried at 0 clicks forever) and a hard "pin for N days" rule
 * (products falling off a cliff the moment the pin expires).
 *
 * Tune NEW_PRODUCT_BONUS relative to typical top click counts on the site.
 */
const NEW_PRODUCT_BONUS = 50;
const NEW_PRODUCT_DECAY_DAYS = 14;

function getAgeInDaysFromTimestamp(dateStr) {
  if (!dateStr) return Infinity; // unknown age -> treat as old, no bonus
  const ageMs = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(ageMs)) return Infinity;
  return ageMs / (1000 * 60 * 60 * 24);
}

function computeScore(clicks, firstSeenAt) {
  const ageInDays = getAgeInDaysFromTimestamp(firstSeenAt);
  const bonus = Math.max(0, NEW_PRODUCT_BONUS * (1 - ageInDays / NEW_PRODUCT_DECAY_DAYS));
  return clicks + bonus;
}

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
    articles = await getLiveArticles(env, lang);
  } catch (e) {
    errorMsg = e.message;
  }

  // Sort by a hybrid score (clicks + decaying new-product bonus), so brand
  // new products (0 clicks) still get visibility instead of being buried
  // at the bottom forever, while genuinely popular older products keep
  // outranking them once their bonus fades.
  // Cache the clicks aggregation for 5 minutes so repeated homepage loads
  // don\'t hit D1 on every request.
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
  articles.sort((a, b) => {
    const scoreA = computeScore(clickCounts[String(a.id)] || 0, firstSeenMap[String(a.id)]);
    const scoreB = computeScore(clickCounts[String(b.id)] || 0, firstSeenMap[String(b.id)]);
    return scoreB - scoreA;
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

  const displayArticles = selectedCategory
    ? articles.filter(a => a.category === selectedCategory)
    : articles;

  const filterHtml = categories.length > 0 ? `<div class="category-filter">
    <a href="${homePath(lang)}" class="filter-pill${!selectedCategory ? ' is-active' : ''}">${lang === 'en' ? 'All' : 'ทั้งหมด'}</a>
    ${categories.map(cat => `<a href="${homePath(lang)}?category=${encodeURIComponent(cat)}" class="filter-pill${selectedCategory === cat ? ' is-active' : ''}">${escapeHtml(cat)}</a>`).join('')}
  </div>` : '';

  const cards = displayArticles.map((a, i) => {
    const topPro = a.analysis ? toListItems(a.analysis.pros)[0] : null;
    const updatedLabel = a.updatedAt
      ? new Date(a.updatedAt).toLocaleDateString(t.dateLocale, { year: 'numeric', month: 'long', day: 'numeric' })
      : null;
    const thumb = a.product.image
      ? `<img class="card-thumb" src="${escapeHtml(a.product.image)}" alt="${escapeHtml(a.seoTitle)}" loading="lazy">`
      : `<div class="card-thumb-placeholder">${escapeHtml(t.noImage)}</div>`;
    const stars = renderStars(a.product.rating);
    const href = `${lang === 'en' ? '/en' : ''}/product/${encodeURIComponent(a.slug)}`;

    return `
    <a class="card" href="${href}">
      ${thumb}
      <div class="card-body">
        <div class="card-top">
          <span class="rank-badge${i === 0 ? ' is-top' : ''}">${escapeHtml(t.rankLabel)} ${i + 1}</span>
          ${i < 3 && (clickCounts[String(a.id)] || 0) >= hotThreshold ? '<span class="badge-hot">🔥 มาแรง</span>' : ''}
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

  const body = errorMsg
    ? `<div class="error-page">
        <h1>⚠️</h1>
        <p>${escapeHtml(t.loadErrorPrefix)} ${escapeHtml(errorMsg)}</p>
        <p><a href="${homePath(lang)}">${t.retry}</a></p>
      </div>`
    : (displayArticles.length
      ? `${filterHtml}<div class="card-grid">${cards}</div>`
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
