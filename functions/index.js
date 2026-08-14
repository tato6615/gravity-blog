import { renderHomePage } from './_lib/homepage.js';

export async function onRequestGet({ env, request }) {
  try {
    return await renderHomePage(env, 'th', request);
  } catch (e) {
    console.error('index.js (th): renderHomePage failed', e.message);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>เกิดข้อผิดพลาด</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>โหลดหน้าหลักไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
        <p><a href="/">← รีเฟรช</a></p>
      </body>`,
      { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
