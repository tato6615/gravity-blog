import { renderPage } from './_lib/layout.js';
import { renderCommunityHub } from './_lib/community-hub.js';

export async function onRequestGet({ env }) {
  try {
    const bodyHtml = await renderCommunityHub({ mode: 'full', env });
    const html = renderPage({
      title: 'เข้าชุมชนเรา — GRAVITY OS',
      description: 'เข้าร่วมชุมชน GRAVITY OS บน Telegram, Discord, Mastodon, Facebook และ Threads',
      canonicalPath: '/community',
      lang: 'th',
      bodyHtml,
    });
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=UTF-8' },
    });
  } catch (e) {
    console.error('community.js: render failed', e.message);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>เกิดข้อผิดพลาด</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>โหลดหน้าชุมชนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
        <p><a href="/">← กลับหน้าแรก</a></p>
      </body>`,
      { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
