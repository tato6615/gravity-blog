/**
 * Shared design tokens + page shell.
 *
 * Design direction: a quiet, paper-like reading surface — the opposite of
 * a busy "deal site". One signature element (the tilted "เหมาะกับใคร" note)
 * carries the personality; everything else stays disciplined so the actual
 * review content stays the focus.
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
  hairline: '#DCDFD9',
  radius: '10px'
};

const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@400;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap" rel="stylesheet">';

const BASE_CSS = `
  :root{
    --bg:${TOKENS.bg}; --surface:${TOKENS.surface}; --ink:${TOKENS.ink};
    --ink-muted:${TOKENS.inkMuted}; --accent:${TOKENS.accent};
    --accent-soft:${TOKENS.accentSoft}; --hairline:${TOKENS.hairline}; --radius:${TOKENS.radius};
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
  /* Wider container used only on the home/listing page so a 4-column
     product grid has room to breathe — article pages keep the narrower
     720px .wrap above for comfortable reading line-length. */
  .wrap-wide{ max-width:1240px; margin:0 auto; padding:0 20px; }
  header.site{
    border-bottom:1px solid var(--hairline); padding:22px 0; margin-bottom:8px;
  }
  header.site a.brand{
    font-family:'Noto Serif Thai', serif; font-weight:700; font-size:19px;
    color:var(--ink); text-decoration:none; letter-spacing:.01em;
  }
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
  }

  /* Product image — Amazon assets are almost always shot on a white
     background, so we contain (never crop) and let the card supply the
     white "product photography" mat around it instead of cropping into
     the product itself. */
  .card-thumb{
    width:100%; height:220px; object-fit:contain; display:block;
    background:var(--surface); padding:16px 24px;
    border-bottom:1px solid var(--hairline);
    box-sizing:border-box;
  }

  .card-body{ padding:22px; }

  @media (min-width:900px){
    .card-thumb{ height:180px; padding:14px 18px; }
    .card-body{ padding:18px; }
  }
  .card h2{ font-size:20px; margin-bottom:10px; }
  .card h2 a{ color:var(--ink); text-decoration:none; }
  .card h2 a:hover{ color:var(--accent); }
  .meta{ color:var(--ink-muted); font-size:14px; margin-bottom:10px; }
  .excerpt{ color:var(--ink); }
  .empty{ color:var(--ink-muted); padding:60px 0; text-align:center; }

  /* Star rating — only ever rendered when Grist has a real numeric
     rating value; see renderStars() below. */
  .stars{ color:var(--accent); font-size:14px; letter-spacing:1px; }
  .stars .rating-num{
    color:var(--ink-muted); font-size:13px; letter-spacing:normal; margin-left:6px;
  }

  /* Hero image on the article page itself (single-photo fallback path —
     used only when a product has just one photo; see renderGallery()). */
  .hero-img{
    width:100%; height:240px; object-fit:cover; border-radius:12px;
    display:block; margin:14px 0 4px; background:var(--accent-soft);
  }

  /* Product photo gallery — main photo large on top, extra photos as a
     horizontally-scrollable filmstrip of thumbnails underneath. Plain
     scroll-snap, no JS required, so it works the same in a Facebook
     in-app browser as anywhere else. */
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

  /* Trust-signal row: rank badge + category eyebrow, sitting above the title */
  .card-top{ display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .rank-badge{
    background:var(--ink); color:#fff; font-size:12px; font-weight:600;
    padding:3px 10px; border-radius:5px; white-space:nowrap;
  }
  .card-top .eyebrow{ margin-bottom:0; }

  /* Pulls the strongest "pro" out of the analysis so it's scannable
     without clicking into the article. */
  .pro-highlight{
    display:flex; align-items:flex-start; gap:8px; margin:12px 0 16px;
    color:var(--ink); font-size:14px; line-height:1.55;
  }
  .pro-highlight .check{ color:var(--accent); font-weight:700; flex-shrink:0; }

  .cta-btn{
    display:block; text-align:center; background:var(--accent); color:#fff !important;
    font-size:15px; font-weight:600; padding:12px; border-radius:8px;
    text-decoration:none; margin-top:4px;
  }
  .cta-btn:hover{ opacity:.92; }

  .updated-line{
    color:var(--ink-muted); font-size:12px; margin-top:12px; padding-top:12px;
    border-top:1px solid var(--hairline);
  }

  /* Homepage card grid — single column on mobile, two columns once
     there's enough width for it to read comfortably. */
  .card-grid{
    display:grid; grid-template-columns:1fr; gap:16px;
  }
  @media (min-width:680px){
    .card-grid{ grid-template-columns:repeat(2, 1fr); align-items:start; }
  }
  @media (min-width:900px){
    .card-grid{ grid-template-columns:repeat(3, 1fr); gap:18px; }
  }
  @media (min-width:1200px){
    .card-grid{ grid-template-columns:repeat(4, 1fr); gap:20px; }
  }

  /* Signature element: the "who it's for" note, tilted like a pinned card */
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

  /* Article body — now receives structured HTML (p / ul / ol / h3)
     from formatArticleBody(), not raw pre-wrapped text. */
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

  /* Share row — one per article, sits right under the title area. */
  .share-row{ display:flex; align-items:center; gap:8px; margin:16px 0 4px; flex-wrap:wrap; }
  .share-row .share-label{ font-size:13px; color:var(--ink-muted); margin-right:2px; }
  .share-btn{
    display:inline-flex; align-items:center; justify-content:center;
    width:34px; height:34px; border-radius:50%; text-decoration:none;
    background:var(--accent-soft); color:var(--accent) !important;
    font-size:14px; font-weight:600; line-height:1;
  }
  .share-btn:hover{ background:var(--accent); color:#fff !important; }

  /* Breadcrumb */
  .breadcrumb{
    font-size:13px; color:var(--ink-muted); margin-bottom:16px;
  }
  .breadcrumb a{ color:var(--ink-muted); text-decoration:none; }
  .breadcrumb a:hover{ color:var(--accent); text-decoration:underline; }
  .breadcrumb .sep{ margin:0 6px; color:var(--hairline); }

  /* Price tag */
  .price-tag{
    font-size:22px; font-weight:700; color:var(--accent);
    margin:8px 0 12px;
  }
  .price-tag .currency{ font-size:16px; font-weight:500; }

  /* Error page */
  .error-page{ text-align:center; padding:80px 20px; }
  .error-page h1{ font-size:48px; margin-bottom:8px; color:var(--ink-muted); }
  .error-page p{ color:var(--ink-muted); margin-bottom:24px; }
`;

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.description]
 * @param {string} [opts.canonicalPath] - path only, e.g. '/product/foo'
 * @param {string} [opts.image] - absolute or root-relative image URL for
 *   og:image (Grist's image_url for a product page). Falls back to
 *   DEFAULT_OG_IMAGE when omitted.
 * @param {string} opts.bodyHtml
 * @param {string} [opts.jsonLd] - JSON-LD structured data script
 * @param {string} [opts.breadcrumb] - breadcrumb HTML
 */
export function renderPage({ title, description, canonicalPath = '/', image, bodyHtml, jsonLd, breadcrumb, wide = false }) {
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const ogImage = toAbsoluteUrl(image) || DEFAULT_OG_IMAGE;
  const desc = description || '';

  const breadcrumbHtml = breadcrumb ? `<nav class="breadcrumb" aria-label="Breadcrumb">${breadcrumb}</nav>` : '';
  const jsonLdScript = jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : '';

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonicalUrl}">

<!-- Open Graph (Facebook, Line, most link-preview scrapers) -->
<meta property="og:type" content="article">
<meta property="og:site_name" content="GRAVITY_OS Picks">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">

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
<header class="site"><div class="wrap"><a class="brand" href="/">GRAVITY_OS Picks</a></div></header>
<main class="${wide ? 'wrap-wide' : 'wrap'}">${breadcrumbHtml}${bodyHtml}</main>
<footer class="site">บทความนี้อาจมีลิงก์พันธมิตร หากคุณซื้อสินค้าผ่านลิงก์ในบทความ เราอาจได้รับค่าคอมมิชชั่นเล็กน้อยโดยไม่มีค่าใช้จ่ายเพิ่มกับคุณ</footer>
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
 * Row of share links for one article/product page. Uses each platform's
 * plain share-intent URL (no SDK/app-id needed), so it works the moment
 * og:image/og:title above are correct — the shared card's image/title
 * come straight from those meta tags.
 *
 * @param {string} canonicalPath - path only, e.g. '/product/foo'
 * @param {string} title
 */
export function renderShareButtons(canonicalPath, title) {
  const url = encodeURIComponent(`${SITE_URL}${canonicalPath}`);
  const text = encodeURIComponent(title || '');

  const links = [
    { label: 'f', name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { label: 'L', name: 'Line', href: `https://social-plugins.line.me/lineit/share?url=${url}` },
    { label: 'X', name: 'X (Twitter)', href: `https://twitter.com/intent/tweet?url=${url}&text=${text}` },
  ];

  const buttons = links
    .map(l => `<a class="share-btn" href="${l.href}" target="_blank" rel="noopener" aria-label="แชร์ไป ${l.name}">${l.label}</a>`)
    .join('');

  return `<div class="share-row"><span class="share-label">แชร์:</span>${buttons}</div>`;
}

/**
 * Renders the product photo gallery on an article page: a large main
 * photo (the first item) with the rest of the photos as a scrollable
 * thumbnail filmstrip below it. Thumbnails swap the main photo via a
 * small inline <script> (no framework, no build step — this file is
 * plain server-rendered HTML) so it degrades gracefully to a single
 * static photo if JS is ever unavailable (the first <img> just sits
 * there as a normal image either way).
 *
 * @param {string[]} images - ordered list of absolute image URLs, hero
 *   photo first. Safe to call with a 1-item (or empty) array — renders
 *   just the single photo / nothing.
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
 * rating is null/undefined — we never show a made-up rating, so callers
 * can just always call this and trust it to no-op when there's no data.
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
 * HTML — paragraphs, bullet/numbered lists, and short-line sub-headings —
 * instead of dumping one giant white-space:pre-wrap blob.
 *
 * Rules per blank-line-separated block:
 *  - every line starts with -/•/*  -> <ul>
 *  - every line starts with "1." / "1)" -> <ol>
 *  - a single short line with no ending punctuation -> <h3> sub-heading
 *  - otherwise -> <p> (soft line breaks inside the block are joined with a space)
 */
export function formatArticleBody(text) {
  if (!text) return '';
  const blocks = String(text).trim().split(/\n\s*\n/).filter(Boolean);

  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return '';

    // Bullet list block
    if (lines.every(l => /^[-•*]\s+/.test(l))) {
      const items = lines.map(l => `<li>${escapeHtml(l.replace(/^[-•*]\s+/, ''))}</li>`).join('');
      return `<ul>${items}</ul>`;
    }

    // Numbered list block
    if (lines.every(l => /^\d+[.)]\s+/.test(l))) {
      const items = lines.map(l => `<li>${escapeHtml(l.replace(/^\d+[.)]\s+/, ''))}</li>`).join('');
      return `<ol>${items}</ol>`;
    }

    // Short single line, no trailing sentence punctuation -> treat as sub-heading
    if (lines.length === 1 && lines[0].length <= 50 && !/[.!?…""]$/.test(lines[0])) {
      return `<h3>${escapeHtml(lines[0])}</h3>`;
    }

    // Regular paragraph
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
 * Formats price with Thai Baht symbol
 */
export function formatPrice(price) {
  if (price == null || price === '') return '';
  const num = Number(String(price).replace(/[^\d.]/g, ''));
  if (isNaN(num)) return '';
  return `<span class="price-tag"><span class="currency">฿</span>${num.toLocaleString('th-TH')}</span>`;
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
        name: 'GRAVITY_OS Picks'
      },
      reviewBody: article.metaDescription || ''
    }
  };

  // Remove undefined keys
  return JSON.stringify(json, (k, v) => v === undefined ? undefined : v);
}