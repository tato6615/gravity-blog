export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('product_id');
  const redirectUrl = url.searchParams.get('redirect');
  const utmSource = url.searchParams.get('utm_source');
  const utmMedium = url.searchParams.get('utm_medium');

  if (!productId || !redirectUrl) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Missing required params: product_id and redirect'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    await env.DB.prepare(`
      INSERT INTO clicks (product_id, timestamp, referrer, utm_source, utm_medium, user_agent, ip)
      VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
    `).bind(
      productId,
      request.headers.get('referer') || null,
      utmSource || null,
      utmMedium || null,
      request.headers.get('user-agent') || null,
      request.headers.get('cf-connecting-ip') || null
    ).run();
  } catch (err) {
    // แม้บันทึกไม่สำเร็จ ก็ยัง redirect user ไปปลายทางต่อ ไม่ให้ user ค้าง
    console.error('click log failed:', err.message);
  }

  return Response.redirect(redirectUrl, 302);
}
