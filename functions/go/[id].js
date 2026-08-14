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

  // GRAVITY FIX (2026-08-14): ตัดช่องว่าง/ขึ้นบรรทัดใหม่ที่อาจติดมาจาก
  // ฟิลด์ Grist ก่อนเช็คค่าว่าง — เดิม `!buyUrl` ปล่อยผ่าน string ที่มี
  // แต่ whitespace ("  \n") เพราะ truthy ทำให้ไปถึง Response.redirect()
  // แล้ว throw ข้างล่างแทน
  const cleanedUrl = typeof buyUrl === 'string' ? buyUrl.trim() : buyUrl;

  if (!cleanedUrl) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>ไม่พบลิงก์สินค้านี้</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>ไม่พบลิงก์สินค้านี้ (product id: ${productId})</p>
        <p><a href="/">← กลับหน้าแรก</a></p>
      </body>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // GRAVITY FIX (2026-08-14): validate ว่าเป็น absolute URL ที่ใช้ได้จริง
  // ก่อน — Response.redirect() ของ Cloudflare Workers จะ throw TypeError
  // ทันทีถ้า url ไม่ valid (เช่น ขาด https:// นำหน้า) ซึ่งเดิมไม่มีอะไร
  // ดักไว้ ทำให้ function throw แบบ unhandled แล้ว Cloudflare ตอบกลับ
  // เป็น text/plain error → browser (โดยเฉพาะ Safari บนมือถือ ตอน path
  // ไม่มีนามสกุลไฟล์) เข้าใจผิดว่าเป็นไฟล์ให้ดาวน์โหลด ตั้งชื่อจาก
  // product id เช่น "152.txt" — อาการตรงกับที่ผู้ใช้เจอ
  let validatedUrl;
  try {
    validatedUrl = new URL(cleanedUrl).href;
  } catch (e) {
    console.error(`go/[id]: invalid buy_url for product ${productId}:`, cleanedUrl);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>ลิงก์สินค้านี้ไม่ถูกต้อง</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>ลิงก์สินค้านี้มีปัญหา ไม่สามารถพาไปหน้าต้นทางได้ (product id: ${productId})</p>
        <p><a href="/">← กลับหน้าแรก</a></p>
      </body>`,
      { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
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
          link_url: validatedUrl,
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

  // GRAVITY FIX (2026-08-14): ห่อด้วย try/catch เผื่อ edge case อื่นที่
  // ยังไม่คาดคิด — กัน unhandled exception ไม่ให้ไปตอบเป็น text/plain
  // download อีก (เดิมบรรทัดนี้ไม่มี try/catch เลย)
  try {
    return Response.redirect(validatedUrl, 302);
  } catch (e) {
    console.error(`go/[id]: Response.redirect failed for product ${productId}:`, e.message);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>ไม่สามารถ redirect ได้</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>เกิดข้อผิดพลาดตอนพาไปหน้าต้นทาง (product id: ${productId})</p>
        <p><a href="/">← กลับหน้าแรก</a></p>
      </body>`,
      { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}