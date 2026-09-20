import { getArticleBySlug, getAvailableLanguages } from './d1-articles.js';
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

function buildProductJsonLd(article, canonicalUrl, authorId = 'gravity-os-team') {
  return `<script type="application/ld+json">${generateProductJsonLd(article, canonicalUrl, authorId)}<\/script>`;
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

function renderNotApprovedFor(analysis, t) {
  if (!analysis || !analysis.not_approved_for) return '';
  const items = toListItems(analysis.not_approved_for);
  if (!items.length) return '';
  return `<div style="background:var(--accent2-soft);border:1px solid var(--hairline);border-left:4px solid var(--accent2);padding:14px 16px;margin:18px 0;border-radius:4px;">
    <h4 style="color:var(--accent2);margin:0 0 8px;font-size:14px;text-transform:uppercase;font-weight:600;">${escapeHtml(t.notApprovedFor)}</h4>
    <ul style="margin:0;padding-left:1.2em;">${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
  </div>`;
}

function renderSpecifications(analysis, t) {
  if (!analysis || !analysis.specifications) return '';
  const specs = toListItems(analysis.specifications);
  if (!specs.length) return '';
  return `<div style="background:var(--surface);border:1px solid var(--hairline);padding:16px;margin:18px 0;border-radius:8px;">
    <h3 style="font-size:16px;margin:0 0 12px;">${escapeHtml(t.specifications)}</h3>
    <ul style="margin:0;padding-left:1.2em;font-size:14px;color:var(--ink-muted);">${specs.map(s => `<li style="margin-bottom:6px;">${escapeHtml(s)}</li>`).join('')}</ul>
  </div>`;
}

function buildAttentionTrackerScript(productId, variantId, channel) {
  return `<script>
(function () {
  'use strict';
  var ENDPOINT = '/api/track-event';
  var sid = Date.now().toString(36) + Math.random().toString(36).slice(2);
  var cfg = {
    session_id: sid,
    product_id: ${JSON.stringify(productId || null)},
    variant_id: ${JSON.stringify(variantId || null)},
    channel: ${JSON.stringify(channel || 'direct')}
  };

  function send(eventType, section) {
    var payload = Object.assign({}, cfg, { event_type: eventType });
    if (section) payload.section = section;
    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function(){});
    }
  }

  send('view');

  var milestones = { 25: false, 50: false, 75: false, 100: false };
  window.addEventListener('scroll', function () {
    var el = document.documentElement;
    var pct = Math.floor(((el.scrollTop + window.innerHeight) / el.scrollHeight) * 100);
    [25, 50, 75, 100].forEach(function (m) {
      if (!milestones[m] && pct >= m) { milestones[m] = true; send('scroll_' + m); }
    });
  }, { passive: true });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('a[href],button');
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var section = (el.closest('[data-section]') || {}).dataset && el.closest('[data-section]').dataset.section || null;
    var isAffiliate = href.indexOf('/go/') !== -1 || href.indexOf('amzn.to') !== -1 || href.indexOf('amazon.com') !== -1;
    var isCTA = el.classList.contains('buy-btn') || el.dataset.track === 'click';
    if (isAffiliate || isCTA) send('click', section || 'cta');
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') send('exit');
  });
  window.addEventListener('pagehide', function () { send('exit'); });
})();
<\/script>`;
}

export async function renderArticlePage(env, slug, lang = 'th', request) {
  const t = STRINGS[lang] || STRINGS.th;
  // prefix ใช้กับ URL บทความ (คงโครงเดิม: th = /product/..., en = /en/product/...)
  const prefix = lang === 'en' ? '/en' : '';
  // 🔧 (2026-09-20c): หน้าแรก en = /  , th = /th/
  const homeHref = lang === 'en' ? '/' : '/th/';

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
        // GRAVITY FIX (2026-09-20): ogType:'website' (default) ถูกต้องสำหรับ 404
        bodyHtml: `<p class="empty">${t.notFoundBody}</p><p><a href="${homeHref}">${t.backHome}</a></p>`
      }), { status: 404, headers: { 'content-type': 'text/html; charset=UTF-8' } });
    }

    const pros = article.analysis ? toListItems(article.analysis.pros) : [];
    const cons = article.analysis ? toListItems(article.analysis.cons) : [];
    const audience = article.analysis?.target_audience || '';
    
    const authorId = article.analysis?.reviewer_id || 'gravity-os-team';

    const verdict = (pros.length || cons.length || audience)
      ? `<div class="verdict">
          <h3>${escapeHtml(t.whoFor)}</h3>
          ${audience ? `<p style="margin:0 0 10px;font-weight:500;">${escapeHtml(audience)}</p>` : ''}
          ${pros.length ? `<p style="margin:0 0 4px;font-weight:600;font-size:14px;color:var(--accent);">${escapeHtml(t.pros)}</p><ul>${pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
          ${cons.length ? `<p style="margin:12px 0 4px;font-weight:600;font-size:14px;color:var(--accent);">${escapeHtml(t.cons)}</p><ul>${cons.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
        </div>`
      : '';

    const incomingUrl = request ? new URL(request.url) : null;
    const incomingUtmSource = incomingUrl?.searchParams.get('utm_source');
    const incomingUtmMedium = incomingUrl?.searchParams.get('utm_medium');
    const buyUrlParams = new URLSearchParams();
    if (incomingUtmSource) buyUrlParams.set('utm_source', incomingUtmSource);
    if (incomingUtmMedium) buyUrlParams.set('utm_medium', incomingUtmMedium);
    const buyUrlQuery = buyUrlParams.toString();
    const trackedBuyUrl = article.product.buyUrl
      ? `/go/${encodeURIComponent(article.id)}${buyUrlQuery ? `?${buyUrlQuery}` : ''}`
      : '';
    article.product.trackedBuyUrl = trackedBuyUrl;
    const buyBtn = trackedBuyUrl
      ? `<a class="buy-btn" href="${escapeHtml(trackedBuyUrl)}" rel="nofollow sponsored noopener" target="_blank">${t.buyBtn}</a>`
      : '';

    const tagsHtml = article.tags.length
      ? `<div class="tags">${article.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
      : '';

    const canonicalPath = `${prefix}/product/${encodeURIComponent(article.slug)}`;
    const galleryHtml = renderGallery(article.product.gallery, article.seoTitle);

    const absoluteUrl = `https://gravity-blog.pages.dev${canonicalPath}`;
    const jsonLd = buildProductJsonLd(article, canonicalPath, authorId);

    const priceHtml = article.product.priceAmount && article.product.priceCurrency
      ? formatPriceWithCurrency(article.product.priceAmount, article.product.priceCurrency, lang)
      : '';

    const ratingHtml = article.product.rating
      ? renderStars(article.product.rating)
      : '';

    const attentionChannel = incomingUtmSource || 'direct';
    const attentionVariantId = article.variantId || null;

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
      <div data-section="cta">${buyBtn}</div>
      ${verdict}
      ${renderSpecifications(article.analysis, t)}
      <div class="article-body" data-section="review">${formatArticleBody(article.blogDraft)}</div>
      ${article.buyingGuide ? `<hr class="hairline"><h3>${escapeHtml(t.buyingGuideTitle)}</h3><div class="article-body" data-section="buying_guide">${formatArticleBody(article.buyingGuide)}</div>` : ''}
      ${renderNotApprovedFor(article.analysis, t)}
      <div data-section="faq">${renderFaq(article.faq, t)}</div>
      <div data-section="cta">${buyBtn}</div>
      ${renderAuthorSection(authorId, lang)}
      ${tagsHtml}
      <p style="margin-top:32px;"><a href="${homeHref}">${t.moreReviews}</a></p>
      ${buildAttentionTrackerScript(article.id, attentionVariantId, attentionChannel)}
    `;

    const html = renderPage({
      title: article.seoTitle,
      description: article.metaDescription,
      canonicalPath,
      image: article.product.image_url,
      lang,
      altLangPath: null, // article.js ยังไม่ได้ใช้ getAvailableLanguages — ถ้าจะเพิ่มทีหลังใส่ตรงนี้
      // GRAVITY FIX (2026-09-20): เพิ่ม ogType:'article' — เดิมไม่ส่งค่านี้
      // ทำให้ layout.js ใช้ default 'website' ทุกหน้าสินค้า
      ogType: 'article',
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
