import { renderArticlePage } from '../../_lib/article.js';

export async function onRequestGet({ env, params, request }) {
  try {
    return await renderArticlePage(env, params.slug, 'en', request);
  } catch (e) {
    console.error(`product/[slug].js (en): render failed`, e.message);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>Error</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>Failed to load the article. Please try again.</p>
        <p><a href="/">← Back to home</a></p>
      </body>`,
      { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
