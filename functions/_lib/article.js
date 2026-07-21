import { getArticleBySlug } from './grist.js';
import { renderPage, renderShareButtons, renderGallery, escapeHtml, formatArticleBody, toListItems } from './layout.js';

const STRINGS = {
  th: {
    loadErrorPrefix: 'โหลดบทความไม่สำเร็จ:',
    notFoundTitle: 'ไม่พบบทความ',
    notFoundBody: 'ไม่พบบทความนี้ หรือยังไม่ถูก publish',
    backHome: '← กลับหน้าแรก',
    whoFor: 'เหมาะกับใคร',
    pros: 'ข้อดี',
    cons: 'ข้อควรพิจารณา',
    buyBtn: 'ดูราคา / ซื้อสินค้า →',
    buyingGuideTitle: 'คู่มือการเลือกซื้อ',
    faqTitle: 'คำถามที่พบบ่อย',
    moreReviews: '← ดูรีวิวอื่นๆ',
    dateLocale: 'th-TH',
  },
  en: {
    loadErrorPrefix: 'Failed to load article:',
    notFoundTitle: 'Article not found',
    notFoundBody: "This article doesn't exist, or hasn't been published yet.",
    backHome: '← Back to home',
    whoFor: "Who it's for",
    pros: 'Pros',
    cons: 'Things to consider',
    buyBtn: 'Check price / Buy →',
    buyingGuideTitle: 'Buying guide',
    faqTitle: 'Frequently asked questions',
    moreReviews: '← See more reviews',
    dateLocale: 'en-US',
  }
};

function renderFaq(faqText, t) {
  if (!faqText) return '';
  const blocks = faqText.split(/\n\n+/).filter(Boolean);
  const items = blocks.map(b => {
    const q = (b.match(/Q:\s*(.*)/) || [])[1];
    const a = (b.match(/A:\s*([\s\S]*)/) || [])[1];
    if (!q || !a) return '';
    return `<div style="margin-bottom:18px;"><strong>${escapeHtml(q)}</strong><p style="margin:6px 0 0;color:var(--ink-muted);">${escapeHtml(a)}</p></div>`;
  }).join('');
  return items ? `<hr class="hairline"><h3>${escapeHtml(t.faqTitle)}</h3>${items}` : '';
}

/**
 * Renders the article/product page for the given slug and language.
 * @param {object} env
 * @param {string} slug
 * @param {'th'|'en'} lang
 * @returns {Promise<Response>}
 */
export async function renderArticlePage(env, slug, lang = 'th') {
  const t = STRINGS[lang] || STRINGS.th;
  const prefix = lang === 'en' ? '/en' : '';

  let article;
  try {
    article = await getArticleBySlug(env, slug, lang);
  } catch (e) {
    return new Response(`${t.loadErrorPrefix} ${e.message}`, { status: 500 });
  }

  if (!article) {
    return new Response(renderPage({
      title: t.notFoundTitle,
      canonicalPath: `${prefix}/product/${encodeURIComponent(slug)}`,
      lang,
      bodyHtml: `<p class="empty">${t.notFoundBody}</p><p><a href="${prefix}/">${t.backHome}</a></p>`
    }), { status: 404, headers: { 'content-type': 'text/html; charset=UTF-8' } });
  }

  const pros = article.analysis ? toListItems(article.analysis.pros) : [];
  const cons = article.analysis ? toListItems(article.analysis.cons) : [];
  const audience = article.analysis?.target_audience || '';

  const verdict = (pros.length || cons.length || audience)
    ? `<div class="verdict">
        <h3>${escapeHtml(t.whoFor)}</h3>
        ${audience ? `<p style="margin:0 0 10px;">${escapeHtml(audience)}</p>` : ''}
        ${pros.length ? `<p style="margin:0 0 4px;font-weight:600;">${escapeHtml(t.pros)}</p><ul>${pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
        ${cons.length ? `<p style="margin:12px 0 4px;font-weight:600;">${escapeHtml(t.cons)}</p><ul>${cons.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
      </div>`
    : '';

  const buyBtn = article.product.buyUrl
    ? `<a class="buy-btn" href="${escapeHtml(article.product.buyUrl)}" rel="nofollow sponsored noopener" target="_blank">${t.buyBtn}</a>`
    : '';

  const tagsHtml = article.tags.length
    ? `<div class="tags">${article.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';

  // Same path used for canonical/og:url in renderPage() below and for
  // the share links, so the two always stay in sync.
  const canonicalPath = `${prefix}/product/${encodeURIComponent(article.slug)}`;

  // gallery is always a non-empty array once a product has any photo at
  // all — normalizeProduct() in grist.js falls back to [image_url] when
  // gallery_image_urls is missing (older products imported before the
  // gallery feature existed). renderGallery() itself no-ops safely on an
  // empty array, so this is safe even for a product with zero photos.
  const galleryHtml = renderGallery(article.product.gallery, article.seoTitle);

  const body = `
    ${article.product.brand ? `<div class="eyebrow">${escapeHtml(article.product.brand)}</div>` : ''}
    <h1 style="font-size:28px;">${escapeHtml(article.seoTitle)}</h1>
    ${galleryHtml}
    ${renderShareButtons(canonicalPath, article.seoTitle)}
    <div class="meta">${article.updatedAt ? new Date(article.updatedAt).toLocaleDateString(t.dateLocale, { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</div>
    ${buyBtn}
    ${verdict}
    <div class="article-body">${formatArticleBody(article.blogDraft)}</div>
    ${article.buyingGuide ? `<hr class="hairline"><h3>${escapeHtml(t.buyingGuideTitle)}</h3><div class="article-body">${formatArticleBody(article.buyingGuide)}</div>` : ''}
    ${renderFaq(article.faq, t)}
    ${buyBtn}
    ${tagsHtml}
    <p style="margin-top:32px;"><a href="${prefix}/">${t.moreReviews}</a></p>
  `;

  const html = renderPage({
    title: article.seoTitle,
    description: article.metaDescription,
    canonicalPath,
    image: article.product.image_url,
    lang,
    bodyHtml: body
  });

  return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
}