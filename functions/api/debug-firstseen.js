export async function onRequestGet({ env }) {
  const debug = { productId: '138' };

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM product_first_seen WHERE product_id = ?'
    ).bind('138').all();
    debug.d1Row = results[0] || null;
  } catch (e) {
    debug.d1Error = e.message;
  }

  try {
    const { getLiveArticles } = await import('../_lib/grist.js');
    const articles = await getLiveArticles(env, 'th');
    const harloon = articles.find(a => String(a.id) === '138');
    debug.gristArticle = harloon
      ? { id: harloon.id, seoTitle: harloon.seoTitle, category: harloon.category }
      : null;
    debug.totalArticles = articles.length;
    debug.allIds = articles.map(a => String(a.id));
  } catch (e) {
    debug.gristError = e.message;
  }

  return new Response(JSON.stringify(debug, null, 2), {
    headers: { 'content-type': 'application/json' }
  });
}
