// functions/community.js
// GET /community — dedicated Community Hub page

import { renderPage } from './_lib/layout.js';
import { renderCommunityHub } from './_lib/community-hub.js';

export async function onRequestGet({ env }) {
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
}
