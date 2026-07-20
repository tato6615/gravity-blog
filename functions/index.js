import { getLiveArticles } from './_lib/grist.js';
import { renderPage, escapeHtml, toListItems, renderStars, renderBreadcrumb } from './_lib/layout.js';

export async function onRequestGet({ env }) {
  let articles = [];
  let errorMsg = null;
  try {
    articles = await getLiveArticles(env);
  } catch (e) {
    errorMsg = e.message;
  }

  const cards = articles.map((a, i) => {
    const topPro = a.analysis ? toListItems(a.analysis.pros)[0] : null;
    const updatedLabel = a.updatedAt
      ? new Date(a.updatedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
      : null;
    const thumb = a.product.image
      ? `<img class="card-thumb" src="${escapeHtml(a.product.image)}" alt="${escapeHtml(a.seoTitle)}" loading="lazy">`
      : `<div class="card-thumb-placeholder">ไม่มีรูปสินค้า</div>`;
    const stars = renderStars(a.product.rating);

    return `
    <article class="card">
${thumb}
      <div class="card-body">
        <div class="card-top">
          <span class="rank-badge">อันดับ ${i + 1}</span>
          <div class="eyebrow">${escapeHtml(a.product.brand || 'รีวิว')}</div>
        </div>
        <h2><a href="/product/${encodeURIComponent(a.slug)}">${escapeHtml(a.seoTitle)}</a></h2>
${stars ? `<div style="margin-bottom:10px;">${stars}</div>` : ''}
        <p class="excerpt">${escapeHtml(a.metaDescription)}</p>
${topPro ? `<div class="pro-highlight"><span class="check">✓</span><span>${escapeHtml(topPro)}</span></div>` : ''}
        <a class="cta-btn" href="/product/${encodeURIComponent(a.slug)}">อ่านรีวิวฉบับเต็ม →</a>
${updatedLabel ? `<div class="updated-line">ตรวจสอบและอัปเดตข้อมูลล่าสุด: ${updatedLabel}</div>` : ''}
      </div>
    </article>
  `;
  }).join('');

  const body = errorMsg
    ? `<div class="error-page">
        <h1>⚠️</h1>
        <p>โหลดบทความไม่สำเร็จ: ${escapeHtml(errorMsg)}</p>
        <p><a href="/">ลองใหม่อีกครั้ง</a></p>
      </div>`
    : (articles.length
      ? `<div class="card-grid">${cards}</div>`
      : `<div class="error-page">
          <p>ยังไม่มีบทความ</p>
          <p>พอ Generate Everything เสร็จในระบบหลัง บทความจะขึ้นที่นี่อัตโนมัติ</p>
        </div>`);

  const html = renderPage({
    title: 'GRAVITY_OS Picks — รีวิวสินค้าที่คัดมาให้',
    description: 'รีวิวและคำแนะนำสินค้า สรุปให้อ่านง่าย ตัดสินใจได้เร็ว',
    canonicalPath: '/',
    wide: true,
    bodyHtml: `<h1 style="font-size:26px;margin-bottom:6px;">รีวิวล่าสุด</h1>
    <p class="meta" style="margin-bottom:28px;">คัดสรรและตรวจสอบโดยทีมงาน อัปเดตอัตโนมัติทุกครั้งที่มีสินค้าใหม่วิเคราะห์เสร็จ</p>
${body}`
  });

  return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
}