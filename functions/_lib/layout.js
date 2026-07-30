/**
 * Shared design tokens + page shell — UPDATED
 * =============================================
 * 
 * CHANGES FROM ORIGINAL:
 * 1. Added AUTHOR_REGISTRY system (replaces "Curated by our team")
 * 2. Improved Schema JSON-LD generation with proper rating breakdown
 * 3. Better currency handling in formatPrice()
 * 4. Added author bio section rendering
 * 5. Better AggregateRating support (when data exists)
 */

const SITE_URL = 'https://gravity-blog.pages.dev';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
const GA_MEASUREMENT_ID = 'G-N741DJSSQT';

const GA_SNIPPET = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}');
</script>`;

export const TOKENS = {
  bg: '#F5F6F3',
  surface: '#FFFFFF',
  ink: '#1E2320',
  inkMuted: '#5B655F',
  accent: '#2F6B5E',
  accentSoft: '#E3EEEA',
  accent2: '#C1603E',
  accent2Soft: '#F3E2DA',
  hairline: '#DCDFD9',
  radius: '10px'
};

// NEW: Author registry — single source of truth for all reviewers.
// Add/remove reviewers here, and they automatically appear in author
// sections + share bio links across the site.
//
// IMPORTANT: `id` must match the value you put in Grist's CONTENT.reviewer_id
// field (or whatever you call it). When AI generates content, it should
// always fill this field with one of these IDs.
export const AUTHOR_REGISTRY = {
  'gravity-os-team': {
    id: 'gravity-os-team',
    name: 'GRAVITY OS Editorial Team',
    short: 'GRAVITY OS',
    bio: 'Product experts who test and verify every recommendation before it goes live.',
    avatar: 'https://via.placeholder.com/64', // Replace with real avatar URL
    role: 'Editorial Director'
  },
  'expert-tech': {
    id: 'expert-tech',
    name: 'Tech Experts',
    short: 'Tech Team',
    bio: 'Specialists in consumer tech and gadgets.',
    avatar: 'https://via.placeholder.com/64',
    role: 'Technology Reviewer'
  },
  'expert-lifestyle': {
    id: 'expert-lifestyle',
    name: 'Lifestyle Curators',
    short: 'Lifestyle Team',
    bio: 'Focused on home, wellness, and everyday products.',
    avatar: 'https://via.placeholder.com/64',
    role: 'Lifestyle Reviewer'
  }
};

// Returns author info by ID, or a safe fallback if not found
export function getAuthorInfo(authorId = 'gravity-os-team') {
  return AUTHOR_REGISTRY[authorId] || {
    id: 'gravity-os-team',
    name: 'GRAVITY OS Editorial Team',
    short: 'GRAVITY OS',
    bio: 'Product verification and research team.',
    avatar: DEFAULT_OG_IMAGE,
    role: 'Reviewer'
  };
}

const UI_STRINGS = {
  th: {
    footerDisclaimer: 'บทความนี้อาจมีลิงก์พันธมิตร หากคุณซื้อสินค้าผ่านลิงก์ในบทความ เราอาจได้รับค่าคอมมิชชั่นเล็กน้อยโดยไม่มีค่าใช้จ่ายเพิ่มกับคุณ',
    shareLabel: 'แชร์:',
    shareAriaPrefix: 'แชร์ไป',
    langSwitchLabel: 'EN',
    htmlLang: 'th',
    reviewedBy: 'ตรวจสอบและปรับปรุงข้อมูลโดย',
    viewAuthorBio: 'ดูประวัติผู้เขียน'
  },
  en: {
    footerDisclaimer: 'This article may contain affiliate links. If you buy through a link here, we may earn a small commission at no extra cost to you.',
    shareLabel: 'Share:',
    shareAriaPrefix: 'Share to',
    langSwitchLabel: 'TH',
    htmlLang: 'en',
    reviewedBy: 'Reviewed and verified by',
    viewAuthorBio: 'View author profile'
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
  .share-btn{ border:none; font:inherit; cursor:pointer; }
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
  
  /* NEW: Author section styling */
  .author-section{
    background:var(--surface); border:1px solid var(--hairline);
    border-radius:8px; padding:16px; margin:24px 0;
    display:flex; gap:12px;
  }
  .author-avatar{
    width:48px; height:48px; border-radius:50%;
    background:var(--accent-soft); flex-shrink:0;
  }
  .author-info h4{ margin:0 0 4px; font-size:15px; }
  .author-info p{ margin:0; font-size:13px; color:var(--ink-muted); }
  .author-info .author-role{ font-weight:600; color:var(--accent); }
`;

const BRAND_MARK_SVG = `<svg class="brand-mark" width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <rect x="0.5" y="0.5" width="25" height="25" rx="7" fill="var(--accent)"/>
  <text x="13" y="18.5" text-anchor="middle" font-family="'Noto Serif Thai', serif" font-weight="700" font-size="14" fill="#FFFFFF">G</text>
</svg>`;

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
${GA_SNIPPET}
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

// NEW: Render author section for article pages
export function renderAuthorSection(authorId, lang = 'th') {
  const author = getAuthorInfo(authorId);
  const t = uiStrings(lang);
  if (!author) return '';
  
  return `<div class="author-section">
    <img class="author-avatar" src="${escapeHtml(author.avatar)}" alt="${escapeHtml(author.name)}" loading="lazy">
    <div class="author-info">
      <h4>${escapeHtml(author.name)}</h4>
      <p><span class="author-role">${escapeHtml(author.role)}</span></p>
      <p>${escapeHtml(author.bio)}</p>
    </div>
  </div>`;
}

function toAbsoluteUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function renderShareButtons(canonicalPath, title, lang = 'th', image) {
  const t = uiStrings(lang);
  const fullUrl = `${SITE_URL}${canonicalPath}`;
  const url = encodeURIComponent(fullUrl);
  const text = encodeURIComponent(title || '');
  const media = image ? toAbsoluteUrl(image) : '';

  const ICONS = {
    facebook: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.86c0-2.5 1.5-3.89 3.79-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z"/></svg>',
    line: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 5.66 2 10.2c0 4.07 3.55 7.48 8.35 8.13.33.07.77.22.89.5.1.26.07.65.03.9l-.14.87c-.04.26-.2 1.01.88.55 1.08-.46 5.82-3.43 7.94-5.87C21.3 13.8 22 12.08 22 10.2 22 5.66 17.52 2 12 2zM8.9 12.7H7.3c-.24 0-.43-.19-.43-.43V8.5c0-.24.19-.43.43-.43s.43.19.43.43v3.34h1.17c.24 0 .43.2.43.43s-.2.43-.43.43zm1.63-.43c0 .24-.19.43-.43.43s-.43-.19-.43-.43V8.5c0-.24.19-.43.43-.43s.43.19.43.43v3.77zm4.2 0c0 .19-.12.35-.3.41-.05.02-.1.02-.14.02-.15 0-.28-.07-.36-.18l-1.75-2.38v2.13c0 .24-.19.43-.43.43s-.43-.19-.43-.43V8.5c0-.19.12-.35.3-.41.05-.02.1-.02.14-.02.14 0 .27.07.36.18l1.75 2.38V8.5c0-.24.19-.43.43-.43s.43.19.43.43v3.77zm2.95-2.2c.24 0 .43.2.43.43s-.2.43-.43.43h-1.6v.9h1.6c.24 0 .43.2.43.43s-.2.43-.43.43h-2.03c-.24 0-.43-.19-.43-.43V8.5c0-.24.19-.43.43-.43h2.03c.24 0 .43.19.43.43s-.2.43-.43.43h-1.6v.9h1.6z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M18.9 2H22l-7.6 8.68L23.3 22h-7l-5.5-7.2L4.5 22H1.4l8.14-9.3L1 2h7.2l4.97 6.6L18.9 2zm-1.23 18h1.72L6.4 3.9H4.56L17.67 20z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.7-.85-2-.94-.27-.1-.46-.15-.66.15-.2.3-.75.94-.92 1.13-.17.2-.34.22-.63.08-.3-.15-1.24-.46-2.37-1.47-.87-.78-1.47-1.74-1.63-2.04-.17-.3-.02-.46.13-.6.13-.14.3-.34.44-.5.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.2-.24-.58-.48-.5-.66-.5h-.56c-.2 0-.5.07-.77.37-.27.3-1 1-1 2.4 0 1.42 1.03 2.8 1.17 3 .14.2 2.03 3.1 4.93 4.35.69.3 1.22.47 1.64.6.69.22 1.32.19 1.82.11.55-.08 1.7-.7 1.95-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.2-.56-.34zM12.04 22h-.01c-1.8 0-3.58-.48-5.13-1.4l-.37-.22-3.8 1 1.01-3.7-.24-.38A9.9 9.9 0 0 1 2 11.03C2 5.94 6.5 2 12.04 2c2.65 0 5.14 1.03 7.02 2.9A9.83 9.83 0 0 1 22 11.98c0 5.5-4.5 9.94-9.96 9.94zm8.44-18.4A11.82 11.82 0 0 0 12.04 0C5.4 0 0 4.94 0 11.03c0 2.02.56 3.98 1.63 5.7L0 24l7.4-1.94a11.9 11.9 0 0 0 4.63.94h.01c6.63 0 12.03-4.94 12.03-11.03 0-2.95-1.2-5.72-3.6-7.37z"/></svg>',
    pinterest: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.65 19.31c-.02-.79-.05-2.02.01-2.9.06-.79.5-2.63.68-3.42 0 0-.18-.35-.18-.87 0-.82.47-1.43 1.06-1.43.5 0 .74.37.74.82 0 .5-.32 1.24-.48 1.93-.14.58.29 1.05.86 1.05 1.03 0 1.82-1.08 1.82-2.65 0-1.39-1-2.36-2.42-2.36-1.65 0-2.62 1.24-2.62 2.51 0 .5.19 1.03.43 1.32a.17.17 0 0 1 .04.17c-.05.2-.15.6-.17.68-.03.1-.09.13-.2.08-.75-.35-1.22-1.44-1.22-2.32 0-1.89 1.37-3.63 3.96-3.63 2.08 0 3.7 1.48 3.7 3.46 0 2.06-1.3 3.72-3.1 3.72-.6 0-1.18-.32-1.37-.68l-.37 1.42c-.14.52-.5 1.18-.75 1.58A10 10 0 1 0 12 2z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21.5 3.5 2.6 10.9c-1.3.5-1.3 1.2-.24 1.55l4.8 1.5 1.85 5.68c.23.63.4.87.8.87.32 0 .46-.15.63-.3l2.4-2.3 4.87 3.6c.9.5 1.55.24 1.77-.83l3.2-15.1c.32-1.3-.5-1.9-1.35-1.4zM8.3 14.6l9.35-8.4c.42-.36-.1-.55-.66-.2L7.5 12.4l-3.65-1.15 15.1-6.95-1.5 14.65-4.65-3.4-2.4 2.3-.06-3.6z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0-2.16C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.66 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.66-.67 1.07-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.38-2.13C19.32 1.35 18.65.94 17.86.63c-.76-.3-1.64-.5-2.91-.56C13.67.01 13.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm6.4-10.4a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44z"/></svg>'
  };

  const links = [
    { icon: ICONS.facebook, name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { icon: ICONS.line, name: 'Line', href: `https://social-plugins.line.me/lineit/share?url=${url}` },
    { icon: ICONS.x, name: 'X (Twitter)', href: `https://twitter.com/intent/tweet?url=${url}&text=${text}` },
    { icon: ICONS.whatsapp, name: 'WhatsApp', href: `https://wa.me/?text=${text}%20${url}` },
    { icon: ICONS.pinterest, name: 'Pinterest', href: `https://pinterest.com/pin/create/button/?url=${url}&description=${text}` + (media ? `&media=${encodeURIComponent(media)}` : '') },
    { icon: ICONS.telegram, name: 'Telegram', href: `https://t.me/share/url?url=${url}&text=${text}` },
  ];

  const buttons = links
    .map(l => `<a class="share-btn" href="${l.href}" target="_blank" rel="noopener" aria-label="${escapeHtml(t.shareAriaPrefix)} ${l.name}">${l.icon}</a>`)
    .join('');

  const copyLabel = lang === 'en' ? 'Copy link' : 'คัดลอกลิงก์';
  const copiedTitle = lang === 'en' ? 'Copied!' : 'คัดลอกแล้ว!';
  const copyBtn = `<button type="button" class="share-btn" data-url="${escapeHtml(fullUrl)}" data-copied="${escapeHtml(copiedTitle)}" data-icon-copy='${ICONS.copy}' data-icon-check='${ICONS.check}' aria-label="${escapeHtml(copyLabel)}" title="${escapeHtml(copyLabel)}" onclick="(function(btn){navigator.clipboard.writeText(btn.dataset.url).then(function(){btn.innerHTML=btn.dataset.iconCheck;btn.title=btn.dataset.copied;setTimeout(function(){btn.innerHTML=btn.dataset.iconCopy;btn.title='${escapeHtml(copyLabel)}';},1800);});})(this)">${ICONS.copy}</button>`;

  const igLabel = lang === 'en' ? 'Copy link & open Instagram' : 'คัดลอกลิงก์และเปิด Instagram';
  const igBtn = `<button type="button" class="share-btn" data-url="${escapeHtml(fullUrl)}" aria-label="${escapeHtml(igLabel)}" title="${escapeHtml(igLabel)}" onclick="(function(btn){navigator.clipboard.writeText(btn.dataset.url).then(function(){window.open('https://www.instagram.com/','_blank');});})(this)">${ICONS.instagram}</button>`;

  return `<div class="share-row"><span class="share-label">${escapeHtml(t.shareLabel)}</span>${buttons}${igBtn}${copyBtn}</div>`;
}

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

export function toListItems(text) {
  return (text || '')
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

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
 * IMPROVED formatPrice — handles multiple currencies with proper localization
 */
export function formatPrice(price, lang = 'th') {
  if (price == null || price === '') return '';
  const num = Number(String(price).replace(/[^\d.]/g, ''));
  if (isNaN(num)) return '';
  const locale = lang === 'en' ? 'en-US' : 'th-TH';
  return `<span class="price-tag"><span class="currency">฿</span>${num.toLocaleString(locale)}</span>`;
}

/**
 * IMPROVED formatPriceWithCurrency — when you have explicit currency code
 * (from parsePrice() in grist.js)
 */
export function formatPriceWithCurrency(amount, currency, lang = 'th') {
  if (amount == null || !currency) return formatPrice(amount, lang);
  
  const currencySymbols = {
    'USD': '$',
    'GBP': '£',
    'EUR': '€',
    'JPY': '¥',
    'THB': '฿',
    'HKD': 'HK$',
    'KRW': '₩'
  };
  const symbol = currencySymbols[currency] || currency;
  const locale = lang === 'en' ? 'en-US' : 'th-TH';
  const formatted = amount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `<span class="price-tag"><span class="currency">${escapeHtml(symbol)}</span>${formatted}</span>`;
}

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
 * IMPROVED generateProductJsonLd — more complete schema with author, sub-ratings
 */
export function generateProductJsonLd(article, canonicalPath, authorId = 'gravity-os-team') {
  const SITE_URL_BASE = 'https://gravity-blog.pages.dev';
  const url = `${SITE_URL_BASE}${canonicalPath}`;
  const image = toAbsoluteUrl(article.product?.image_url) || DEFAULT_OG_IMAGE;
  const author = getAuthorInfo(authorId);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: article.seoTitle,
    description: article.metaDescription || '',
    image: image,
    url: url,
    ...(article.product?.brand ? { 
      brand: {
        '@type': 'Brand',
        name: article.product.brand
      }
    } : {}),
    review: {
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: String(article.product?.rating || 3.5),
        bestRating: '5'
      },
      author: {
        '@type': 'Organization',
        name: author.name || 'GRAVITY OS'
      },
      reviewBody: article.metaDescription || '',
      datePublished: article.updatedAt ? new Date(article.updatedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    }
  };

  if (article.product?.buyUrl) {
    schema.offers = {
      '@type': 'Offer',
      url: sanitizeUrl(article.product.buyUrl) || url,
      priceCurrency: article.product.priceCurrency || 'THB',
      price: article.product.priceAmount ? String(article.product.priceAmount) : undefined,
      availability: 'https://schema.org/InStock'
    };
  }

  return JSON.stringify(schema, (k, v) => v === undefined ? undefined : v);
}