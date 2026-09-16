import { getProductBuyUrlById } from '../_lib/d1-products.js';
import { buildTrackedUrl } from '../_lib/affiliate-tracking.js';

// รายชื่อ known bot / crawler / preview-fetcher ที่พบบ่อยที่สุด — เหมือนกับ
// ตัวที่ใช้ใน analytics.js -> handleTrackClick (ตั้งใจให้สอดคล้องกัน เพราะ
// endpoint นี้คือปลายทางจริงที่ลิงก์แชร์ทั้งหมดชี้มา ถ้ามี social preview
// bot หรือ crawler ตามลิงก์เข้ามา ไม่ควรถูกนับเป็นคลิกซื้อ)
const KNOWN_BOT_UA = /bot|crawl|spider|facebookexternalhit|telegrambot|discordbot|slackbot|whatsapp|preview|python-requests|curl\/|wget|headlesschrome|phantomjs|linkedinbot|pinterest(bot)?|redditbot|embedly|quora link preview|vkshare|w3c_validator|bytespider/i;

function isLikelyBot(userAgent) {
  if (!userAgent) return true;
  return KNOWN_BOT_UA.test(userAgent);
}

export async function onRequestGet({ params, env, waitUntil, request }) {
  const productId = params.id;

  let productInfo;
  try {
    productInfo = await getProductBuyUrlById(env, productId);
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

  const buyUrl = productInfo?.buyUrl || null;
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

  const userAgent = request.headers.get('User-Agent') || null;
  const isBot = isLikelyBot(userAgent);

  // GRAVITY ENHANCEMENT (2026-09-16): generate a unique click_id per real
  // (non-bot) click and inject it into the outbound URL as a
  // platform-specific subtag (ascsubtag for Amazon, customid for eBay).
  // See affiliate-tracking.js for full reasoning + platform coverage.
  const clickId = !isBot ? crypto.randomUUID() : null;

  let trackedUrl = cleanedUrl;
  if (!isBot) {
    trackedUrl = buildTrackedUrl(
      productInfo.sourceType,
      productInfo.affiliateLink,
      productInfo.sourceUrl,
      clickId
    ) || cleanedUrl;
  }

  let validatedUrl;
  try {
    validatedUrl = new URL(trackedUrl).href;
  } catch (e) {
    console.error(`go/[id]: invalid buy_url for product ${productId}:`, trackedUrl);
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
  const ip = request.headers.get('CF-Connecting-IP') || null;

  if (!isBot) {
    waitUntil(
      env.DB.prepare(`
        INSERT INTO clicks (product_id, event_type, referrer, utm_source, utm_medium, user_agent, ip, click_id)
        VALUES (?, 'click', ?, ?, ?, ?, ?, ?)
      `).bind(
        String(productId),
        referrer,
        utmSource,
        utmMedium,
        userAgent,
        ip,
        clickId
      ).run().catch((err) => {
        console.error('click tracking failed:', err.message);
      })
    );
  }

  if (!isBot && env.GA4_MEASUREMENT_ID && env.GA4_API_SECRET) {
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
          click_id: clickId,
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
