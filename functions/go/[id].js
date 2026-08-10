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
  const referrer = request.headers.get('Referer') || null;
  const utmSource = url.searchParams.get('utm_source') || null;
  const utmMedium = url.searchParams.get('utm_medium') || null;
  const userAgent = request.headers.get('User-Agent') || null;
  const ip = request.headers.get('CF-Connecting-IP') || null;

  // บันทึกคลิกลง D1 (ของเดิม)
  waitUntil(
    env.DB.prepare(`
      INSERT INTO clicks (product_id, event_type, referrer, utm_source, utm_medium, user_agent, ip)
      VALUES (?, 'click', ?, ?, ?, ?, ?)
    `).bind(
      String(productId),
      referrer,
      utmSource,
      utmMedium,
      userAgent,
      ip
    ).run().catch((err) => {
      console.error('click tracking failed:', err.message);
    })
  );

  // ยิง event ไป GA4 ผ่าน Measurement Protocol (เพิ่มใหม่)
  if (env.GA4_MEASUREMENT_ID && env.GA4_API_SECRET) {
    const cookie = request.headers.get('Cookie') || '';
    const gaCookieMatch = cookie.match(/_ga=GA\d\.\d\.(\d+\.\d+)/);
    const clientId = gaCookieMatch ? gaCookieMatch[1] : crypto.randomUUID();

    const gaPayload = {
      client_id: clientId,
      events: [{
        name: 'affiliate_click',
        params: {
          product_id: String(productId),
          link_url: buyUrl,
          utm_source: utmSource || '(none)',
          utm_medium: utmMedium || '(none)',
          page_referrer: referrer || '(none)',
        }
      }]
    };

    waitUntil(
      fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`,
        {
          method: 'POST',
          body: JSON.stringify(gaPayload),
        }
      ).catch((err) => {
        console.error('GA4 event failed:', err.message);
      })
    );
  }

  return Response.redirect(buyUrl, 302);
}
