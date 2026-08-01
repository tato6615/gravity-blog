export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    
    const product_id = url.searchParams.get('product_id');
    const utm_source = url.searchParams.get('utm_source') || 'direct';
    const utm_medium = url.searchParams.get('utm_medium') || 'affiliate';
    
    if (!product_id) {
      return new Response('Missing product_id', { status: 400 });
    }
    
    // ✅ Call D1 via HTTP API
    const dbId = "da05a906-cf21-4717-a96f-c1da3966fd56";
    const accountId = "6cb3cb63c3df5143d124b45a80ab7b95";
    
    await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql: `INSERT INTO clicks (product_id, timestamp, utm_source, utm_medium) VALUES (?, ?, ?, ?)`,
        params: [product_id, new Date().toISOString(), utm_source, utm_medium]
      })
    });
    
    console.log('✅ Click logged:', product_id);
    
    // ✅ Redirect
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `https://amazon.com/dp/${product_id}`
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
