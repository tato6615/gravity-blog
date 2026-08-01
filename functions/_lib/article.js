import { getArticleBySlug, getAvailableLanguages } from './grist.js';
import { 
  renderPage, renderShareButtons, renderGallery, renderAuthorSection,
  escapeHtml, formatArticleBody, toListItems, renderStars, 
  generateProductJsonLd, formatPriceWithCurrency
} from './layout.js';

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
    disclosureText: 'ลิงก์ในบทความนี้เป็นลิงก์พันธมิตร เราอาจได้รับค่าคอมมิชชั่นจากการซื้อสินค้าผ่านลิงก์เหล่านี้ โดยไม่มีค่าใช้จ่ายเพิ่มเติมสำหรับคุณ',
    buyingGuideTitle: 'คู่มือการเลือกซื้อ',
    faqTitle: 'คำถามที่พบบ่อย',
    moreReviews: '← ดูรีวิวอื่นๆ',
    dateLocale: 'th-TH',
    reviewedBy: 'ตรวจสอบและปรับปรุงข้อมูลโดย',
    specifications: 'ข้อมูลสินค้า',
    notApprovedFor: 'ไม่เหมาะสำหรับ'
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
    disclosureText: 'Links in this article are affiliate links. We may earn a commission from qualifying purchases at no extra cost to you.',
    faqTitle: 'Frequently asked questions',
    moreReviews: '← See more reviews',
    dateLocale: 'en-US',
    reviewedBy: 'Reviewed and verified by',
    specifications: 'Product specs',
    notApprovedFor: 'Not recommended for'
  }
};

/**
 * NEW: Builds a better Product + Review JSON-LD with author context.
 * Uses the new generateProductJsonLd from layout.js which includes
 * author information and proper schema structure.
 */
function buildProductJsonLd(article, canonicalUrl, authorId = 'gravity-os-team') {
  return `<script type="application/ld+json">${generateProductJsonLd(article, canonicalUrl, authorId)}</script>`;
}

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
 * NEW: Renders a "not approved for" section if analysis includes target audience
 * indicating who this product is NOT suitable for.
 */
function renderNotApprovedFor(analysis, t) {
  if (!analysis || !analysis.not_approved_for) return '';
  const items = toListItems(analysis.not_approved_for);
  if (!items.length) return '';
  return `<div style="background:var(--accent2-soft);border:1px solid var(--hairline);border-left:4px solid var(--accent2);padding:14px 16px;margin:18px 0;border-radius:4px;">
    <h4 style="color:var(--accent2);margin:0 0 8px;font-size:14px;text-transform:uppercase;font-weight:600;">${escapeHtml(t.notApprovedFor)}</h4>
    <ul style="margin:0;padding-left:1.2em;">${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
  </div>`;
}

/**
 * NEW: Renders product specifications if available from AI analysis
 */
function renderSpecifications(analysis, t) {
  if (!analysis || !analysis.specifications) return '';
  const specs = toListItems(analysis.specifications);
  if (!specs.length) return '';
  return `<div style="background:var(--surface);border:1px solid var(--hairline);padding:16px;margin:18px 0;border-radius:8px;">
    <h3 style="font-size:16px;margin:0 0 12px;">${escapeHtml(t.specifications)}</h3>
    <ul style="margin:0;padding-left:1.2em;font-size:14px;color:var(--ink-muted);">${specs.map(s => `<li style="margin-bottom:6px;">${escapeHtml(s)}</li>`).join('')}</ul>
  </div>`;
}

/**
 * Renders the article/product page for the given slug and language.
 * UPDATED: Includes author section, better schema, improved verdict box
 * @param {object} env
 * @param {string} slug
 * @param {'th'|'en'} lang
 * @returns {Promise<Response>}
 */
export async function renderArticlePage(env, slug, lang = 'th') {
  const t = STRINGS[lang] || STRINGS.th;
  const prefix = lang === 'en' ? '/en' : '';

  try {
    let article;
    try {
      article = await getArticleBySlug(env, slug, lang);
    } catch (e) {
      return new Response(`${t.loadErrorPrefix} ${e.message}`, {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=UTF-8' }
      });
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
    
    // Get author ID from Grist (if available), fallback to default
    const authorId = article.analysis?.reviewer_id || 'gravity-os-team';

    // Build verdict box with improved structure
    const verdict = (pros.length || cons.length || audience)
      ? `<div class="verdict">
          <h3>${escapeHtml(t.whoFor)}</h3>
          ${audience ? `<p style="margin:0 0 10px;font-weight:500;">${escapeHtml(audience)}</p>` : ''}
          ${pros.length ? `<p style="margin:0 0 4px;font-weight:600;font-size:14px;color:var(--accent);">${escapeHtml(t.pros)}</p><ul>${pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
          ${cons.length ? `<p style="margin:12px 0 4px;font-weight:600;font-size:14px;color:var(--accent);">${escapeHtml(t.cons)}</p><ul>${cons.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
        </div>`
      : '';

    const trackedBuyUrl = article.product.buyUrl
      ? `${prefix}/go/${encodeURIComponent(article.id)}`
      : '';
    const buyBtn = trackedBuyUrl
      ? `<a class="buy-btn" href="${escapeHtml(trackedBuyUrl)}" rel="nofollow sponsored noopener" target="_blank">${t.buyBtn}</a>`
      : '';

    const tagsHtml = article.tags.length
      ? `<div class="tags">${article.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
      : '';

    const canonicalPath = `${prefix}/product/${encodeURIComponent(article.slug)}`;
    const galleryHtml = renderGallery(article.product.gallery, article.seoTitle);

    // Use absolute URL for canonical/og:image
    const absoluteUrl = `https://gravity-blog.pages.dev${canonicalPath}`;
    const jsonLd = buildProductJsonLd(article, canonicalPath, authorId);

    // Render price with currency if available
    const priceHtml = article.product.priceAmount && article.product.priceCurrency
      ? formatPriceWithCurrency(article.product.priceAmount, article.product.priceCurrency, lang)
      : '';

    // Render rating with stars
    const ratingHtml = article.product.rating
      ? renderStars(article.product.rating)
      : '';

    const body = `
      ${jsonLd}
      ${article.product.brand ? `<div class="eyebrow">${escapeHtml(article.product.brand)}</div>` : ''}
      <h1 style="font-size:28px;margin-bottom:12px;">${escapeHtml(article.seoTitle)}</h1>
      ${ratingHtml ? `<div style="margin-bottom:16px;">${ratingHtml}</div>` : ''}
      ${priceHtml}
      ${galleryHtml}
      <p class="disclosure" style="font-size:13px;color:#8a90a0;margin:8px 0;">${escapeHtml(t.disclosureText)}</p>
      ${renderShareButtons(canonicalPath, article.seoTitle, lang, article.product.image_url)}
      <div class="meta" style="margin-bottom:16px;">${article.updatedAt ? new Date(article.updatedAt).toLocaleDateString(t.dateLocale, { year: 'numeric', month: 'long', day: 'numeric' }) : ''} · ${escapeHtml(t.reviewedBy)} ${escapeHtml(article.analysis?.reviewer_name || 'GRAVITY OS')}</div>
      ${buyBtn}
      ${verdict}
      ${renderSpecifications(article.analysis, t)}
      <div class="article-body">${formatArticleBody(article.blogDraft)}</div>
      ${article.buyingGuide ? `<hr class="hairline"><h3>${escapeHtml(t.buyingGuideTitle)}</h3><div class="article-body">${formatArticleBody(article.buyingGuide)}</div>` : ''}
      ${renderNotApprovedFor(article.analysis, t)}
      ${renderFaq(article.faq, t)}
      ${buyBtn}
      ${renderAuthorSection(authorId, lang)}
      ${tagsHtml}
      <p style="margin-top:32px;"><a href="${prefix}/">${t.moreReviews}</a></p>
      <script>
        (function () {
          try {
            fetch('https://af.pakpiromjajaja.workers.dev/api/track-view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId: ${JSON.stringify(article.id)} }),
              keepalive: true
            }).catch(function () {});
          } catch (e) {}
        })();
      </script>
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
  } catch (e) {
    return new Response(`${t.loadErrorPrefix} ${e.message}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=UTF-8' }
    });
  }
}