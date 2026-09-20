import { getLiveArticles } from './_lib/d1-articles.js';

// GRAVITY ENHANCEMENT (2026-09-20): sitemap สำหรับตลาดโลก
//  - hreflang alternates (th/en + x-default) จับคู่บทความตาม product id
//  - lastmod จากเวลาที่ "สร้างเนื้อหา" จริง (ไม่ใช้ products.updated_at เพราะถูก
//    เขียนทับทุก step ของ pipeline ทำให้ lastmod เพี้ยนจนกูเกิลเลิกเชื่อ)
//  - URL ของบทความ encode เหมือน canonical ใน article.js (encodeURIComponent)
//    เพื่อให้ sitemap กับ canonical ตรงกันเป๊ะ
//  - โดเมนอ่านจาก env.SITE_URL (ตั้งตอนย้ายไปโดเมนของตัวเอง) ไม่ตั้ง = ค่าเดิม
//    ⚠️ layout.js มี SITE_URL ของตัวเองด้วย — ตอนย้ายโดเมนต้องแก้ทั้งสองที่
//  - X_DEFAULT_LANG = ภาษาที่ให้ x-default ชี้ไป ต้องตรงกับ layout.js
//    (ดู hreflang x-default ใน renderPage) ถ้าไม่มีบทความภาษานั้น → ใช้ภาษาที่มี

const DEFAULT_SITE_URL = 'https://gravity-blog.pages.dev';
const X_DEFAULT_LANG = 'en';

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c]));
}

function toLastmod(value) {
  if (!value) return null;
  // D1 มักเก็บ "YYYY-MM-DD HH:MM:SS" (ไม่มี timezone) → ถือเป็น UTC
  const s = String(value).trim();
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(s) ? s.replace(' ', 'T') + 'Z' : s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function articlePath(lang, slug) {
  return `${lang === 'en' ? '/en' : ''}/product/${encodeURIComponent(slug)}`;
}

function renderEntry(entries, lastmod) {
  // entries: [{ lang, url }] — ทุกภาษาของหน้าเดียวกัน
  const xDefault = entries.find(e => e.lang === X_DEFAULT_LANG) || entries[0];
  const alternates = entries.length > 1
    ? [
        ...entries.map(e => `    <xhtml:link rel="alternate" hreflang="${e.lang}" href="${escapeXml(e.url)}"/>`),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefault.url)}"/>`
      ].join('\n') + '\n'
    : '';
  // ทุกภาษาต้องมี <url> ของตัวเอง พร้อม alternates ชุดเดียวกัน
  return entries.map(e =>
    `  <url>\n    <loc>${escapeXml(e.url)}</loc>\n` +
    (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') +
    alternates +
    `  </url>`
  ).join('\n');
}

export async function onRequestGet({ env }) {
  try {
    const site = String(env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
    const [thArticles, enArticles] = await Promise.all([
      getLiveArticles(env, 'th'),
      getLiveArticles(env, 'en')
    ]);

    const byId = new Map(); // product id -> { th, en }
    for (const [lang, list] of [['th', thArticles], ['en', enArticles]]) {
      for (const a of list || []) {
        if (!a || !a.slug) continue;
        const key = String(a.id);
        if (!byId.has(key)) byId.set(key, {});
        byId.get(key)[lang] = a;
      }
    }

    const blocks = [
      // หน้าแรกสองภาษา
      renderEntry([
        { lang: 'th', url: `${site}/` },
        { lang: 'en', url: `${site}/en/` }
      ], null)
    ];

    for (const langs of byId.values()) {
      const entries = ['th', 'en']
        .filter(l => langs[l])
        .map(l => ({ lang: l, url: `${site}${articlePath(l, langs[l].slug)}` }));
      const latest = ['th', 'en']
        .map(l => langs[l] && toLastmod(langs[l].createdAt || langs[l].updatedAt))
        .filter(Boolean)
        .sort()
        .pop() || null;
      blocks.push(renderEntry(entries, latest));
    }

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${blocks.join('\n')}
</urlset>`;

    return new Response(body, {
      headers: {
        'content-type': 'application/xml; charset=UTF-8',
        'cache-control': 'public, max-age=3600'
      }
    });
  } catch (e) {
    return new Response(`Sitemap error: ${e.message}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=UTF-8' }
    });
  }
}
