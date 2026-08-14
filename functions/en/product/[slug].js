import { renderArticlePage } from '../../_lib/article.js';

export async function onRequestGet({ env, params }) {
  try {
    return await renderArticlePage(env, params.slug, 'en');
  } catch (e) {
    console.error(`product/[slug].js (en): render failed`, e.message);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>เกิดข้อผิดพลาด</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>โหลดหน้าบทความไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
        <p><a href="/">← กลับหน้าแรก</a></p>
      </body>`,
      { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
