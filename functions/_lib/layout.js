/**
 * Shared design tokens + page shell.
 *
 * Design direction: a quiet, paper-like reading surface — the opposite of
 * a busy "deal site". One signature element (the tilted "who it's for"
 * note) carries the personality; everything else stays disciplined so the
 * actual review content stays the focus.
 */

// Real gravity-blog domain. og:image / og:url must be absolute URLs —
// relative paths are silently ignored by Facebook/Line/X link-preview
// scrapers, and a mismatched/fake domain here (as this used to be —
// 'gravity-blog.example.com' was never replaced) makes Facebook's scraper
// treat og:url as untrustworthy, which can suppress the image preview
// even when og:image itself points at a perfectly valid, reachable URL.
const SITE_URL = 'https://gravity-blog.pages.dev';

// Generic fallback image shown when a product has no image_url — replace
// with a real hosted image (e.g. a logo/banner) once you have one.
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

export const TOKENS = {
  bg: '#F5F6F3',
  surface: '#FFFFFF',
  ink: '#1E2320',
  inkMuted: '#5B655F',
  accent: '#2F6B5E',
  accentSoft: '#E3EEEA',
  // Secondary accent — dusty terracotta, roughly opposite green on the
  // color wheel. Used sparingly (60-30-10) for one-off emphasis, e.g.
  // the #1 rank badge, never as a general-purpose color.
  accent2: '#C1603E',
  accent2Soft: '#F3E2DA',
  hairline: '#DCDFD9',
  radius: '10px'
};

// UI chrome strings that live in layout.js itself (footer disclaimer,
// share row, breadcrumb-adjacent bits) rather than in article.js's
// STRINGS table, since layout.js is shared by both the article page and
// the home page. Keep this the single source of truth for "chrome" copy
// so it isn't duplicated per-page.
const UI_STRINGS = {
  th: {
    footerDisclaimer: 'บทความนี้อาจมีลิงก์พันธมิตร หากคุณซื้อสินค้าผ่านลิงก์ในบทความ เราอาจได้รับค่าคอมมิชชั่นเล็กน้อยโดยไม่มีค่าใช้จ่ายเพิ่มกับคุณ',
    shareLabel: 'แชร์:',
    shareAriaPrefix: 'แชร์ไป',
    langSwitchLabel: 'EN',
    htmlLang: 'th'
  },
  en: {
    footerDisclaimer: 'This article may contain affiliate links. If you buy through a link here, we may earn a small commission at no extra cost to you.',
    shareLabel: 'Share:',
    shareAriaPrefix: 'Share to',
    langSwitchLabel: 'TH',
    htmlLang: 'en'
  }
};

function uiStrings(lang) {
  return UI_STRINGS[lang] || UI_STRINGS.th;
}

const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@400;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap" rel="stylesheet">';

const BASE_CSS = `
  :root{
    --bg:${TOKENS.bg}; --surface:${TOKENS.surface}; --ink:${TOKENS.ink};
    --ink-muted:${TOKENS.inkMuted}; --accent:${TOKENS.accent};
    --accent-soft:${TOKENS.accentSoft}; --accent2:${TOKENS.accent2};
    --accent2-soft:${TOKENS.accent2Soft}; --hairline:${TOKENS.hairline}; --radius:${TOKENS.radius};
  }
  *{ box-sizing:border-box; }
  html{ -webkit-text-size-adjust:100%; }
  body{
    margin:0; background:var(--bg); color:var(--ink);
    font-family:'IBM Plex Sans Thai', system-ui, sans-serif;
    line-height:1.75; font-size:17px;
  }
  h1,h2,h3{ font-family:'Noto Serif Thai', serif; font-weight:700; line-height:1.35; margin:0 0 .5em; }
  a{ color:var(--accent); text-decoration-thickness:1px; }
  a:focus-visible, button:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }
  .wrap{ max-width:720px; margin:0 auto; padding:0 20px; }
  .wrap-wide{ max-width:1240px; margin:0 auto; padding:0 20px; }
  header.site{
    border-bottom:1px solid var(--hairline); padding:22px 0; margin-bottom:8px;
  }
  .site-header-row{ display:flex; align-items:center; justify-content:space-between; }
  header.site a.brand{
    display:inline-flex; align-items:center; gap:9px;
    font-family:'Noto Serif Thai', serif; font-weight:700; font-size:19px;
    color:var(--ink); text-decoration:none; letter-spacing:.01em;
  }
  .brand-mark{ flex-shrink:0; display:block; }
  .lang-switch{
    display:inline-flex; align-items:center; justify-content:center;
    font-size:13px; font-weight:600; color:var(--ink-muted); text-decoration:none;
    border:1px solid var(--hairline); border-radius:6px; padding:5px 10px;
  }
  .lang-switch:hover{ border-color:var(--accent); color:var(--accent); }
  main{ padding:36px 0 80px; }
  footer.site{
    border-top:1px solid var(--hairline); color:var(--ink-muted);
    font-size:14px; padding:24px 0; text-align:center;
  }
  .eyebrow{
    color:var(--ink-muted); font-size:13px; letter-spacing:.06em;
    text-transform:uppercase; margin-bottom:8px;
  }
  .card{
    background:var(--surface); border:1px solid var(--hairline);
    border-radius:12px; margin-bottom:16px; overflow:hidden;
    height:100%; display:flex; flex-direction:column;
    color:inherit; text-decoration:none; cursor:pointer;
    transition:box-shadow .15s ease, border-color .15s ease;
  }
  .card:hover{
    box-shadow:0 6px 16px rgba(30,35,32,0.10); border-color:var(--accent);
  }
  .card-thumb{
    width:100%; height:220px; object-fit:contain; display:block;
    background:var(--surface); padding:16px 24px;
    border-bottom:1px solid var(--hairline);
    box-sizing:border-box;
  }
  .card-thumb-placeholder{
    width:100%; height:220px; display:flex; align-items:center; justify-content:center;
    background:var(--accent-soft); color:var(--ink-muted); font-size:13px;
    border-bottom:1px solid var(--hairline); box-sizing:border-box;
  }
  .card-body{ padding:16px; display:flex; flex-direction:column; flex:1; }
  @media (min-width:900px){
    .card-thumb, .card-thumb-placeholder{ height:180px; padding:14px 18px; }
    .card-body{ padding:14px; }
  }
  .card h2{
    font-size:18px; margin-bottom:8px; line-height:1.4;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
    overflow:hidden;
  }
  .meta{ color:var(--ink-muted); font-size:14px; margin-bottom:8px; }
  .excerpt{
    color:var(--ink); margin-bottom:8px;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
    overflow:hidden;
  }
  .empty{ color:var(--ink-muted); padding:60px 0; text-align:center; }
  .stars{ color:var(--accent); font-size:14px; letter-spacing:1px; }
  .stars .rating-num{
    color:var(--ink-muted); font-size:13px; letter-spacing:normal; margin-left:6px;
  }
  .hero-img{
    width:100%; height:240px; object-fit:cover; border-radius:12px;
    display:block; margin:14px 0 4px; background:var(--accent-soft);
  }
  .gallery{ margin:14px 0 4px; }
  .gallery-main{
    width:100%; height:280px; object-fit:contain; display:block;
    background:var(--surface); border:1px solid var(--hairline);
    border-radius:12px; box-sizing:border-box; padding:12px;
  }
  .gallery-strip{
    display:flex; gap:8px; margin-top:8px; overflow-x:auto;
    scroll-snap-type:x proximity; padding-bottom:2px;
    -webkit-overflow-scrolling:touch;
  }
  .gallery-strip::-webkit-scrollbar{ height:6px; }
  .gallery-strip::-webkit-scrollbar-thumb{ background:var(--hairline); border-radius:3px; }
  .gallery-thumb{
    flex:0 0 auto; width:64px; height:64px; object-fit:contain;
    background:var(--surface); border:1px solid var(--hairline);
    border-radius:8px; scroll-snap-align:start; cursor:pointer;
    padding:4px; box-sizing:border-box;
  }
  .gallery-thumb.is-active{ border-color:var(--accent); border-width:2px; }
  .card-top{ display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .rank-badge{
    background:var(--ink); color:#fff; font-size:12px; font-weight:600;
    padding:3px 10px; border-radius:5px; white-space:nowrap;
  }
  .rank-badge.is-top{ background:var(--accent2); }
  .card-top .eyebrow{ margin-bottom:0; }
  .pro-highlight{
    display:flex; align-items:flex-start; gap:8px; margin:0 0 12px;
    color:var(--ink); font-size:14px; line-height:1.55;
  }
  .pro-highlight .check{ color:var(--accent); font-weight:700; flex-shrink:0; }
  .cta-btn{
    display:block; text-align:center; background:var(--accent); color:#fff !important;
    font-size:15px; font-weight:600; padding:12px; border-radius:8px;
    text-decoration:none; margin-top:auto;
  }
  .cta-btn:hover{ opacity:.92; }
  .updated-line{
    color:var(--ink-muted); font-size:12px; margin-top:10px; padding-top:10px;
    border-top:1px solid var(--hairline);
  }
  .card-grid{
    display:grid; grid-template-columns:1fr; gap:16px;
  }
  @media (min-width:680px){
    .card-grid{ grid-template-columns:repeat(2, 1fr); }
  }
  @media (min-width:900px){
    .card-grid{ grid-template-columns:repeat(3, 1fr); gap:18px; }
  }
  @media (min-width:1080px){
    .card-grid{ grid-template-columns:repeat(4, 1fr); gap:20px; }
  }
  .verdict{
    background:#FBFAF6; border:1px solid var(--hairline);
    border-left:4px solid var(--accent);
    border-radius:2px; padding:18px 20px; margin:28px 0;
    transform:rotate(-0.4deg);
    box-shadow:0 2px 6px rgba(30,35,32,0.06);
  }
  .verdict h3{ font-size:15px; text-transform:uppercase; letter-spacing:.05em;
    color:var(--accent); margin-bottom:10px; font-family:'IBM Plex Sans Thai',sans-serif; font-weight:600; }
  .verdict ul{ margin:0; padding-left:1.2em; }
  .verdict li{ margin-bottom:4px; }
  .buy-btn{
    display:inline-block; background:var(--accent); color:#fff !important;
    padding:12px 22px; border-radius:8px; text-decoration:none;
    font-weight:600; margin:8px 0 4px;
  }
  .buy-btn:hover{ opacity:.92; }
  .article-body{ margin-top:24px; }
  .article-body p{ margin:0 0 1.1em; }
  .article-body ul, .article-body ol{ margin:0 0 1.1em; padding-left:1.4em; }
  .article-body li{ margin-bottom:6px; }
  .article-body h3{ font-size:19px; margin-top:28px; }
  .tags{ margin-top:28px; }
  .tag{
    display:inline-block; background:var(--accent-soft); color:var(--accent);
    font-size:13px; padding:4px 10px; border-radius:999px; margin:0 6px 6px 0;
  }
  .tag a{ color:var(--accent); text-decoration:none; }
  .tag a:hover{ text-decoration:underline; }
  hr.hairline{ border:none; border-top:1px solid var(--hairline); margin:32px 0; }
  @media (max-width:480px){ body{ font-size:16px; } }
  .share-row{ display:flex; align-items:center; gap:8px; margin:16px 0 4px; flex-wrap:wrap; }
  .share-row .share-label{ font-size:13px; color:var(--ink-muted); margin-right:2px; }
  .share-btn{
    display:inline-flex; align-items:center; justify-content:center;
    width:34px; height:34px; border-radius:50%; text-decoration:none;
    background:var(--accent-soft); color:var(--accent) !important;
    font-size:14px; font-weight:600; line-height:1;
  }
  .share-btn:hover{ background:var(--accent); color:#fff !important; }
  .breadcrumb{
    font-size:13px; color:var(--ink-muted); margin-bottom:16px;
  }
  .breadcrumb a{ color:var(--ink-muted); text-decoration:none; }
  .breadcrumb a:hover{ color:var(--accent); text-decoration:underline; }
  .breadcrumb .sep{ margin:0 6px; color:var(--hairline); }
  .price-tag{
    font-size:22px; font-weight:700; color:var(--accent);
    margin:8px 0 12px;
  }
  .price-tag .currency{ font-size:16px; font-weight:500; }
  .error-page{ text-align:center; padding:80px 20px; }
  .error-page h1{ font-size:48px; margin-bottom:8px; color:var(--ink-muted); }
  .error-page p{ color:var(--ink-muted); margin-bottom:24px; }
`;

// Inline SVG monogram — rounded-square geometric frame in the primary
// brand green with the "G" set in the same serif as the wordmark, so it
// reads as one mark rather than a bolted-on icon.
const BRAND_MARK_SVG = `<svg class="brand-mark" width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <rect x="0.5" y="0.5" width="25" height="25" rx="7" fill="var(--accent)"/>
  <text x="13" y="18.5" text-anchor="middle" font-family="'Noto Serif Thai', serif" font-weight="700" font-size="14" fill="#FFFFFF">G</text>
</svg>`;

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.description]
 * @param {string} [opts.canonicalPath] - path only, e.g. '/product/foo'
 * @param {string} [opts.image] - absolute or root-relative image URL for
 *   og:image (Grist's image_url for a product page). Falls back to
 *   DEFAULT_OG_IMAGE when omitted.
 * @param {'th'|'en'} [opts.lang] - page language. Drives <html lang>,
 *   footer disclaimer copy, share-row copy, and the aria-label on share
 *   buttons. Defaults to 'th' so existing callers that don't pass it
 *   behave exactly as before.
 * @param {string} [opts.altLangPath] - root-relative path to this same
 *   page in the *other* language (e.g. '/en/product/foo' when lang='th').
 *   When provided, renders a small TH/EN switcher link in the header.
 *   Omit when no translated version exists yet.
 * @param {string} opts.bodyHtml
 * @param {string} [opts.jsonLd] - JSON-LD structured data script
 * @param {string} [opts.breadcrumb] - breadcrumb HTML
 */
export function renderPage({
  title, description, canonicalPath = '/', image, lang = 'th',
  altLangPath, bodyHtml, jsonLd, breadcrumb, wide = false
}) {
  const t = uiStrings(lang);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const ogImage = toAbsoluteUrl(image) || DEFAULT_OG_IMAGE;
  const desc = description || '';

  const breadcrumbHtml = breadcrumb ? `<nav class="breadcrumb" aria-label="Breadcrumb">${breadcrumb}</nav>` : '';
  const jsonLdScript = jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : '';
  const langSwitchHtml = altLangPath
    ? `<a class="lang-switch" href="${escapeHtml(altLangPath)}">${escapeHtml(t.langSwitchLabel)}</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonicalUrl}">

<!-- Open Graph (Facebook, Line, most link-preview scrapers) -->
<meta property="og:type" content="article">
<meta property="og:site_name" content="GRAVITY OS">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'th_TH'}">

<!-- Twitter/X card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">

${jsonLdScript}
${FONT_LINK}
<style>${BASE_CSS}</style>
</head>
<body>
<header class="site"><div class="${wide ? 'wrap-wide' : 'wrap'} site-header-row">
  <a class="brand" href="${lang === 'en' ? '/en/' : '/'}">${BRAND_MARK_SVG}GRAVITY OS</a>
  ${langSwitchHtml}
</div></header>
<main class="${wide ? 'wrap-wide' : 'wrap'}">${breadcrumbHtml}${bodyHtml}</main>
<footer class="site">${escapeHtml(t.footerDisclaimer)}</footer>
</body>
</html>`;
}

/**
 * Turns a relative image path from Grist ('/images/x.jpg') into an
 * absolute URL using SITE_URL. Leaves already-absolute URLs untouched.
 * Returns '' for empty input so callers can fall back to DEFAULT_OG_IMAGE.
 */
function toAbsoluteUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Row of share links for one article/product page.
 *
 * @param {string} canonicalPath - path only, e.g. '/product/foo'
 * @param {string} title
 * @param {'th'|'en'} [lang]
 */
export function renderShareButtons(canonicalPath, title, lang = 'th') {
  const t = uiStrings(lang);
  const url = encodeURIComponent(`${SITE_URL}${canonicalPath}`);
  const text = encodeURIComponent(title || '');

  const links = [
    { label: 'f', name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { label: 'L', name: 'Line', href: `https://social-plugins.line.me/lineit/share?url=${url}` },
    { label: 'X', name: 'X (Twitter)', href: `https://twitter.com/intent/tweet?url=${url}&text=${text}` },
  ];

  const buttons = links
    .map(l => `<a class="share-btn" href="${l.href}" target="_blank" rel="noopener" aria-label="${escapeHtml(t.shareAriaPrefix)} ${l.name}">${l.label}</a>`)
    .join('');

  return `<div class="share-row"><span class="share-label">${escapeHtml(t.shareLabel)}</span>${buttons}</div>`;
}

/**
 * Renders the product photo gallery on an article page: a large main
 * photo (the first item) with the rest of the photos as a scrollable
 * thumbnail filmstrip below it.
 *
 * @param {string[]} images - ordered list of absolute image URLs, hero
 *   photo first. Safe to call with a 1-item (or empty) array.
 * @param {string} alt - alt text (article title) shared by all photos
 */
export function renderGallery(images, alt) {
  const photos = (images || []).filter(Boolean);
  if (photos.length === 0) return '';

  const safeAlt = escapeHtml(alt || '');
  if (photos.length === 1) {
    return `<div class="gallery"><img class="gallery-main" src="${escapeHtml(photos[0])}" alt="${safeAlt}" loading="lazy"></div>`;
  }

  const galleryId = 'g' + Math.random().toString(36).slice(2, 9);
  const thumbs = photos.map((src, i) =>
    `<img class="gallery-thumb${i === 0 ? ' is-active' : ''}" src="${escapeHtml(src)}" alt="${safeAlt} ${i + 1}" data-src="${escapeHtml(src)}" loading="lazy" onclick="(function(el){var g=document.getElementById('${galleryId}');g.querySelector('.gallery-main').src=el.dataset.src;g.querySelectorAll('.gallery-thumb').forEach(function(t){t.classList.remove('is-active')});el.classList.add('is-active')})(this)">`
  ).join('');

  return `<div class="gallery" id="${galleryId}">
    <img class="gallery-main" src="${escapeHtml(photos[0])}" alt="${safeAlt}">
    <div class="gallery-strip">${thumbs}</div>
  </div>`;
}

/**
 * Splits a plain-text pros/cons field (one item per line, optionally
 * bulleted with -/•/*) into a clean array of strings.
 */
export function toListItems(text) {
  return (text || '')
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Renders a star rating from a real numeric value (1–5). Returns '' when
 * rating is null/undefined.
 */
export function renderStars(rating) {
  if (rating == null || isNaN(Number(rating))) return '';
  const value = Math.max(0, Math.min(5, Number(rating)));
  const filled = Math.round(value);
  const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);
  return `<span class="stars">${stars}<span class="rating-num">${value.toFixed(1)}</span></span>`;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Turns plain-text article content (from Grist) into structured, readable
 * HTML — paragraphs, bullet/numbered lists, and short-line sub-headings.
 */
export function formatArticleBody(text) {
  if (!text) return '';
  const blocks = String(text).trim().split(/\n\s*\n/).filter(Boolean);

  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return '';

    if (lines.every(l => /^[-•*]\s+/.test(l))) {
      const items = lines.map(l => `<li>${escapeHtml(l.replace(/^[-•*]\s+/, ''))}</li>`).join('');
      return `<ul>${items}</ul>`;
    }

    if (lines.every(l => /^\d+[.)]\s+/.test(l))) {
      const items = lines.map(l => `<li>${escapeHtml(l.replace(/^\d+[.)]\s+/, ''))}</li>`).join('');
      return `<ol>${items}</ol>`;
    }

    if (lines.length === 1 && lines[0].length <= 50 && !/[.!?…""]$/.test(lines[0])) {
      return `<h3>${escapeHtml(lines[0])}</h3>`;
    }

    return `<p>${escapeHtml(lines.join(' '))}</p>`;
  }).join('');
}

/**
 * Renders breadcrumb HTML for article pages
 * @param {Array<{label: string, href?: string}>} items
 */
export function renderBreadcrumb(items) {
  if (!items || !items.length) return '';
  const parts = items.map((item, i) => {
    const isLast = i === items.length - 1;
    if (isLast || !item.href) {
      return `<span aria-current="page">${escapeHtml(item.label)}</span>`;
    }
    return `<a href="${item.href}">${escapeHtml(item.label)}</a>`;
  });
  return parts.join('<span class="sep">›</span>');
}

/**
 * Formats a price for display.
 *
 * ASSUMPTION: EN pages still show Thai Baht (products are Amazon-TH /
 * affiliate items priced in THB regardless of page language) — only the
 * locale used for digit grouping changes. If EN pages should actually
 * show a different currency, this needs a real currency-conversion
 * decision from the team, not just a formatting change.
 *
 * @param {number|string} price
 * @param {'th'|'en'} [lang]
 */
export function formatPrice(price, lang = 'th') {
  if (price == null || price === '') return '';
  const num = Number(String(price).replace(/[^\d.]/g, ''));
  if (isNaN(num)) return '';
  const locale = lang === 'en' ? 'en-US' : 'th-TH';
  return `<span class="price-tag"><span class="currency">฿</span>${num.toLocaleString(locale)}</span>`;
}

/**
 * Validates and sanitizes a URL — only allows http/https protocols
 */
export function sanitizeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Generates JSON-LD structured data for Product + Review schema
 */
export function generateProductJsonLd(article, canonicalPath) {
  const url = `${SITE_URL}${canonicalPath}`;
  const image = toAbsoluteUrl(article.product.image) || DEFAULT_OG_IMAGE;

  const json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: article.seoTitle,
    image: image,
    description: article.metaDescription || '',
    brand: article.product.brand ? {
      '@type': 'Brand',
      name: article.product.brand
    } : undefined,
    offers: article.product.price ? {
      '@type': 'Offer',
      url: sanitizeUrl(article.product.buyUrl) || url,
      priceCurrency: 'THB',
      price: String(article.product.price).replace(/[^\d.]/g, ''),
      availability: 'https://schema.org/InStock'
    } : undefined,
    review: {
      '@type': 'Review',
      reviewRating: article.product.rating ? {
        '@type': 'Rating',
        ratingValue: String(article.product.rating),
        bestRating: '5'
      } : undefined,
      author: {
        '@type': 'Organization',
        name: 'GRAVITY OS'
      },
      reviewBody: article.metaDescription || ''
    }
  };

  return JSON.stringify(json, (k, v) => v === undefined ? undefined : v);
}