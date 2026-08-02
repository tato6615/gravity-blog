import { getProductBuyUrlById } from '../_lib/grist.js';

export async function onRequestGet({ params, env, waitUntil, request }) {
  const productId = params.id;

  let buyUrl;
  try {
    buyUrl = await getProductBuyUrlById(env, productId);
  } catch (e) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>เกิดข้อผิดพลาด</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>โหลดข้อมูลสินค้าไม่สำเร็จ: ${e.message}</p>
        <p><a href="/">← กลับหน้าแรก</a></p>
      </body>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (!buyUrl) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>ไม่พบลิงก์สินค้านี้</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>ไม่พบลิงก์สินค้านี้ (product id: ${productId})</p>
        <p><a href="/">← กลับหน้าแรก</a></p>
      </body>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const url = new URL(request.url);
  waitUntil(
    env.DB.prepare(`
      INSERT INTO clicks (product_id, event_type, referrer, utm_source, utm_medium, user_agent, ip)
      VALUES (?, 'click', ?, ?, ?, ?, ?)
    `).bind(
      String(productId),
      request.headers.get('Referer') || null,
      url.searchParams.get('utm_source') || null,
      url.searchParams.get('utm_medium') || null,
      request.headers.get('User-Agent') || null,
      request.headers.get('CF-Connecting-IP') || null
    ).run().catch((err) => {
      console.error('click tracking failed:', err.message);
    })
  );

  return Response.redirect(buyUrl, 302);
}
