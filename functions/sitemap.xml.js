   import { getLiveArticles } from './_lib/d1-articles.js';

const SITE_URL = 'https://gravity-blog.pages.dev';

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c]));
}

export async function onRequestGet({ env }) {
  try {
    const [thArticles, enArticles] = await Promise.all([
      getLiveArticles(env, 'th'),
      getLiveArticles(env, 'en')
    ]);

    const urls = [
      `${SITE_URL}/`,
      `${SITE_URL}/en/`,
      ...thArticles.map(a => `${SITE_URL}/product/${a.slug}`),
      ...enArticles.map(a => `${SITE_URL}/en/product/${a.slug}`)
    ];

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${escapeXml(u)}</loc></url>`).join('\n')}
</urlset>`;

    return new Response(body, {
      headers: { 'content-type': 'application/xml; charset=UTF-8' }
    });
  } catch (e) {
    return new Response(`Sitemap error: ${e.message}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=UTF-8' }
    });
  }
}
