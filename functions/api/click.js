/**
 * Click Tracking API
 * GET /api/click?product_id=ASIN-123&utm_source=blog
 */

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // ✅ ดึง parameters
    const product_id = url.searchParams.get('product_id');
    const utm_source = url.searchParams.get('utm_source') || 'direct';
    const utm_medium = url.searchParams.get('utm_medium') || 'affiliate';
    const referrer = request.headers.get('referer') || '';
    const user_agent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('cf-connecting-ip') || '';
    
    if (!product_id) {
      return new Response('Missing product_id', { status: 400 });
    }
    
    // ✅ Log ลง database
    const stmt = env.DB.prepare(`
      INSERT INTO clicks (product_id, timestamp, referrer, utm_source, utm_medium, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      product_id,
      new Date().toISOString(),
      referrer,
      utm_source,
      utm_medium,
      user_agent,
      ip
    ).run();
    
    console.log('✅ Click logged:', product_id);
    
    // ✅ Redirect ไป Amazon
    const affiliate_url = `https://amazon.com/dp/${product_id}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': affiliate_url,
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
