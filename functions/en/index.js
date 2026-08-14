import { renderHomePage } from '../_lib/homepage.js';

export async function onRequestGet({ env, request }) {
  try {
    return await renderHomePage(env, 'en', request);
  } catch (e) {
    console.error('en/index.js: renderHomePage failed', e.message);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Error</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>Failed to load homepage. Please try again.</p>
        <p><a href="/">← Refresh</a></p>
      </body>`,
      { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
