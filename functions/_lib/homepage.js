import { getLiveArticles } from './d1-articles.js';
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
    subheading: 'คัดสรรโดยทีมงาน อัปเดตอัตโนมัติ',
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
    pagePrev: '← ก่อนหน้า',
    pageNext: 'ถัดไป →',
    pageOf: (p, total) => `หน้า ${p} จาก ${total}`,
  },
  en: {
    pageTitle: 'GRAVITY OS — Curated product reviews',
    pageDescription: 'Product reviews and buying guides, summarized so you can decide fast.',
    heading: 'Latest reviews',
    subheading: 'Curated by our team, auto-updated.',
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
    pagePrev: '← Previous',
    pageNext: 'Next →',
    pageOf: (p, total) => `Page ${p} of ${total}`,
  }
};

// ── Pagination ──────────────────────────────────────────────────────────
// หน้าแรกเดิมโหลดสินค้า "ทั้งหมด" มา render เป็น <div class="card-grid"> เดียว
// ไม่มี limit เลย — ยิ่งสินค้าในระบบโตขึ้นเรื่อยๆ (ตอนนี้หลักร้อยแล้ว) ยิ่งทำให้
// หน้าแรกหนักขึ้นเรื่อยๆ ทั้ง initial HTML payload และเวลา render รูปทั้งหมด
// พร้อมกัน ต่อไปนี้ตัดเป็นหน้าละ PAGE_SIZE ชิ้น โดยยังคง final_score ranking
// เดิมทั้งชุดไว้ก่อน แล้วค่อย slice เฉพาะหน้าที่ขอมา (ranking ต้องคำนวณจาก
// สินค้าทั้งหมดเสมอ ตัดหลัง sort ไม่ใช่ตัดก่อน ไม่งั้นอันดับจะผิด)
const PAGE_SIZE = 24;

function buildPageHref(base, { selectedCategory, page }) {
  const params = new URLSearchParams();
  if (selectedCategory) params.set('category', selectedCategory);
  if (page && page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function buildPaginationHtml({ page, totalPages, lang, t, selectedCategory }) {
  if (totalPages <= 1) return '';
  const base = homePath(lang);

  const prevHref = page > 1 ? buildPageHref(base, { selectedCategory, page: page - 1 }) : null;
  const nextHref = page < totalPages ? buildPageHref(base, { selectedCategory, page: page + 1 }) : null;

  // แสดงเลขหน้าแบบย่อ: หน้าปัจจุบัน ± 2 เสมอ บวกหน้าแรก/หน้าสุดท้าย พร้อม "…"
  // คั่นตรงจุดที่ข้าม กันไม่ให้แถวเลขหน้ายาวเกินไปเวลาสินค้าเยอะมากๆ
  const windowSize = 2;
  const pageNums = new Set([1, totalPages]);
  for (let p = page - windowSize; p <= page + windowSize; p++) {
    if (p >= 1 && p <= totalPages) pageNums.add(p);
  }
  const sortedPages = [...pageNums].sort((a, b) => a - b);

  let numbersHtml = '';
  let prevNum = 0;
  for (const p of sortedPages) {
    if (prevNum && p - prevNum > 1) {
      numbersHtml += `<span class="pg-ellipsis">…</span>`;
    }
    const isActive = p === page;
    const href = buildPageHref(base, { selectedCategory, page: p });
    numbersHtml += isActive
      ? `<span class="pg-num pg-active" aria-current="page">${p}</span>`
      : `<a class="pg-num" href="${escapeHtml(href)}">${p}</a>`;
    prevNum = p;
  }

  const css = `
<style id="pg-style">
.pg-wrap{
  display:flex; align-items:center; justify-content:center; flex-wrap:wrap;
  gap:6px; margin:32px 0 8px;
}
.pg-num, .pg-nav{
  display:inline-flex; align-items:center; justify-content:center;
  min-width:36px; height:36px; padding:0 10px; border-radius:8px;
  border:1px solid var(--hairline); font-size:14px; color:var(--ink);
  text-decoration:none; -webkit-tap-highlight-color:transparent;
}
.pg-num:hover, .pg-nav:hover{ border-color:var(--accent); color:var(--accent); }
.pg-active{
  background:var(--ink); border-color:var(--ink); color:#fff !important;
  font-weight:600;
}
.pg-ellipsis{ color:var(--ink-muted); padding:0 4px; user-select:none; }
.pg-nav.is-disabled{
  opacity:.35; pointer-events:none;
}
.pg-status{
  width:100%; text-align:center; font-size:12px; color:var(--ink-muted);
  margin-top:6px;
}
</style>`;

  return `${css}
<nav class="pg-wrap" aria-label="Pagination">
  ${prevHref ? `<a class="pg-nav" href="${escapeHtml(prevHref)}">${escapeHtml(t.pagePrev)}</a>` : `<span class="pg-nav is-disabled">${escapeHtml(t.pagePrev)}</span>`}
  ${numbersHtml}
  ${nextHref ? `<a class="pg-nav" href="${escapeHtml(nextHref)}">${escapeHtml(t.pageNext)}</a>` : `<span class="pg-nav is-disabled">${escapeHtml(t.pageNext)}</span>`}
  <div class="pg-status">${escapeHtml(t.pageOf(page, totalPages))}</div>
</nav>`;
}

// ── Category display-name translations (TH) ────────────────────────────────
// ⭐ ใช้เฉพาะตอน "แสดงผล" (label บนปุ่ม/dropdown) เท่านั้น — ห้ามใช้ค่าที่แปลแล้ว
// ไปทำ query/filter หรือ href เด็ดขาด เพราะ a.category ที่ดึงจาก Grist ยังเป็น
// string ภาษาอังกฤษดิบเสมอ (ไม่มีคอลัมน์แปลไทยแยกต่างหากในต้นทาง) การ filter/
// เทียบค่าต้อง match กับ string ดิบนั้นเป๊ะๆ — ดูฟังก์ชัน getCategoryLabel() ด้านล่าง
// ที่ทำหน้าที่เป็น display-layer เท่านั้น ไม่แตะค่าที่ใช้ในลอจิกอื่น
//
// ถ้ามีหมวดใหม่โผล่ใน Grist ที่ยังไม่มีคีย์อยู่ในนี้ getCategoryLabel() จะ
// fallback กลับไปโชว์ชื่ออังกฤษเดิม ไม่ throw ไม่พังหน้าเว็บ — แค่ต้องมาเพิ่ม
// คีย์ใหม่ในนี้เองเวลามีเวลา (ไม่มี auto-translate)
const CATEGORY_LABELS_TH = {
  'Pet Supplies': 'อุปกรณ์สัตว์เลี้ยง',
  'Electronics': 'อิเล็กทรอนิกส์',
  'Automatic Feeders': 'เครื่องให้อาหารอัตโนมัติ',
  'Air Purifiers': 'เครื่องฟอกอากาศ',
  'Sports & Outdoors': 'กีฬาและกิจกรรมกลางแจ้ง',
  'Home & Kitchen': 'บ้านและครัว',
  'Vest Harnesses': 'สายรัดตัว',
  'Health & Household': 'สุขภาพและของใช้ในบ้าน',
  'Luggage & Travel Gear': 'กระเป๋าเดินทาง',
  'Dog Slow Feeders': 'ชามให้อาหารสุนัขแบบช้า',
  'Toys & Games': 'ของเล่นและเกม',
  'Point & Shoot Digital Cameras': 'กล้องดิจิทัลคอมแพค',
};

/**
 * แปลชื่อหมวด/หมวดย่อยเป็นไทยสำหรับ "แสดงผล" เท่านั้น
 * ลำดับความสำคัญ: 1) categoryThMap ที่มาจาก Grist field `category_th` ต่อ
 * สินค้าจริง (ถ้า AI pipeline เขียนคอลัมน์นี้ตอนสร้างสินค้าแล้ว — auto-sync
 * ของจริง ไม่ต้อง deploy โค้ดใหม่เวลามีหมวดใหม่) 2) dictionary hardcode
 * ด้านบน (safety net สำหรับหมวดเก่า/สินค้าเก่าที่ยังไม่มี category_th)
 * 3) คืนชื่ออังกฤษเดิมเป็น fallback สุดท้าย — ไม่ throw ไม่ว่ากรณีไหน
 */
function getCategoryLabel(name, lang, categoryThMap) {
  if (lang !== 'th') return name;
  if (categoryThMap && categoryThMap[name]) return categoryThMap[name];
  if (CATEGORY_LABELS_TH[name]) return CATEGORY_LABELS_TH[name];
  return name;
}

/**
 * Root-relative link to the given lang's home page.
 */
function homePath(lang) {
  return lang === 'en' ? '/en/' : '/';
}

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

// ── Composite ranking score (แทนระบบ 2 โซนเดิม: Top 3 + Newest arrivals) ──
//
// รวม 3 สัญญาณเป็นคะแนนเดียว แล้วเรียงทั้งหน้าจากคะแนนนี้ ไม่แยก section:
//   1. click score ที่ decay ตามเวลา (สูตรทำนอง Hacker News ranking)
//   2. Bayesian-weighted rating (กัน rating เพี้ยนจากสินค้าที่เพิ่งเข้าระบบ/มีข้อมูลน้อย)
//   3. recency boost (สินค้าใหม่ได้แต้มพิเศษที่ค่อยๆ ลดลง ไม่ใช่กันโซนพิเศษให้ตลอดไป)
//
// ⭐ หมายเหตุ: ระบบนี้ไม่มีฟิลด์ "จำนวนรีวิว" (มีแค่ rating ตัวเลขเดียว 0-5)
// สูตร Bayesian ตำรามาตรฐานต้องใช้ v = จำนวนรีวิวจริง แต่เราไม่มีข้อมูลนั้น
// จึงใช้ "จำนวนคลิก" แทนเป็นตัวแทนความน่าเชื่อถือ (proxy for confidence) —
// สินค้าที่มีคนคลิกดูเยอะ ถือว่ามีหลักฐานมากพอจะเชื่อ rating ของมันได้มากขึ้น
// สินค้าที่ยังไม่มีคลิกเลย จะได้ weighted rating ใกล้เคียงค่าเฉลี่ยทั้งเว็บ (C)
// แทนที่จะโดนตัดสินจาก rating ดิบที่อาจมาจากแหล่งข้อมูลต้นทางเพียงจุดเดียว

const CLICK_DECAY_EXPONENT = 1.5;   // ยิ่งสูง ยิ่งลดความสำคัญของคลิกเก่าเร็วขึ้น
const RATING_CONFIDENCE_M = 10;     // pseudo-count ขั้นต่ำก่อนเชื่อ rating ดิบเต็มที่
const RECENCY_BOOST_DAYS = 7;       // จำนวนวันที่ recency boost ค่อยๆ ลดจนเป็น 0
const SCORE_WEIGHTS = { click: 0.5, rating: 0.3, recency: 0.2 };

// C = ค่าเฉลี่ย rating ของสินค้าทั้งหมดที่มี rating จริง (ไม่นับสินค้าที่ไม่มี rating)
function computeSiteAverageRating(articles) {
  const rated = articles
    .map(a => a.product && a.product.rating)
    .filter(r => r != null && !isNaN(Number(r)));
  if (!rated.length) return 4.0; // fallback ถ้ายังไม่มี rating ในระบบเลยสักตัว
  return rated.reduce((sum, r) => sum + Number(r), 0) / rated.length;
}

// weighted_rating = (v × R + m × C) / (v + m)
// v = clicks (proxy แทนจำนวนรีวิวที่ไม่มีจริงในระบบนี้), R = rating ดิบของสินค้า
// (หรือ C ถ้าไม่มี rating เลย — ทำให้สูตรได้ค่า = C พอดี ไม่ลงโทษสินค้าที่ยังไม่มี rating)
function bayesianRating(article, clicks, siteAvgRating) {
  const rawRating = article.product && article.product.rating;
  const R = rawRating != null && !isNaN(Number(rawRating)) ? Number(rawRating) : siteAvgRating;
  const v = clicks;
  const m = RATING_CONFIDENCE_M;
  return (v * R + m * siteAvgRating) / (v + m);
}

// score_from_clicks = clicks / (days_since_first_seen + 2)^1.5 — สูตรทำนอง Hacker News
// สินค้าใหม่คลิกดีจะแซงสินค้าเก่าคลิกเยอะแต่นิ่งไปแล้วได้ตามธรรมชาติ
function timeDecayedClickScore(clicks, firstSeenAt, nowMs) {
  const ageDays = firstSeenAt
    ? Math.max(0, (nowMs - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60 * 24))
    : 9999; // ไม่รู้วันที่ → ถือว่าเก่ามาก กันไม่ให้ได้เปรียบผิดที่
  return clicks / Math.pow(ageDays + 2, CLICK_DECAY_EXPONENT);
}

// recency boost ลดจาก 1 → 0 เชิงเส้นตลอด RECENCY_BOOST_DAYS วัน
// (แทนการกันโซน "สินค้าใหม่" แยกไว้ถาวร — พอครบวันก็หายไปเอง)
function recencyBoost(firstSeenAt, nowMs) {
  if (!firstSeenAt) return 0;
  const ageDays = (nowMs - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays >= RECENCY_BOOST_DAYS) return 0;
  return Math.max(0, (RECENCY_BOOST_DAYS - ageDays) / RECENCY_BOOST_DAYS);
}

// รวมทุก signal เป็น final_score เดียวต่อสินค้า 1 ชิ้น พร้อม normalize แต่ละส่วนให้อยู่ช่วง 0-1
// ก่อนถ่วงน้ำหนัก เพื่อไม่ให้สเกลที่ต่างกัน (คลิกเป็นร้อย vs rating 0-5) บิดผลลัพธ์
function computeFinalScores(articles, clickCounts, firstSeenMap, nowMs) {
  const siteAvgRating = computeSiteAverageRating(articles);

  const raw = articles.map(a => {
    const id = String(a.id);
    const clicks = clickCounts[id] || 0;
    const firstSeenAt = firstSeenMap[id] || null;
    return {
      id,
      clickScoreRaw: timeDecayedClickScore(clicks, firstSeenAt, nowMs),
      weightedRating: bayesianRating(a, clicks, siteAvgRating),
      recency: recencyBoost(firstSeenAt, nowMs),
    };
  });

  const maxClickScore = Math.max(1e-9, ...raw.map(r => r.clickScoreRaw));

  const scoreById = {};
  raw.forEach(r => {
    const normalizedClick = r.clickScoreRaw / maxClickScore;   // 0..1
    const normalizedRating = r.weightedRating / 5;              // 0..1 (สเกล rating คือ 0-5)
    scoreById[r.id] =
      normalizedClick * SCORE_WEIGHTS.click +
      normalizedRating * SCORE_WEIGHTS.rating +
      r.recency * SCORE_WEIGHTS.recency;
  });

  return scoreById;
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
        ${topPro ? `<div class="pro-highlight"><span class="check">✓</span><span>${escapeHtml(topPro)}</span></div>` : ''}
        <div class="cta-btn">${escapeHtml(t.ctaBtn)}</div>
      </div>
    </a>
  `;
  }).join('');
}

// ── Category filter helpers ────────────────────────────────────────────────

function splitCategory(cat) {
  const idx = cat.indexOf(' > ');
  if (idx === -1) return { top: cat, sub: null };
  return { top: cat.slice(0, idx), sub: cat.slice(idx + 3) };
}

function buildFilterHtml({ categories, selectedCategory, lang, t, categoryThMap }) {
  if (!categories.length) return '';

  const base = homePath(lang);

  const topMap = {};
  const subMap = {};

  categories.forEach(cat => {
    const { top, sub } = splitCategory(cat);
    topMap[top] = (topMap[top] || 0) + 1;
    if (sub) {
      if (!subMap[top]) subMap[top] = [];
      subMap[top].push({ sub, fullCat: cat });
    }
  });

  const tops = Object.keys(topMap).sort((a, b) => topMap[b] - topMap[a]);

  const activeTop = selectedCategory ? splitCategory(selectedCategory).top : null;

  const activeSubs = activeTop ? (subMap[activeTop] || []) : [];

  const css = `
<style id="cf-style">
.cf-wrap{
  display:flex; align-items:center; flex-wrap:wrap;
  gap:8px; margin-bottom:20px; position:relative;
}
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
@media (hover: hover) and (pointer: fine) {
  .cf-pill:hover{ background:var(--surface); border-color:var(--accent); }
}
.cf-pill.is-active{
  background:var(--ink); color:var(--surface);
  border-color:var(--ink);
}
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
.cf-dd-btn[hidden]{ display:none; }
</style>`;

  const pillsHtml = [
    `<a href="${base}" class="cf-pill${!selectedCategory ? ' is-active' : ''}">${escapeHtml(t.filterAll)}</a>`,
    ...tops.map(top => {
      const href = `${base}?category=${encodeURIComponent(top)}`;
      const isActive = activeTop === top;
      return `<a href="${href}" class="cf-pill${isActive ? ' is-active' : ''}">${escapeHtml(getCategoryLabel(top, lang, categoryThMap))}</a>`;
    })
  ].join('\n    ');

  const hasSubs = activeSubs.length > 0;

  const selectedSub = selectedCategory && activeTop && selectedCategory !== activeTop
    ? splitCategory(selectedCategory).sub
    : null;
  const ddLabel = selectedSub
    ? truncateLabel(getCategoryLabel(selectedSub, lang, categoryThMap), 28)
    : escapeHtml(t.filterSubcategory);
  const ddHasActive = !!selectedSub;

  const ddItemsHtml = activeSubs.map(({ sub, fullCat }) => {
    const isActive = selectedCategory === fullCat;
    const href = `${base}?category=${encodeURIComponent(fullCat)}`;
    const label = getCategoryLabel(sub, lang, categoryThMap);
    return `<a href="${href}" class="cf-dd-item${isActive ? ' is-active' : ''}" title="${escapeHtml(label)}">${truncateLabel(label, 36)}</a>`;
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

  // final_score เดียวต่อสินค้า = click score (decay ตามเวลา) + Bayesian rating + recency boost
  // แทนที่ "เรียงตามคลิกดิบอย่างเดียว" — ดูรายละเอียดสูตรที่ computeFinalScores() ด้านบน
  const finalScoreById = computeFinalScores(articles, clickCounts, firstSeenMap, nowMs);

  const scoredArticles = [...articles].sort((a, b) => {
    return (finalScoreById[String(b.id)] || 0) - (finalScoreById[String(a.id)] || 0);
  });

  const clickedValues = Object.values(clickCounts).filter(v => v > 0);
  const avgClicks = clickedValues.length
    ? clickedValues.reduce((sum, v) => sum + v, 0) / clickedValues.length
    : 0;
  const hotThreshold = Math.max(3, Math.round(avgClicks * 1.5));

  const selectedCategory = request ? new URL(request.url).searchParams.get('category') : null;

  // ── Category filter ────────────────────────────────────────────────────
  const MIN_PRODUCTS_PER_CATEGORY = 2;
  const categoryCounts = {};
  // ⭐ ใหม่ — เก็บคำแปลไทยต่อ segment (top/sub/full) จาก field category_th
  // ของ Grist จริง (ถ้ามี) มา "เรียนรู้" จากสินค้าแต่ละชิ้นที่ผ่านมา แทนที่จะ
  // พึ่ง dictionary hardcode อย่างเดียว — ถ้า AI pipeline เขียน category_th
  // ให้ทุกสินค้าใหม่แล้ว หมวดใหม่จะมีคำแปลโผล่มาเองโดยไม่ต้อง deploy โค้ด
  const categoryThMap = {};
  articles.forEach(a => {
    if (a.category) {
      categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
      const { top, sub } = splitCategory(a.category);
      if (top !== a.category) {
        categoryCounts[top] = (categoryCounts[top] || 0) + 1;
      }
      // สมมติ category_th ใช้รูปแบบ "Top > Sub" ขนานกับ category (EN) —
      // ถ้าไม่มี category_th เลย (pipeline ยังไม่ได้เขียนคอลัมน์นี้) ข้ามไปเฉยๆ
      // ปล่อยให้ getCategoryLabel() fallback ไปที่ dictionary/EN แทน
      if (a.categoryTh) {
        const { top: topTh, sub: subTh } = splitCategory(a.categoryTh);
        if (!categoryThMap[top]) categoryThMap[top] = topTh;
        if (sub && subTh && !categoryThMap[sub]) categoryThMap[sub] = subTh;
        if (!categoryThMap[a.category]) categoryThMap[a.category] = a.categoryTh;
      }
    }
  });
  const categories = Object.keys(categoryCounts)
    .filter(cat => categoryCounts[cat] >= MIN_PRODUCTS_PER_CATEGORY)
    .sort((a, b) => categoryCounts[b] - categoryCounts[a]);

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

  const filterHtml = buildFilterHtml({ categories, selectedCategory, lang, t, categoryThMap });

  // ── Pagination: ตัด final_score ranking ทั้งชุด (คำนวณจากสินค้าทั้งหมด
  // แล้ว) เหลือแค่หน้าที่ขอมา — เดิมตรงนี้ไม่มี slice เลย ส่ง
  // displayScoredArticles ทั้งชุดเข้า renderCardGrid ตรงๆ ไม่ว่าจะมีกี่ร้อยชิ้น
  const totalCount = displayScoredArticles.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const requestedPage = request ? parseInt(new URL(request.url).searchParams.get('page'), 10) : 1;
  const page = Number.isFinite(requestedPage) && requestedPage >= 1
    ? Math.min(requestedPage, totalPages)
    : 1;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageArticles = displayScoredArticles.slice(pageStart, pageStart + PAGE_SIZE);

  // ── Ranked grid เดียว ─────────────────────────────────────────────────
  // เดิมแยก "Top 3" (ตามคลิก) กับ "Newest arrivals" (ตามวันที่) เป็น 2 ก้อน
  // ตอนนี้ทุกสินค้าเรียงจาก final_score เดียวกันทั้งหน้า (ดู computeFinalScores)
  // สินค้าใหม่ที่ดีจริงจะขึ้นเร็วเอง ไม่ต้องกันโซนพิเศษให้ — badge "🆕 ใหม่"
  // ยังติดอยู่กับการ์ดตามปกติ (ดูจาก newProductIds เหมือนเดิม ไม่เกี่ยวกับ section)
  // startRank ใช้ pageStart แทน 0 เพื่อให้ป้าย "อันดับ N" นับต่อเนื่องข้ามหน้า
  const rankedCardsHtml = renderCardGrid(pageArticles, { t, lang, clickCounts, hotThreshold, startRank: pageStart, newProductIds });
  const paginationHtml = buildPaginationHtml({ page, totalPages, lang, t, selectedCategory });

  // ── Search UI ───────────────────────────────────────────────────────────
  // searchButtonHtml — ส่งไปให้ renderCommunityHub() วางเป็น chip ขวาสุด
  // ในแถว Telegram/Discord/... เมื่อ hub มองเห็น
  // เมื่อ hub ซ่อน → render standalone ใน headerExtra แทน (ผ่าน standaloneSearchHtml)
  const searchButtonHtml = articles.length ? `
    <div class="sb-wrap">
      <span class="sb-icon" aria-hidden="true">🔍</span>
      <input type="text" id="sbInput" class="sb-input"
        placeholder="${escapeHtml(t.searchPlaceholder)}"
        aria-label="${escapeHtml(t.searchPlaceholder)}"
        autocomplete="off" oninput="filterProductCards(this.value)">
    </div>
  ` : '';

  // NOTE: when the community hub is visible, .sb-wrap/.sb-icon/.sb-input are
  // already styled by community-hub.js (it renders the same markup inline in
  // its chip row). This block only needs to style the standalone fallback
  // case (hub hidden) — kept visually identical to the hub version.
  const searchStylesAndScript = articles.length ? `
  <style>
    .sb-wrap{
      display:inline-flex; align-items:center; gap:6px; flex-shrink:0;
      height:38px; padding:0 14px; box-sizing:border-box;
      border:1px solid var(--hairline); border-radius:19px;
      background:var(--surface);
    }
    .sb-icon{ font-size:14px; line-height:1; opacity:.6; flex-shrink:0; }
    .sb-input{
      border:none; outline:none; background:transparent; color:var(--ink);
      font-size:15px; font-family:inherit; width:180px; padding:0;
    }
    .sb-input::placeholder{ color:var(--ink-muted); }
    @media(max-width:480px){ .sb-input{ width:130px; } }
    .sb-no-results{ display:none; color:var(--ink-muted); padding:12px 0 4px; font-size:14px; }
  </style>
  <p id="searchNoResults" class="sb-no-results">${escapeHtml(t.searchNoResults)}</p>
  <script>
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

  // เมื่อ hub มองเห็น: ส่ง searchButtonHtml ไปให้ community-hub.js วาง
  //   เป็น chip ขวาสุดในแถว Telegram/Discord/... (ไม่ render ซ้ำที่อื่น)
  // เมื่อ hub ซ่อน: render search button standalone ใน headerExtra แทน
  const communityHubHtml = communityHubVisible
    ? await renderCommunityHub({ mode: 'compact', env, searchBoxHtml: searchButtonHtml })
    : '';

  // standaloneSearchHtml แสดงเฉพาะตอนที่ hub ซ่อน
  // ตอนที่ hub โชว์ → '' เพราะ searchButtonHtml อยู่ใน communityHubHtml แล้ว
  const standaloneSearchHtml = communityHubVisible ? '' : searchButtonHtml;

  const body = errorMsg
    ? `<div class="error-page">
        <h1>⚠️</h1>
        <p>${escapeHtml(t.loadErrorPrefix)} ${escapeHtml(errorMsg)}</p>
        <p><a href="${homePath(lang)}">${t.retry}</a></p>
      </div>`
    : (displayScoredArticles.length
      ? `${filterHtml}<div class="card-grid">${rankedCardsHtml}</div>${paginationHtml}`
      : `${filterHtml}<div class="error-page">
          <p>${escapeHtml(t.empty)}</p>
          <p>${escapeHtml(t.emptySub)}</p>
        </div>`);

  const altLangPath = lang === 'en' ? '/' : '/en/';

  // หน้า 2 เป็นต้นไปยังคงมี canonical ชี้กลับไปที่หน้านั้นๆ ของตัวเอง (ไม่ใช่
  // หน้า 1) ตามแนวทางของ Google สำหรับ paginated series — แต่กัน index เกิน
  // ความจำเป็นด้วย noindex เฉพาะหน้า >1 (หน้า 1 ยังให้ index ตามปกติ) เพราะ
  // เนื้อหาหน้าในๆ ของ pagination มักไม่มีค่าต่อ SEO เท่าหน้าแรก และช่วยกัน
  // duplicate-content signal จากการมีหลาย URL ที่เนื้อหาคาบเกี่ยวกัน
  const pageCanonicalPath = page > 1
    ? buildPageHref(homePath(lang), { selectedCategory, page })
    : homePath(lang);
  const robotsMeta = page > 1 ? '<meta name="robots" content="noindex,follow">' : '';

  // UPDATED: community hub + search now render as headerExtra so they sit
  // inside <header class="site">, on the same row as the GRAVITY OS logo
  // (wraps to its own full-width line under the logo on narrow screens).
  const html = renderPage({
    title: page > 1 ? `${t.pageTitle} — ${t.pageOf(page, totalPages)}` : t.pageTitle,
    description: t.pageDescription,
    canonicalPath: pageCanonicalPath,
    lang,
    altLangPath,
    wide: true,
    headerExtra: `${communityHubHtml}${standaloneSearchHtml}`,
    extraHead: robotsMeta,
    bodyHtml: `${searchStylesAndScript}
${body}`
  });

  return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
}
