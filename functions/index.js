import { getLiveArticles } from './_lib/grist.js';
import { renderPage, escapeHtml } from './_lib/layout.js';

export async function onRequestGet({ env }) {
  let articles = [];
  let errorMsg = null;
  try {
    articles = await getLiveArticles(env);
  } catch (e) {
    errorMsg = e.message;
  }

  const cards = articles.map(a => `
    <article class="card">
      <div class="eyebrow">${escapeHtml(a.product.brand || 'รีวิว')}</div>
      <h2><a href="/product/${encodeURIComponent(a.slug)}">${escapeHtml(a.seoTitle)}</a></h2>
      <div class="meta">${a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</div>
      <p class="excerpt">${escapeHtml(a.metaDescription)}</p>
      <a href="/product/${encodeURIComponent(a.slug)}">อ่านต่อ →</a>
    </article>
  `).join('');

  const body = errorMsg
    ? `<p class="empty">โหลดบทความไม่สำเร็จ: ${escapeHtml(errorMsg)}</p>`
    : (articles.length
        ? cards
        : `<p class="empty">ยังไม่มีบทความ — พอ Generate Everything เสร็จในระบบหลัง บทความจะขึ้นที่นี่อัตโนมัติ</p>`);

  const html = renderPage({
    title: 'GRAVITY_OS Picks — รีวิวสินค้าที่คัดมาให้',
    description: 'รีวิวและคำแนะนำสินค้า สรุปให้อ่านง่าย ตัดสินใจได้เร็ว',
    canonicalPath: '/',
    bodyHtml: `<h1 style="font-size:26px;margin-bottom:6px;">รีวิวล่าสุด</h1>
    <p class="meta" style="margin-bottom:28px;">อัปเดตอัตโนมัติทุกครั้งที่มีสินค้าใหม่วิเคราะห์เสร็จ</p>
    ${body}`
  });

  return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
}
