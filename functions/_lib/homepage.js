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
    searchNoResults: 'ไม่พบสินค้าที่ตรงกับคำค้นหา',
    filterAll: 'ทั้งหมด',
    filterSubcategory: 'หมวดย่อย',
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
    searchNoResults: 'No products match your search.',
    filterAll: 'All',
    filterSubcategory: 'Subcategory',
  }
};

/**
 * Root-relative link to the given lang's home page.
 */
function homePath(lang) {
  return lang === 'en' ? '/en/' : '/';
}

const TOP_SECTION_COUNT = 3;

// D1 จำกัด bound parameters ต่อ query ไว้ที่ 100 ตัว — แบ่งเป็น chunk ละ 90
// เผื่อไว้ (กันชนเพดานพอดีถ้าจำนวนสินค้าโตขึ้นอีกในอนาคต)
const D1_CHUNK_SIZE = 90;

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function getOrCreateFirstSeenMap(env, productIds) {
  const firstSeenMap = {};
  const ids = [...new Set(productIds.map(String))].filter(Boolean);
  if (!env.DB || !ids.length) return firstSeenMap;

  try {
    for (const chunk of chunkArray(ids, D1_CHUNK_SIZE)) {
      const placeholders = chunk.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT product_id, first_seen_at FROM product_first_seen WHERE product_id IN (${placeholders})`
      ).bind(...chunk).all();
      results.forEach(r => { firstSeenMap[String(r.product_id)] = r.first_seen_at; });
    }

    const missingIds = ids.filter(id => !(id in firstSeenMap));
    if (missingIds.length) {
      const now = new Date().toISOString();
      for (const chunk of chunkArray(missingIds, D1_CHUNK_SIZE)) {
        const stmts = chunk.map(id =>
          env.DB.prepare(
            `INSERT INTO product_first_seen (product_id, first_seen_at) VALUES (?, ?)
             ON CONFLICT(product_id) DO NOTHING`
          ).bind(id, now)
        );
        await env.DB.batch(stmts);
      }
      missingIds.forEach(id => { firstSeenMap[id] = now; });
    }
  } catch (e) {
    // Table missing or D1 unavailable — fall back to no bonus
  }

  return firstSeenMap;
}

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

// ── Category filter helpers ────────────────────────────────────────────────

/**
 * แยก category string ออกเป็น top-level vs sub-level
 *
 * กฎ: ถ้า category มี " > " คั่น → ส่วนแรก = top, ส่วนที่เหลือ = sub
 *      ถ้าไม่มี " > " → top = category นั้นเลย, sub = null
 *
 * ตัวอย่าง:
 *   "Pet Supplies > Dogs > Health Supplies > Relaxants"
 *     → top: "Pet Supplies", sub: "Dogs > Health Supplies > Relaxants"
 *   "Electronics"
 *     → top: "Electronics", sub: null
 */
function splitCategory(cat) {
  const idx = cat.indexOf(' > ');
  if (idx === -1) return { top: cat, sub: null };
  return { top: cat.slice(0, idx), sub: cat.slice(idx + 3) };
}

/**
 * สร้าง HTML ของ category filter แบบ C:
 *   แถวเดียว = pills หมวดหลัก (top-level) + ปุ่ม dropdown "หมวดย่อย ▾"
 *   dropdown แสดงเฉพาะ sub ของ top ที่ active อยู่
 *
 * URL param ยังคง ?category= เหมือนเดิม ไม่ต้องเปลี่ยน backend เลย
 */
function buildFilterHtml({ categories, selectedCategory, lang, t }) {
  if (!categories.length) return '';

  const base = homePath(lang);

  // สร้าง map: topLevel → [ { sub, fullCat } ]
  const topMap = {};   // top → count (เพื่อ sort)
  const subMap = {};   // top → [ { sub, fullCat } ]

  categories.forEach(cat => {
    const { top, sub } = splitCategory(cat);
    topMap[top] = (topMap[top] || 0) + 1;
    if (sub) {
      if (!subMap[top]) subMap[top] = [];
      subMap[top].push({ sub, fullCat: cat });
    }
  });

  // top-level pills เรียง descending ตามจำนวนสินค้า (ตัดให้สั้น ≤ 4 คำ)
  const tops = Object.keys(topMap).sort((a, b) => topMap[b] - topMap[a]);

  // active top = top ของ selectedCategory (หรือ null ถ้า All)
  const activeTop = selectedCategory ? splitCategory(selectedCategory).top : null;

  // sub dropdown สำหรับ top ที่ active
  const activeSubs = activeTop ? (subMap[activeTop] || []) : [];

  // ──────────────────────────────────────────────
  // CSS (inject ครั้งเดียว)
  // ──────────────────────────────────────────────
  const css = `
<style id="cf-style">
.cf-wrap{
  display:flex; align-items:center; flex-wrap:wrap;
  gap:8px; margin-bottom:20px; position:relative;
}
/* pill หมวดหลัก */
.cf-pill{
  display:inline-flex; align-items:center;
  padding:7px 16px; border-radius:99px;
  border:1px solid var(--hairline);
  font-size:13px; color:var(--ink);
  text-decoration:none; white-space:nowrap;
  transition:background .15s, border-color .15s;
  -webkit-tap-highlight-color:transparent;
  touch-action:manipulation;
}
/* จำกัด :hover ให้ใช้เฉพาะอุปกรณ์ที่มีเมาส์จริง —
   บน iOS/mobile Safari การมี :hover บน <a> ทำให้แตะครั้งแรก
   ถูกตีความเป็น hover-state แทน click จริง (ต้องแตะ 2 ครั้ง) */
@media (hover: hover) and (pointer: fine) {
  .cf-pill:hover{ background:var(--surface); border-color:var(--accent); }
}
.cf-pill.is-active{
  background:var(--ink); color:var(--surface);
  border-color:var(--ink);
}
/* ปุ่ม dropdown หมวดย่อย */
.cf-dd-btn{
  display:inline-flex; align-items:center; gap:5px;
  padding:7px 14px; border-radius:99px;
  border:1px solid var(--hairline);
  font-size:13px; color:var(--ink);
  background:var(--bg,#fff); cursor:pointer;
  white-space:nowrap; transition:border-color .15s;
  -webkit-tap-highlight-color:transparent;
  touch-action:manipulation;
}
@media (hover: hover) and (pointer: fine) {
  .cf-dd-btn:hover{ border-color:var(--accent); }
}
.cf-dd-btn.has-active{
  border-color:var(--accent); color:var(--accent);
}
.cf-dd-btn .cf-chevron{
  font-size:10px; transition:transform .2s; display:inline-block;
}
.cf-dd-btn.open .cf-chevron{ transform:rotate(180deg); }
/* dropdown panel */
.cf-dd-panel{
  position:absolute; top:calc(100% + 6px); left:0;
  min-width:220px; max-width:320px;
  background:var(--surface,#fff);
  border:1px solid var(--hairline);
  border-radius:12px; padding:6px;
  box-shadow:0 4px 16px rgba(0,0,0,.10);
  z-index:99; display:none; flex-direction:column; gap:2px;
  pointer-events:none;
}
.cf-dd-panel.open{ display:flex; pointer-events:auto; }
/* link ภายใน dropdown */
.cf-dd-item{
  display:block; padding:8px 12px; border-radius:8px;
  font-size:13px; color:var(--ink);
  text-decoration:none; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis;
  transition:background .12s;
}
.cf-dd-item:hover{ background:var(--surface); }
.cf-dd-item.is-active{
  background:var(--ink); color:var(--surface);
}
/* ซ่อนปุ่มถ้าไม่มี sub */
.cf-dd-btn[hidden]{ display:none; }
</style>`;

  // ──────────────────────────────────────────────
  // Pills หมวดหลัก
  // ──────────────────────────────────────────────
  const pillsHtml = [
    // "ทั้งหมด" / "All"
    `<a href="${base}" class="cf-pill${!selectedCategory ? ' is-active' : ''}">${escapeHtml(t.filterAll)}</a>`,
    // top-level categories
    ...tops.map(top => {
      // ถ้าคลิก pill top → link ไปที่ full category ที่มีคนเดียว หรือ top เอง
      // ถ้า top มี sub → link = top เอง (filter เฉพาะ top, ไม่ใช่ fullCat)
      const href = `${base}?category=${encodeURIComponent(top)}`;
      const isActive = activeTop === top;
      return `<a href="${href}" class="cf-pill${isActive ? ' is-active' : ''}">${escapeHtml(top)}</a>`;
    })
  ].join('\n    ');

  // ──────────────────────────────────────────────
  // Dropdown หมวดย่อย (แสดงเฉพาะถ้า activeTop มี sub)
  // ──────────────────────────────────────────────
  const hasSubs = activeSubs.length > 0;

  // label ของปุ่ม: ถ้า selectedCategory เป็น sub ให้โชว์ชื่อ sub ที่เลือกอยู่
  const selectedSub = selectedCategory && activeTop && selectedCategory !== activeTop
    ? splitCategory(selectedCategory).sub
    : null;
  const ddLabel = selectedSub
    ? truncateLabel(selectedSub, 28)
    : escapeHtml(t.filterSubcategory);
  const ddHasActive = !!selectedSub;

  const ddItemsHtml = activeSubs.map(({ sub, fullCat }) => {
    const isActive = selectedCategory === fullCat;
    const href = `${base}?category=${encodeURIComponent(fullCat)}`;
    return `<a href="${href}" class="cf-dd-item${isActive ? ' is-active' : ''}" title="${escapeHtml(sub)}">${escapeHtml(truncateLabel(sub, 36))}</a>`;
  }).join('\n      ');

  const dropdownHtml = hasSubs ? `
  <div style="position:relative;">
    <button class="cf-dd-btn${ddHasActive ? ' has-active' : ''}" id="cf-dd-btn" type="button" aria-haspopup="listbox" aria-expanded="false">
      ${ddLabel} <span class="cf-chevron">▾</span>
    </button>
    <div class="cf-dd-panel" id="cf-dd-panel" role="listbox">
      ${ddItemsHtml}
    </div>
  </div>` : '';

  // ──────────────────────────────────────────────
  // JS toggle (minimal — ไม่ใช้ framework)
  // ──────────────────────────────────────────────
  const js = hasSubs ? `
<script>
(function(){
  var btn = document.getElementById('cf-dd-btn');
  var panel = document.getElementById('cf-dd-panel');
  if(!btn||!panel) return;
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    var open = panel.classList.toggle('open');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', function(){
    panel.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', false);
  });
})();
</script>` : '';

  return `${css}
<div class="cf-wrap">
  ${pillsHtml}
  ${dropdownHtml}
</div>${js}`;
}

/** ตัดชื่อยาวให้สั้น พร้อม ellipsis */
function truncateLabel(str, max) {
  if (!str) return '';
  return str.length > max ? escapeHtml(str.slice(0, max - 1)) + '…' : escapeHtml(str);
}

// ──────────────────────────────────────────────────────────────────────────

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

  const scoredArticles = [...articles].sort((a, b) => {
    const clicksA = clickCounts[String(a.id)] || 0;
    const clicksB = clickCounts[String(b.id)] || 0;
    return clicksB - clicksA;
  });

  const clickedValues = Object.values(clickCounts).filter(v => v > 0);
  const avgClicks = clickedValues.length
    ? clickedValues.reduce((sum, v) => sum + v, 0) / clickedValues.length
    : 0;
  const hotThreshold = Math.max(3, Math.round(avgClicks * 1.5));

  const selectedCategory = request ? new URL(request.url).searchParams.get('category') : null;

  // ── Category filter ────────────────────────────────────────────────────
  // นับจาก articles ทั้งหมด (ไม่ filter ก่อน) เพื่อให้ pills โชว์ครบทุกหมวด
  const MIN_PRODUCTS_PER_CATEGORY = 2;
  const categoryCounts = {};
  articles.forEach(a => {
    if (a.category) {
      // นับทั้ง full path และ top-level
      categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
      const { top } = splitCategory(a.category);
      if (top !== a.category) {
        categoryCounts[top] = (categoryCounts[top] || 0) + 1;
      }
    }
  });
  const categories = Object.keys(categoryCounts)
    .filter(cat => categoryCounts[cat] >= MIN_PRODUCTS_PER_CATEGORY)
    .sort((a, b) => categoryCounts[b] - categoryCounts[a]);

  // filter articles ตาม selectedCategory
  // - ไม่มี " > " = top-level → match ทุก article ที่ category ขึ้นต้นด้วย top นั้น
  // - มี " > " = full path → exact match
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

  // ── สร้าง filterHtml แบบ C ─────────────────────────────────────────────
  const filterHtml = buildFilterHtml({ categories, selectedCategory, lang, t });

  // ── Split top / new arrivals ───────────────────────────────────────────
  const topArticles = displayScoredArticles.slice(0, TOP_SECTION_COUNT);
  const topIds = new Set(topArticles.map(a => String(a.id)));

  const newArrivalArticles = displayScoredArticles
    .filter(a => !topIds.has(String(a.id)))
    .sort((a, b) => {
      const dateA = firstSeenMap[String(a.id)] ? new Date(firstSeenMap[String(a.id)]).getTime() : -Infinity;
      const dateB = firstSeenMap[String(b.id)] ? new Date(firstSeenMap[String(b.id)]).getTime() : -Infinity;
      return dateB - dateA;
    });

  const topCardsHtml = renderCardGrid(topArticles, { t, lang, clickCounts, hotThreshold, startRank: 0, newProductIds });
  const newArrivalsCardsHtml = renderCardGrid(newArrivalArticles, { t, lang, clickCounts, hotThreshold, startRank: TOP_SECTION_COUNT, newProductIds });

  const newArrivalsSectionHtml = newArrivalArticles.length ? `
    <h2 style="font-size:20px;margin:36px 0 4px;">${escapeHtml(t.newArrivalsHeading)}</h2>
    <p class="meta" style="margin-bottom:20px;">${escapeHtml(t.newArrivalsSub)}</p>
    <div class="card-grid">${newArrivalsCardsHtml}</div>
  ` : '';

  // ── Search UI ───────────────────────────────────────────────────────────
  // NOTE: split into two pieces on purpose.
  //   1) searchButtonHtml — just the round 🔍 button + expandable input.
  //      This gets handed to renderCommunityHub() so it renders INLINE,
  //      as the rightmost item in the Telegram/Discord/... chip row.
  //   2) searchStylesAndScript — CSS + JS + the "no results" message.
  //      Rendered on the page regardless of where the button ends up.
  const searchButtonHtml = articles.length ? `
    <div class="sb-wrap">
      <button class="sb-btn" id="sbBtn" aria-label="ค้นหาสินค้า" onclick="toggleSearch()">🔍</button>
      <input type="text" id="sbInput" class="sb-input"
        placeholder="${escapeHtml(t.searchPlaceholder)}"
        autocomplete="off" oninput="filterProductCards(this.value)">
    </div>
  ` : '';

  const searchStylesAndScript = articles.length ? `
  <style>
    /* Fallback styles — only apply when the Community Hub is hidden and the
       search button renders standalone above the category filter instead of
       inside the chip row (which has its own copy of these rules). */
    .sb-wrap{ position:relative; display:inline-flex; align-items:center; }
    .sb-btn{
      width:38px; height:38px; border-radius:50%;
      border:1px solid var(--hairline); background:var(--surface);
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      font-size:17px; flex-shrink:0; transition:border-color .15s;
      color:var(--ink);
    }
    .sb-btn:hover{ border-color:var(--accent); }
    .sb-input{
      position:absolute; left:46px; top:50%; transform:translateY(-50%);
      width:0; opacity:0; pointer-events:none;
      box-sizing:border-box; height:38px; padding:0;
      border:1px solid var(--hairline); border-radius:10px;
      background:var(--surface); color:var(--ink);
      font-size:15px; font-family:inherit;
      transition:width .25s ease, opacity .2s ease, padding .2s ease;
      z-index:5;
    }
    .sb-input.open{
      width:220px; opacity:1; pointer-events:auto;
      padding:0 14px;
    }
    @media(max-width:400px){ .sb-input.open{ width:calc(100vw - 80px); } }
    .sb-no-results{ display:none; color:var(--ink-muted); padding:12px 0 4px; font-size:14px; }
  </style>
  <p id="searchNoResults" class="sb-no-results">${escapeHtml(t.searchNoResults)}</p>
  <script>
    function toggleSearch() {
      var inp = document.getElementById('sbInput');
      var open = inp.classList.toggle('open');
      if (open) { inp.focus(); } else { inp.value=''; filterProductCards(''); }
    }
    document.addEventListener('click', function(e) {
      var wrap = document.querySelector('.sb-wrap');
      if (wrap && !wrap.contains(e.target)) {
        var inp = document.getElementById('sbInput');
        if (inp && inp.classList.contains('open') && !inp.value) {
          inp.classList.remove('open');
          filterProductCards('');
        }
      }
    });
    function filterProductCards(query) {
      var q = query.trim().toLowerCase();
      var cards = document.querySelectorAll('.card[data-search]');
      var visible = 0;
      cards.forEach(function(card) {
        var match = !q || card.getAttribute('data-search').indexOf(q) !== -1;
        card.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      var noRes = document.getElementById('searchNoResults');
      if (noRes) noRes.style.display = (q && visible === 0) ? 'block' : 'none';
    }
  </script>
` : '';

  const communityHubVisible = await isCommunityHubVisible(env);

  // When the hub is visible, the search button is rendered INSIDE it
  // (rightmost chip, next to Telegram/Discord/...). When it's hidden,
  // the search button is rendered in the header section alongside h1/subheading.
  const communityHubHtml = communityHubVisible
    ? await renderCommunityHub({ mode: 'compact', env, searchBoxHtml: searchButtonHtml })
    : '';

  const body = errorMsg
    ? `<div class="error-page">
        <h1>⚠️</h1>
        <p>${escapeHtml(t.loadErrorPrefix)} ${escapeHtml(errorMsg)}</p>
        <p><a href="${homePath(lang)}">${t.retry}</a></p>
      </div>`
    : (displayScoredArticles.length
      ? `${filterHtml}<div class="card-grid">${topCardsHtml}</div>${newArrivalsSectionHtml}`
      : `${filterHtml}<div class="error-page">
          <p>${escapeHtml(t.empty)}</p>
          <p>${escapeHtml(t.emptySub)}</p>
        </div>`);

  const altLangPath = lang === 'en' ? '/' : '/en/';

  const html = renderPage({
    title: t.pageTitle,
    description: t.pageDescription,
    canonicalPath: homePath(lang),
    lang,
    altLangPath,
    wide: true,
    bodyHtml: `<div style="display:flex; flex-direction:column; gap:8px; margin-bottom:20px;">
  <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
    <div style="flex:1;">
      <h1 style="font-size:26px;margin:0 0 6px;line-height:1.2;">${escapeHtml(t.heading)}</h1>
      <p class="meta" style="margin:0;">${escapeHtml(t.subheading)}</p>
    </div>
    <div style="flex-shrink:0; display:flex; gap:8px; align-items:center; margin-top:2px;">
      ${communityHubHtml}
      ${searchButtonHtml}
    </div>
  </div>
</div>
${searchStylesAndScript}
${body}`
  });

  return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
}
