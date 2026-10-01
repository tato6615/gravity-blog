import { getArticleBySlug, getAvailableLanguages } from './d1-articles.js';
import {
  renderPage, renderShareButtons, renderGallery, renderAuthorSection,
  escapeHtml, formatArticleBody, toListItems, renderStars,
  generateProductJsonLd, formatPriceWithCurrency, uiStrings
} from './layout.js';
import { DEAL_CSS, DEAL_FONT_LINK, renderDealBody, icon, priceText } from './deal-ui.js';

/**
 * 🎨 GRAVITY UI (2026-10-01) — หน้าบทความใช้ดีไซน์ Deal-style เดียวกับหน้าแรก (deal-ui.js)
 *  - เปลี่ยนเฉพาะการแสดงผล: การดึงข้อมูล, JSON-LD, ลิงก์ซื้อ /go/ (พร้อม utm), attention tracker
 *    และ data-section ทั้งหมดคงเดิม
 *  - ปุ่มซื้อยังมี class "buy-btn" เพื่อให้ tracker นับคลิก CTA ได้เหมือนเดิม
 */

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
    notApprovedFor: 'ไม่เหมาะสำหรับ',
    disclosureTitle: 'คำชี้แจงโปร่งใส (Affiliate Disclosure)'
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
    notApprovedFor: 'Not recommended for',
    disclosureTitle: 'Affiliate Disclosure'
  }
};

function buildProductJsonLd(article, canonicalUrl, authorId = 'gravity-os-team') {
  return `<script type="application/ld+json">${generateProductJsonLd(article, canonicalUrl, authorId)}<\/script>`;
}


// ── helpers (presentation only) ───────────────────────────────────────────
// pros/cons ในฐานข้อมูลบางแถวถูกเก็บเป็นบรรทัดเดียวคั่นด้วย "•" — แตกให้เป็นข้อๆ
function toBullets(text) {
  return toListItems(String(text ?? '').replace(/\\r\\n|\\n|\\r/g, '\n'))
    .flatMap(i => i.split(/\s*[•●▪]\s*/))
    .map(i => i.trim())
    .filter(Boolean);
}

function stripArrow(label) {
  return String(label || '').replace(/\s*→\s*$/, '');
}

function renderBulletList(items, kind, iconName) {
  return `<ul class="dl-list ${kind}">${items.map(i => `<li>${icon(iconName)}<span>${escapeHtml(i)}</span></li>`).join('')}</ul>`;
}

function renderFaq(faqText, t) {
  if (!faqText) return '';
  const blocks = faqText.split(/\n\n+/).filter(Boolean);
  const items = blocks.map(b => {
    const q = (b.match(/Q:\s*(.*)/) || [])[1];
    const a = (b.match(/A:\s*([\s\S]*)/) || [])[1];
    if (!q || !a) return '';
    return `<details><summary><span>${escapeHtml(q)}</span>${icon('expand_more')}</summary><p>${escapeHtml(a)}</p></details>`;
  }).join('');
  return items
    ? `<section class="dl-vcard"><h2 class="dl-card-h">${escapeHtml(t.faqTitle)}</h2><div class="dl-faq">${items}</div></section>`
    : '';
}

function renderNotApprovedFor(analysis, t) {
  if (!analysis || !analysis.not_approved_for) return '';
  const items = toBullets(analysis.not_approved_for);
  if (!items.length) return '';
  return `<section class="dl-warn"><h2 class="dl-card-h">${icon('error')}${escapeHtml(t.notApprovedFor)}</h2>${renderBulletList(items, 'con', 'error')}</section>`;
}

function renderSpecifications(analysis, t) {
  if (!analysis || !analysis.specifications) return '';
  const specs = toBullets(analysis.specifications);
  if (!specs.length) return '';
  const pairs = specs.map(s => s.match(/^([^:]{1,40}):\s*(.+)$/));
  const allPairs = pairs.every(Boolean);
  const body = allPairs
    ? `<dl class="dl-spec">${pairs.map(m => `<div><dt>${escapeHtml(m[1])}</dt><dd>${escapeHtml(m[2])}</dd></div>`).join('')}</dl>`
    : `<ul class="dl-spec-plain">${specs.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
  return `<section class="dl-vcard"><h2 class="dl-card-h">${escapeHtml(t.specifications)}</h2>${body}</section>`;
}

function renderShell({ t, lang, homeHref, mainHtml, bottomHtml, hasBar }) {
  const ui = uiStrings(lang);
  return renderDealBody({
    t,
    homeHref,
    altLangPath: null,
    langLabel: ui.langSwitchLabel,
    hasSearch: false,
    hasAlerts: false,
    mainHtml,
    footerParagraphs: [ui.aiDisclosureFull, ui.footerDisclaimer],
    bottomHtml: bottomHtml ?? '',
  });
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
  const backLabel = String(t.moreReviews).replace(/^\s*←\s*/, '');
  const backHtml = `<a class="dl-back" href="${homeHref}">${icon('arrow_back')}<span>${escapeHtml(backLabel)}</span></a>`;

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
      const notFoundBody = renderShell({
        t, lang, homeHref,
        mainHtml: `<div class="dl-art"><div class="dl-empty"><p>${escapeHtml(t.notFoundBody)}</p><p>${backHtml}</p></div></div>`,
      });
      return new Response(renderPage({
        title: t.notFoundTitle,
        canonicalPath: `${prefix}/product/${encodeURIComponent(slug)}`,
        lang,
        // GRAVITY FIX (2026-09-20): ogType:'website' (default) ถูกต้องสำหรับ 404
        bodyHtml: '',
        deal: { css: DEAL_CSS, fontLink: DEAL_FONT_LINK, bodyClass: 'dl', bodyHtml: notFoundBody },
      }), { status: 404, headers: { 'content-type': 'text/html; charset=UTF-8' } });
    }

    const pros = article.analysis ? toBullets(article.analysis.pros) : [];
    const cons = article.analysis ? toBullets(article.analysis.cons) : [];
    const audience = article.analysis?.target_audience || '';

    const authorId = article.analysis?.reviewer_id || 'gravity-os-team';

    const verdict = (pros.length || cons.length || audience)
      ? `<section class="dl-vcard">
          <h2 class="dl-card-h">${icon('verified_user')}${escapeHtml(t.whoFor)}</h2>
          ${audience ? `<p class="dl-aud">${escapeHtml(audience)}</p>` : ''}
          ${pros.length ? `<div><p class="dl-sub pro">${escapeHtml(t.pros)}</p>${renderBulletList(pros, 'pro', 'check_circle')}</div>` : ''}
          ${cons.length ? `<div><p class="dl-sub con">${escapeHtml(t.cons)}</p>${renderBulletList(cons, 'con', 'error')}</div>` : ''}
        </section>`
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
    const buyLabel = stripArrow(t.buyBtn);
    const buyBtn = trackedBuyUrl
      ? `<a class="buy-btn dl-btn main" href="${escapeHtml(trackedBuyUrl)}" rel="nofollow sponsored noopener" target="_blank"><span>${escapeHtml(buyLabel)}</span>${icon('north_east')}</a>`
      : '';

    const tagsHtml = article.tags.length
      ? `<div class="tags">${article.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
      : '';

    const canonicalPath = `${prefix}/product/${encodeURIComponent(article.slug)}`;
    const galleryHtml = renderGallery(article.product.gallery, article.seoTitle);

    const jsonLd = buildProductJsonLd(article, canonicalPath, authorId);

    const priceHtml = article.product.priceAmount && article.product.priceCurrency
      ? formatPriceWithCurrency(article.product.priceAmount, article.product.priceCurrency, lang)
      : '';
    const barPrice = priceText(article.product, lang);

    const ratingHtml = article.product.rating
      ? renderStars(article.product.rating)
      : '';

    const attentionChannel = incomingUtmSource || 'direct';
    const attentionVariantId = article.variantId || null;

    const dateText = article.updatedAt
      ? new Date(article.updatedAt).toLocaleDateString(t.dateLocale, { year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const main = `
      ${jsonLd}
      <div class="dl-art">
        ${backHtml}
        <section class="dl-art-card">
          ${galleryHtml}
          <div class="dl-art-tags">
            ${article.product.brand ? `<span class="dl-mini">${escapeHtml(article.product.brand)}</span>` : ''}
            ${ratingHtml}
          </div>
          <h1>${escapeHtml(article.seoTitle)}</h1>
          ${priceHtml}
          <div data-section="cta">${buyBtn}</div>
          <p class="dl-disc">${escapeHtml(t.disclosureText)}</p>
          ${renderShareButtons(canonicalPath, article.seoTitle, lang, article.product.image_url)}
          <div class="dl-meta">${escapeHtml(dateText)} · ${escapeHtml(t.reviewedBy)} ${escapeHtml(article.analysis?.reviewer_name || 'GRAVITY OS')}</div>
        </section>
        ${verdict}
        ${renderSpecifications(article.analysis, t)}
        <div class="dl-prose" data-section="review">${formatArticleBody(article.blogDraft)}</div>
        ${article.buyingGuide ? `<section class="dl-vcard"><h2 class="dl-card-h">${escapeHtml(t.buyingGuideTitle)}</h2><div class="dl-prose" data-section="buying_guide" style="padding:0;box-shadow:none;background:transparent">${formatArticleBody(article.buyingGuide)}</div></section>` : ''}
        ${renderNotApprovedFor(article.analysis, t)}
        <div data-section="faq">${renderFaq(article.faq, t)}</div>
        ${renderAuthorSection(authorId, lang)}
        ${tagsHtml}
        ${backHtml}
      </div>
      ${buildAttentionTrackerScript(article.id, attentionVariantId, attentionChannel)}
    `;

    // แถบซื้อลอยด้านล่าง (ราคา + ปุ่ม) — แสดงเมื่อมีลิงก์ซื้อ
    const bottomHtml = trackedBuyUrl
      ? `<div class="dl-buybar" data-section="cta"><div class="dl-buybar-in">${barPrice ? `<span class="dl-buybar-price">${escapeHtml(barPrice)}</span>` : ''}${buyBtn}</div></div>`
      : '';

    const bodyHtml = renderShell({ t, lang, homeHref, mainHtml: main, bottomHtml });

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
      bodyHtml: '',
      deal: { css: DEAL_CSS, fontLink: DEAL_FONT_LINK, bodyClass: trackedBuyUrl ? 'dl dl-has-bar' : 'dl', bodyHtml },
    });

    return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
  } catch (e) {
    return new Response(`${t.loadErrorPrefix} ${e.message}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=UTF-8' }
    });
  }
}