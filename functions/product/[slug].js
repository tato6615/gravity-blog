import { getArticleBySlug } from '../_lib/grist.js';
import { renderPage, renderShareButtons, escapeHtml, formatArticleBody, toListItems } from '../_lib/layout.js';

function renderFaq(faqText) {
  if (!faqText) return '';
  const blocks = faqText.split(/\n\n+/).filter(Boolean);
  const items = blocks.map(b => {
    const q = (b.match(/Q:\s*(.*)/) || [])[1];
    const a = (b.match(/A:\s*([\s\S]*)/) || [])[1];
    if (!q || !a) return '';
    return `<div style="margin-bottom:18px;"><strong>${escapeHtml(q)}</strong><p style="margin:6px 0 0;color:var(--ink-muted);">${escapeHtml(a)}</p></div>`;
  }).join('');
  return items ? `<hr class="hairline"><h3>คำถามที่พบบ่อย</h3>${items}` : '';
}

export async function onRequestGet({ env, params }) {
  let article;
  try {
    article = await getArticleBySlug(env, params.slug);
  } catch (e) {
    return new Response(`โหลดบทความไม่สำเร็จ: ${e.message}`, { status: 500 });
  }

  if (!article) {
    return new Response(renderPage({
      title: 'ไม่พบบทความ',
      bodyHtml: `<p class="empty">ไม่พบบทความนี้ หรือยังไม่ถูก publish</p><p><a href="/">← กลับหน้าแรก</a></p>`
    }), { status: 404, headers: { 'content-type': 'text/html; charset=UTF-8' } });
  }

  const pros = article.analysis ? toListItems(article.analysis.pros) : [];
  const cons = article.analysis ? toListItems(article.analysis.cons) : [];
  const audience = article.analysis?.target_audience || '';

  const verdict = (pros.length || cons.length || audience)
    ? `<div class="verdict">
        <h3>เหมาะกับใคร</h3>
        ${audience ? `<p style="margin:0 0 10px;">${escapeHtml(audience)}</p>` : ''}
        ${pros.length ? `<p style="margin:0 0 4px;font-weight:600;">ข้อดี</p><ul>${pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
        ${cons.length ? `<p style="margin:12px 0 4px;font-weight:600;">ข้อควรพิจารณา</p><ul>${cons.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
      </div>`
    : '';

  const buyBtn = article.product.buyUrl
    ? `<a class="buy-btn" href="${escapeHtml(article.product.buyUrl)}" rel="nofollow sponsored noopener" target="_blank">ดูราคา / ซื้อสินค้า →</a>`
    : '';

  const tagsHtml = article.tags.length
    ? `<div class="tags">${article.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  // Same path used for canonical/og:url in renderPage() below and for
  // the share links, so the two always stay in sync.
  const canonicalPath = `/product/${encodeURIComponent(article.slug)}`;

  const body = `
    ${article.product.brand ? `<div class="eyebrow">${escapeHtml(article.product.brand)}</div>` : ''}
    <h1 style="font-size:28px;">${escapeHtml(article.seoTitle)}</h1>
    ${article.product.image_url ? `<img class="hero-img" src="${escapeHtml(article.product.image_url)}" alt="${escapeHtml(article.seoTitle)}">` : ''}
    ${renderShareButtons(canonicalPath, article.seoTitle)}
    <div class="meta">${article.updatedAt ? new Date(article.updatedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</div>
    ${buyBtn}
    ${verdict}
    <div class="article-body">${formatArticleBody(article.blogDraft)}</div>
    ${article.buyingGuide ? `<hr class="hairline"><h3>คู่มือการเลือกซื้อ</h3><div class="article-body">${formatArticleBody(article.buyingGuide)}</div>` : ''}
    ${renderFaq(article.faq)}
    ${buyBtn}
    ${tagsHtml}
    <p style="margin-top:32px;"><a href="/">← ดูรีวิวอื่นๆ</a></p>
  `;

  const html = renderPage({
    title: article.seoTitle,
    description: article.metaDescription,
    canonicalPath,
    image: article.product.image_url,
    bodyHtml: body
  });

  return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
}