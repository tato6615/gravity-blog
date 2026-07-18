/**
 * Shared design tokens + page shell.
 *
 * Design direction: a quiet, paper-like reading surface — the opposite of
 * a busy "deal site". One signature element (the tilted "เหมาะกับใคร" note)
 * carries the personality; everything else stays disciplined so the actual
 * review content stays the focus.
 */

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
  .card-thumb{
    width:100%; height:170px; object-fit:cover; display:block;
    background:var(--accent-soft);
  }
  .card-body{ padding:22px; }
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

  /* Hero image on the article page itself */
  .hero-img{
    width:100%; height:240px; object-fit:cover; border-radius:12px;
    display:block; margin:14px 0 4px; background:var(--accent-soft);
  }

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
  hr.hairline{ border:none; border-top:1px solid var(--hairline); margin:32px 0; }
  @media (max-width:480px){ body{ font-size:16px; } }
`;

export function renderPage({ title, description, canonicalPath = '/', bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description || '')}">
<link rel="canonical" href="${canonicalPath}">
${FONT_LINK}
<style>${BASE_CSS}</style>
</head>
<body>
<header class="site"><div class="wrap"><a class="brand" href="/">GRAVITY_OS Picks</a></div></header>
<main class="wrap">${bodyHtml}</main>
<footer class="site">บทความนี้อาจมีลิงก์พันธมิตร หากคุณซื้อสินค้าผ่านลิงก์ในบทความ เราอาจได้รับค่าคอมมิชชั่นเล็กน้อยโดยไม่มีค่าใช้จ่ายเพิ่มกับคุณ</footer>
</body>
</html>`;
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
    if (lines.length === 1 && lines[0].length <= 50 && !/[.!?…”"]$/.test(lines[0])) {
      return `<h3>${escapeHtml(lines[0])}</h3>`;
    }

    // Regular paragraph
    return `<p>${escapeHtml(lines.join(' '))}</p>`;
  }).join('');
}