import { getLiveArticles } from './d1-articles.js';
import { renderPage, escapeHtml, toListItems, uiStrings } from './layout.js';
import {
  DEAL_CSS, DEAL_FONT_LINK, SEARCH_SCRIPT,
  renderTrustBar, renderChips, renderHero, renderCardGrid, renderFeed,
  renderComparison, renderAlertCard, renderPagination, renderDealBody,
} from './deal-ui.js';
import { renderCommunityHub } from './community-hub.js';

/**
 * 🔧 GRAVITY FIX (2026-09-20) — สรุปการแก้ (โค้ดเดิมที่เหลือไม่แตะ):
 *  1) pickProHighlight(): แปลง "\n" literal เป็นบรรทัดจริง, แตก "•" ที่ค้างในบรรทัดเดียว,
 *     และเลือกเฉพาะจุดเด่นที่ภาษาตรงกับหน้า (TH/EN) — กันข้อความอังกฤษโผล่บนหน้าไทย
 *  2) ป้าย "🆕 ใหม่"/recency boost: ถ้าสินค้า >50% ถูกนับว่า "ใหม่" (เช่น ตาราง
 *     product_first_seen ถูก seed พร้อมกันทีเดียว) ถือว่าข้อมูลวันที่ใช้ไม่ได้ ปิดป้ายและ boost
 *  3) seed first_seen จากวันที่สร้างจริงของบทความ (ถ้ามี) แทน "ตอนนี้" เสมอ
 *  4) ป้าย "🔥 มาแรง" แปลตามภาษา (เดิม hardcode ไทยบนหน้า EN)
 *  5) เพิ่ม <h1> (ซ่อนด้วย CSS) ให้หน้าแรก — เดิมไม่มี h1 เลย
 *
 * 🔧 GRAVITY FIX (2026-09-20b) — หน้าแรกสำหรับตลาดโลก:
 *  6) หน้าแรกโชว์ niche เดียว: ใช้ env HOME_NICHE (ชื่อหมวดหลักภาษาอังกฤษ เช่น
 *     "Pet Supplies") ถ้าไม่ตั้งจะเลือกหมวดหลักที่มีบทความมากที่สุดให้อัตโนมัติ
 *     ตั้ง HOME_NICHE=all เพื่อปิดการกรอง (บทความนอก niche ยังเข้าได้ทาง URL/sitemap)
 *     ตัวกรองด้านบนเหลือ "ทั้งหมด" + dropdown หมวดย่อยของ niche
 *  7) ย้าย Community Hub (ปุ่มโซเชียล) ลงล่างสุดของหน้า ช่องค้นหาอยู่บนหัวหน้าเสมอ
 *
 * 🎨 GRAVITY UI (2026-09-30) — หน้าแรกใช้ดีไซน์ Deal-style ใหม่ (deal-ui.js):
 *  - เปลี่ยนเฉพาะการแสดงผล (UI) — ตรรกะดึงข้อมูล/จัดอันดับ/กรอง/แบ่งหน้าเหมือนเดิมทุกอย่าง
 *  - ทุกตัวเลข/ข้อความที่โชว์มาจากข้อมูลจริงเท่านั้น (ราคา เรตติ้ง แบรนด์ หมวด อันดับ)
 *    ส่วนที่ระบบไม่มีข้อมูล (ส่วนลด %, ราคาเดิม, สต็อก, โค้ดคูปอง, นับถอยหลัง) จะไม่ถูกแสดง
 *
 * 🔧 GRAVITY CHANGE (2026-09-20c) — สลับโครงหน้าแรก:
 *  8) หน้าแรก: en = /  , th = /th/  (/en/ redirect มาที่ /)
 *     แก้ที่ homePath() และ altLangPath เท่านั้น
 */

// Cache ค่า toggle 60 วิ ถ้า D1 error หรือยังไม่เคยตั้งค่า -> ซ่อนไว้ก่อน (fail-safe)
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
    hotBadge: '🔥 มาแรง',
    newArrivalsHeading: 'สินค้าใหม่ล่าสุด',
    newArrivalsSub: 'สินค้าที่เพิ่งเข้าระบบล่าสุด เรียงตามวันที่เจอครั้งแรก ไม่ปนกับยอดคลิก',
    searchPlaceholder: 'ค้นหาสินค้า...',
    searchNoResults: 'ไม่พบสินค้าที่ตรงกับคำค้นหา',
    filterAll: 'ทั้งหมด',
    filterSubcategory: 'หมวดย่อย',
    pagePrev: '← ก่อนหน้า',
    pageNext: 'ถัดไป →',
    pageOf: (p, total) => `หน้า ${p} จาก ${total}`,
    trustLine: 'คัดสรรโดยทีมงาน อัปเดตอัตโนมัติ',
    trustCount: n => `${Number(n).toLocaleString('th-TH')} รีวิว`,
    trustRating: r => `เรตติ้งเฉลี่ย ${r}/5`,
    liveLabel: 'อัปเดตอัตโนมัติ',
    heroLabel: 'รีวิวอันดับ 1',
    ctaRead: 'อ่านรีวิวฉบับเต็ม',
    buyBtn: 'ดูราคา / ซื้อสินค้า',
    cardCta: 'อ่านรีวิว',
    feedHeading: 'รีวิวยอดนิยม',
    viewAll: 'ดูทั้งหมด',
    cmpHeading: 'ตารางเทียบสินค้า',
    cmpModel: 'รุ่น',
    cmpBrand: 'แบรนด์',
    cmpRating: 'เรตติ้ง',
    cmpPrice: 'ราคา',
    cmpVerdict: n => `สรุป: ${n} ได้อันดับ 1 จากคะแนนรวมของระบบ 🏆`,
    alertTitle: 'ติดตามรีวิวและดีลใหม่',
    alertSub: 'เข้าร่วมชุมชนของเราเพื่อรับอัปเดตสินค้า',
    disclosureTitle: 'คำชี้แจงโปร่งใส (Affiliate Disclosure)',
    navHome: 'หน้าแรก',
    navCategories: 'หมวดหมู่',
    navCompare: 'เทียบสินค้า',
    navAlerts: 'แจ้งเตือนดีล',
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
    hotBadge: '🔥 Hot',
    newArrivalsHeading: 'Newest arrivals',
    newArrivalsSub: 'Recently added products, sorted purely by first-seen date — not mixed with click count.',
    searchPlaceholder: 'Search products...',
    searchNoResults: 'No products match your search.',
    filterAll: 'All',
    filterSubcategory: 'Subcategory',
    pagePrev: '← Previous',
    pageNext: 'Next →',
    pageOf: (p, total) => `Page ${p} of ${total}`,
    trustLine: 'Curated by our team, auto-updated.',
    trustCount: n => `${Number(n).toLocaleString('en-US')} reviews`,
    trustRating: r => `Avg. rating ${r}/5`,
    liveLabel: 'Auto-updated',
    heroLabel: 'Top-ranked review',
    ctaRead: 'Read the full review',
    buyBtn: 'Check price / Buy',
    cardCta: 'Read review',
    feedHeading: 'Top-ranked reviews',
    viewAll: 'View all',
    cmpHeading: 'Side-by-side',
    cmpModel: 'Model',
    cmpBrand: 'Brand',
    cmpRating: 'Rating',
    cmpPrice: 'Price',
    cmpVerdict: n => `Verdict: ${n} ranks #1 on our combined score 🏆`,
    alertTitle: 'Follow new reviews & deals',
    alertSub: 'Join our community for product updates.',
    disclosureTitle: 'Affiliate Disclosure',
    navHome: 'Home',
    navCategories: 'Categories',
    navCompare: 'Compare',
    navAlerts: 'Deal alerts',
  }
};

// ── Text helpers (GRAVITY FIX 2026-09-20) ──────────────────────────────────
function normalizeNewlines(text) {
  return String(text ?? '')
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\r\n?/g, '\n');
}

function thaiRatio(s) {
  const letters = String(s).replace(/[^A-Za-z\u0E00-\u0E7F]/g, '');
  if (!letters.length) return 0;
  return (letters.match(/[\u0E00-\u0E7F]/g) || []).length / letters.length;
}

// เลือกจุดเด่นข้อแรกที่ภาษาตรงกับหน้า ถ้าไม่มีที่ตรงเลย -> null (ไม่โชว์ ดีกว่าโชว์ภาษาปน)
function pickProHighlight(prosText, lang) {
  const items = toListItems(normalizeNewlines(prosText))
    .flatMap(i => i.split(/\s*•\s*/))
    .map(i => i.trim())
    .filter(Boolean);
  for (const item of items) {
    const r = thaiRatio(item);
    if (lang === 'th' ? r >= 0.3 : r <= 0.1) return item;
  }
  return null;
}

// ── Pagination ──────────────────────────────────────────────────────────
// ranking คำนวณจากสินค้าทั้งหมดก่อน แล้วค่อย slice เฉพาะหน้าที่ขอ
const PAGE_SIZE = 24;

function buildPageHref(base, { selectedCategory, page }) {
  const params = new URLSearchParams();
  if (selectedCategory) params.set('category', selectedCategory);
  if (page && page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function buildPaginationHtml({ page, totalPages, lang, t, selectedCategory }) {
  const base = homePath(lang);
  return renderPagination({
    page, totalPages, t,
    hrefFor: p => buildPageHref(base, { selectedCategory, page: p }),
  });
}

// ── Category display-name translations (TH) ────────────────────────────────
// ใช้เฉพาะตอน "แสดงผล" เท่านั้น — ห้ามใช้ค่าที่แปลแล้วไป query/filter/href
// (a.category จาก Grist เป็นอังกฤษดิบเสมอ) หมวดที่ไม่มีคีย์จะ fallback เป็นอังกฤษ
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
 * ลำดับ: 1) categoryThMap จาก Grist `category_th` 2) dictionary ด้านบน
 * 3) ชื่ออังกฤษเดิม — ไม่ throw ไม่ว่ากรณีไหน
 */
function getCategoryLabel(name, lang, categoryThMap) {
  if (lang !== 'th') return name;
  if (categoryThMap && categoryThMap[name]) return categoryThMap[name];
  if (CATEGORY_LABELS_TH[name]) return CATEGORY_LABELS_TH[name];
  return name;
}

// 🔧 (2026-09-20c): en = /  , th = /th/
function homePath(lang) {
  return lang === 'en' ? '/' : '/th/';
}

// D1 จำกัด bound parameters ต่อ query ไว้ที่ 100 ตัว — แบ่ง chunk ละ 90
const D1_CHUNK_SIZE = 90;

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// seedDates: { [productId]: ISO } วันที่สร้างจริงของบทความ (ถ้ามี) ใช้ seed แทน "ตอนนี้"
async function getOrCreateFirstSeenMap(env, productIds, seedDates = {}) {
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
          ).bind(id, seedDates[id] || now)
        );
        await env.DB.batch(stmts);
      }
      missingIds.forEach(id => { firstSeenMap[id] = seedDates[id] || now; });
    }
  } catch (e) {
    // Table missing or D1 unavailable — fall back to no bonus
  }

  return firstSeenMap;
}

// ── Composite ranking score ────────────────────────────────────────────────
// รวม 3 สัญญาณ: click score ที่ decay ตามเวลา + Bayesian rating (ใช้จำนวนคลิก
// เป็น proxy ความน่าเชื่อถือ เพราะไม่มีฟิลด์จำนวนรีวิว) + recency boost

const CLICK_DECAY_EXPONENT = 1.5;
const RATING_CONFIDENCE_M = 10;
const RECENCY_BOOST_DAYS = 7;
const SCORE_WEIGHTS = { click: 0.5, rating: 0.3, recency: 0.2 };

function computeSiteAverageRating(articles) {
  const rated = articles
    .map(a => a.product && a.product.rating)
    .filter(r => r != null && !isNaN(Number(r)));
  if (!rated.length) return 4.0;
  return rated.reduce((sum, r) => sum + Number(r), 0) / rated.length;
}

function bayesianRating(article, clicks, siteAvgRating) {
  const rawRating = article.product && article.product.rating;
  const R = rawRating != null && !isNaN(Number(rawRating)) ? Number(rawRating) : siteAvgRating;
  const v = clicks;
  const m = RATING_CONFIDENCE_M;
  return (v * R + m * siteAvgRating) / (v + m);
}

function timeDecayedClickScore(clicks, firstSeenAt, nowMs) {
  const ageDays = firstSeenAt
    ? Math.max(0, (nowMs - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60 * 24))
    : 9999;
  return clicks / Math.pow(ageDays + 2, CLICK_DECAY_EXPONENT);
}

function recencyBoost(firstSeenAt, nowMs) {
  if (!firstSeenAt) return 0;
  const ageDays = (nowMs - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays >= RECENCY_BOOST_DAYS) return 0;
  return Math.max(0, (RECENCY_BOOST_DAYS - ageDays) / RECENCY_BOOST_DAYS);
}

function computeFinalScores(articles, clickCounts, firstSeenMap, nowMs, useRecency = true) {
  const siteAvgRating = computeSiteAverageRating(articles);

  const raw = articles.map(a => {
    const id = String(a.id);
    const clicks = clickCounts[id] || 0;
    const firstSeenAt = firstSeenMap[id] || null;
    return {
      id,
      clickScoreRaw: timeDecayedClickScore(clicks, firstSeenAt, nowMs),
      weightedRating: bayesianRating(a, clicks, siteAvgRating),
      recency: useRecency ? recencyBoost(firstSeenAt, nowMs) : 0,
    };
  });

  const maxClickScore = Math.max(1e-9, ...raw.map(r => r.clickScoreRaw));

  const scoreById = {};
  raw.forEach(r => {
    const normalizedClick = r.clickScoreRaw / maxClickScore;
    const normalizedRating = r.weightedRating / 5;
    scoreById[r.id] =
      normalizedClick * SCORE_WEIGHTS.click +
      normalizedRating * SCORE_WEIGHTS.rating +
      r.recency * SCORE_WEIGHTS.recency;
  });

  return scoreById;
}

// ── Category filter helpers ────────────────────────────────────────────────

function splitCategory(cat) {
  const idx = cat.indexOf(' > ');
  if (idx === -1) return { top: cat, sub: null };
  return { top: cat.slice(0, idx), sub: cat.slice(idx + 3) };
}

// 🔧 (2026-09-20b): เลือก niche เดียวของหน้าแรก — env HOME_NICHE = ชื่อหมวดหลัก / 'all' = โชว์ทุกหมวด / ไม่ตั้ง = หมวดหลักที่มีบทความมากที่สุด (ตอนนี้คือสัตว์เลี้ยง: Dogs + Cats)
function pickHomeNiche(articles, env) {
  const configured = String((env && env.HOME_NICHE) || '').trim();
  if (configured.toLowerCase() === 'all') return null;
  if (configured) return configured;

  const counts = {};
  articles.forEach(a => {
    if (a.category) {
      const top = splitCategory(a.category).top;
      counts[top] = (counts[top] || 0) + 1;
    }
  });
  const sorted = Object.entries(counts).sort((x, y) => y[1] - x[1]);
  return sorted.length ? sorted[0][0] : null;
}

function inNiche(article, niche) {
  return !!article.category &&
    (article.category === niche || article.category.startsWith(niche + ' > '));
}

// Category chips (horizontal scroll). Same data + same links as the old pill/dropdown filter:
// "All" + (niche mode: sub-categories of the niche | otherwise: top-level categories).
function buildChips({ categories, selectedCategory, lang, t, categoryThMap, niche = null }) {
  if (!categories.length) return '';
  const base = homePath(lang);

  const topMap = {};
  const subMap = {};
  categories.forEach(cat => {
    const { top, sub } = splitCategory(cat);
    topMap[top] = (topMap[top] || 0) + 1;
    if (sub) (subMap[top] = subMap[top] || []).push({ sub, fullCat: cat });
  });
  const tops = Object.keys(topMap).sort((a, b) => topMap[b] - topMap[a]);
  const activeTop = niche || (selectedCategory ? splitCategory(selectedCategory).top : null);
  const activeSubs = activeTop ? (subMap[activeTop] || []) : [];

  const chips = [{ label: t.filterAll, href: base, active: !selectedCategory, kind: 'all' }];
  if (!niche) {
    tops.forEach(top => chips.push({
      label: getCategoryLabel(top, lang, categoryThMap),
      href: `${base}?category=${encodeURIComponent(top)}`,
      active: activeTop === top && selectedCategory === top,
      kind: 'cat',
    }));
  }
  activeSubs.forEach(({ sub, fullCat }) => chips.push({
    label: getCategoryLabel(sub, lang, categoryThMap),
    href: `${base}?category=${encodeURIComponent(fullCat)}`,
    active: selectedCategory === fullCat,
    kind: 'cat',
  }));

  return chips.length > 1 ? renderChips(chips) : '';
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

  // 🔧 (2026-09-20b): หน้าแรกโชว์ niche เดียว (ถ้ากรองแล้วว่าง ให้ย้อนกลับไปโชว์ทั้งหมด)
  let niche = null;
  if (!errorMsg && articles.length) {
    niche = pickHomeNiche(articles, env);
    if (niche) {
      const inside = articles.filter(a => inNiche(a, niche));
      if (inside.length) articles = inside;
      else niche = null;
    }
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

  // GRAVITY FIX (2026-09-20): seed first_seen จากวันที่สร้างจริงของบทความ (ถ้ามี)
  const seedDates = {};
  articles.forEach(a => {
    const d = a.createdAt || a.created_at || a.publishedAt;
    if (d && !isNaN(Date.parse(d))) seedDates[String(a.id)] = new Date(d).toISOString();
  });
  const firstSeenMap = await getOrCreateFirstSeenMap(env, articles.map(a => a.id), seedDates);

  const NEW_BADGE_DAYS = 3;
  const nowMs = Date.now();
  let newProductIds = new Set(
    articles
      .filter(a => {
        const firstSeen = firstSeenMap[String(a.id)];
        if (!firstSeen) return false;
        const ageDays = (nowMs - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24);
        return ageDays <= NEW_BADGE_DAYS;
      })
      .map(a => String(a.id))
  );

  // GRAVITY FIX (2026-09-20): ถ้า "ใหม่" เกินครึ่ง แปลว่าวันที่ถูก seed พร้อมกัน
  // (ไม่ใช่ข้อมูลจริง) ปิดป้ายและ recency boost กันทุกการ์ดขึ้นป้าย "ใหม่"
  const bulkSeeded = articles.length > 4 && newProductIds.size > articles.length * 0.5;
  if (bulkSeeded) newProductIds = new Set();

  const finalScoreById = computeFinalScores(articles, clickCounts, firstSeenMap, nowMs, !bulkSeeded);

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
  const categoryThMap = {};
  articles.forEach(a => {
    if (a.category) {
      categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
      const { top, sub } = splitCategory(a.category);
      if (top !== a.category) {
        categoryCounts[top] = (categoryCounts[top] || 0) + 1;
      }
      // category_th ใช้รูปแบบ "Top > Sub" ขนานกับ category (EN) ถ้าไม่มีก็ข้าม
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

  const chipsHtml = buildChips({ categories, selectedCategory, lang, t, categoryThMap, niche });

  // ── Pagination (ตัดหลัง sort ด้วย final_score ทั้งชุด) ─────────────────
  const totalCount = displayScoredArticles.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const requestedPage = request ? parseInt(new URL(request.url).searchParams.get('page'), 10) : 1;
  const page = Number.isFinite(requestedPage) && requestedPage >= 1
    ? Math.min(requestedPage, totalPages)
    : 1;
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageArticles = displayScoredArticles.slice(pageStart, pageStart + PAGE_SIZE);

  // หน้า 1: อันดับ 1 = การ์ดเด่น (hero) ที่เหลือเป็นกริด — หน้าอื่นเป็นกริดล้วน
  const heroArticle = page === 1 ? (pageArticles[0] || null) : null;
  const gridArticles = heroArticle ? pageArticles.slice(1) : pageArticles;
  const gridStartRank = pageStart + (heroArticle ? 1 : 0);

  const cardOpts = { t, lang, clickCounts, hotThreshold, startRank: gridStartRank, newProductIds };
  const paginationHtml = buildPaginationHtml({ page, totalPages, lang, t, selectedCategory });

  // ── Real-data summary for the trust bar ────────────────────────────────
  const ratedValues = displayScoredArticles
    .map(a => a.product && a.product.rating)
    .filter(r => r != null && !isNaN(Number(r)))
    .map(Number);
  const avgRating = ratedValues.length
    ? ratedValues.reduce((sum, r) => sum + r, 0) / ratedValues.length
    : null;

  const catLabelOf = a => {
    if (!a || !a.category) return '';
    const { top, sub } = splitCategory(a.category);
    return getCategoryLabel(sub || top, lang, categoryThMap);
  };

  const heroHtml = heroArticle
    ? renderHero(heroArticle, {
        t, lang, clickCounts, hotThreshold,
        isNew: newProductIds.has(String(heroArticle.id)),
        topPro: heroArticle.analysis ? pickProHighlight(heroArticle.analysis.pros, lang) : null,
        categoryLabel: catLabelOf(heroArticle),
      })
    : '';

  const nextPageHref = page < totalPages
    ? buildPageHref(homePath(lang), { selectedCategory, page: page + 1 })
    : null;
  const feedHtml = renderFeed({
    cardsHtml: renderCardGrid(gridArticles, cardOpts),
    t,
    moreHref: nextPageHref,
  });

  // ตารางเทียบ: top 3 ตามอันดับจริงของชุดที่กำลังดู (หน้า 1 เท่านั้น, ต้องมีอย่างน้อย 2 รายการ)
  const cmpLabel = selectedCategory
    ? getCategoryLabel(splitCategory(selectedCategory).sub || splitCategory(selectedCategory).top, lang, categoryThMap)
    : (niche ? getCategoryLabel(niche, lang, categoryThMap) : '');
  const compareHtml = page === 1
    ? renderComparison(displayScoredArticles.slice(0, 3), { t, lang, label: cmpLabel })
    : '';

  // 🔧 (2026-09-20b): community hub ยังควบคุมด้วย toggle เดิม — ตอนนี้แสดงในการ์ด "ติดตามดีล"
  const communityHubVisible = !errorMsg && await isCommunityHubVisible(env);
  const communityHubHtml = communityHubVisible
    ? await renderCommunityHub({ mode: 'compact', env, searchBoxHtml: '' })
    : '';
  const alertHtml = renderAlertCard({ t, hubHtml: communityHubHtml });

  const hasSearch = articles.length > 0 && !errorMsg;
  const noResultsHtml = hasSearch
    ? `<p id="searchNoResults" class="dl-none">${escapeHtml(t.searchNoResults)}</p>`
    : '';

  let contentHtml;
  if (errorMsg) {
    contentHtml = `<div class="dl-empty">
        <h1>⚠️</h1>
        <p>${escapeHtml(t.loadErrorPrefix)} ${escapeHtml(errorMsg)}</p>
        <p><a href="${homePath(lang)}" style="color:var(--primary)">${escapeHtml(t.retry)}</a></p>
      </div>`;
  } else if (displayScoredArticles.length) {
    contentHtml = [
      renderTrustBar({ t, count: totalCount, avgRating }),
      chipsHtml,
      noResultsHtml,
      heroHtml,
      feedHtml,
      paginationHtml,
      compareHtml,
      alertHtml,
    ].join('\n');
  } else {
    contentHtml = `${chipsHtml}<div class="dl-empty">
          <p>${escapeHtml(t.empty)}</p>
          <p>${escapeHtml(t.emptySub)}</p>
        </div>`;
  }

  // 🔧 (2026-09-20c): en = /  , th = /th/
  const altLangPath = lang === 'en' ? '/th/' : '/';

  // หน้า >1: canonical ชี้หน้านั้นเอง + noindex,follow (หน้าแรก index ปกติ)
  const pageCanonicalPath = page > 1
    ? buildPageHref(homePath(lang), { selectedCategory, page })
    : homePath(lang);
  const robotsMeta = page > 1 ? '<meta name="robots" content="noindex,follow">' : '';

  // GRAVITY FIX (2026-09-20): <h1> ซ่อนด้วย CSS (เดิมหน้าแรกไม่มี h1)
  const h1Html = errorMsg ? '' : `<h1 class="dl-h1">${escapeHtml(t.heading)}</h1>`;

  // Bottom nav — ทุกปุ่มชี้ไปที่ส่วนที่มีอยู่จริงบนหน้านี้เท่านั้น
  const showContent = !errorMsg && displayScoredArticles.length > 0;
  const navItems = [{ href: homePath(lang), icon: 'local_fire_department', label: t.navHome, active: true }];
  if (chipsHtml) navItems.push({ href: '#categories', icon: 'category', label: t.navCategories });
  if (showContent && compareHtml) navItems.push({ href: '#compare', icon: 'compare', label: t.navCompare });
  if (showContent && alertHtml) navItems.push({ href: '#alerts', icon: 'campaign', label: t.navAlerts });

  const ui = uiStrings(lang);
  const bodyHtml = renderDealBody({
    t,
    homeHref: homePath(lang),
    altLangPath,
    langLabel: ui.langSwitchLabel,
    hasSearch,
    hasAlerts: showContent && !!alertHtml,
    mainHtml: `${h1Html}\n${contentHtml}\n${hasSearch ? SEARCH_SCRIPT : ''}`,
    footerParagraphs: [ui.aiDisclosureFull, ui.footerDisclaimer],
    navItems,
  });

  const html = renderPage({
    title: page > 1 ? `${t.pageTitle} — ${t.pageOf(page, totalPages)}` : t.pageTitle,
    description: t.pageDescription,
    canonicalPath: pageCanonicalPath,
    lang,
    altLangPath,
    extraHead: robotsMeta,
    bodyHtml: '',
    deal: { css: DEAL_CSS, fontLink: DEAL_FONT_LINK, bodyClass: 'dl', bodyHtml },
  });

  return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
}
