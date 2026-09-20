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

// ─────────────────────────────────────────────────────────────────────────
// GRAVITY ENHANCEMENT (2026-09-20): geo-aware Amazon redirect
// ─────────────────────────────────────────────────────────────────────────
// ส่งผู้ซื้อไปร้าน Amazon ของประเทศตัวเอง พร้อม tracking ID ของประเทศนั้น
// (Amazon Associates แยกบัญชี/tag ตามร้าน คอมมิชชันนับเฉพาะ tag ของร้านนั้น)
//
// ตั้งค่า (Cloudflare Pages → Settings → Variables):
//   AMAZON_GEO_REDIRECT = true                  ← สวิตช์เปิด/ปิด (ปิดไว้ = พฤติกรรมเดิมทุกอย่าง)
//   AMAZON_TAGS = {"GB":"yourtag-21","DE":"yourtag-21","CA":"yourtag-20"}
//        ↑ ใส่เฉพาะร้านที่ "สมัครและได้ tracking ID จริงแล้ว" — ร้านที่ไม่อยู่ในนี้
//          จะไม่ถูกเปลี่ยนปลายทาง (ตกไปใช้ลิงก์เดิม ไม่ส่งไปร้านที่ไม่มี tag)
//          US ใช้ tag เดิมผ่าน buildTrackedUrl ตามเดิม ไม่ต้องใส่ใน AMAZON_TAGS
//
// ⚠️ ASIN ไม่ได้มีทุกร้าน — สินค้าที่ร้านนั้นไม่ขาย ผู้ซื้อจะเจอหน้า "ไม่พบ"
//    ทดสอบด้วย ?cc=GB (ทดสอบจากประเทศอื่น) กับสินค้าจริงก่อนเปิดใช้เต็มรูปแบบ
const COUNTRY_TO_STORE = {
  US: 'US', CA: 'CA', MX: 'MX', BR: 'BR',
  GB: 'GB', IE: 'GB',
  DE: 'DE', AT: 'DE',
  FR: 'FR', IT: 'IT', ES: 'ES', NL: 'NL',
  JP: 'JP', AU: 'AU', NZ: 'AU', IN: 'IN'
};
const STORE_HOST = {
  US: 'www.amazon.com', CA: 'www.amazon.ca', MX: 'www.amazon.com.mx', BR: 'www.amazon.com.br',
  GB: 'www.amazon.co.uk', DE: 'www.amazon.de', FR: 'www.amazon.fr', IT: 'www.amazon.it',
  ES: 'www.amazon.es', NL: 'www.amazon.nl', JP: 'www.amazon.co.jp', AU: 'www.amazon.com.au',
  IN: 'www.amazon.in'
};

function extractAsin(url) {
  if (!url) return null;
  const m = /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/)([A-Z0-9]{10})(?:[/?#]|$)/i.exec(String(url));
  return m ? m[1].toUpperCase() : null;
}

function buildGeoAmazonUrl(env, productInfo, country, clickId) {
  if (String(env.AMAZON_GEO_REDIRECT || '').toLowerCase() !== 'true') return null;
  const src = productInfo.sourceUrl || productInfo.affiliateLink || '';
  const isAmazon = productInfo.sourceType === 'amazon' || /(^|\.)amazon\./i.test(safeHost(src));
  if (!isAmazon) return null;

  const store = COUNTRY_TO_STORE[country];
  if (!store || store === 'US') return null; // US ใช้ flow เดิม

  let tags;
  try { tags = JSON.parse(env.AMAZON_TAGS || '{}'); } catch { return null; }
  const tag = tags && tags[store];
  if (!tag) return null;

  const asin = extractAsin(productInfo.sourceUrl) || extractAsin(productInfo.affiliateLink);
  if (!asin) return null;

  const u = new URL(`https://${STORE_HOST[store]}/dp/${asin}`);
  u.searchParams.set('tag', tag);
  if (clickId) u.searchParams.set('ascsubtag', clickId);
  return u.href;
}

function safeHost(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function errorPage(title, message, status) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
    <body style="font-family:sans-serif;padding:40px;text-align:center;">
      <p>${escapeHtml(message)}</p>
      <p><a href="/">← Home / กลับหน้าแรก</a></p>
    </body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } }
  );
}

export async function onRequestGet({ params, env, waitUntil, request }) {
  const productId = params.id;

  let productInfo;
  try {
    productInfo = await getProductBuyUrlById(env, productId);
  } catch (e) {
    return errorPage('Error', `Could not load product / โหลดข้อมูลสินค้าไม่สำเร็จ: ${e.message}`, 500);
  }

  const buyUrl = productInfo?.buyUrl || null;
  const cleanedUrl = typeof buyUrl === 'string' ? buyUrl.trim() : buyUrl;

  if (!cleanedUrl) {
    return errorPage('Not found', `Product link not found / ไม่พบลิงก์สินค้านี้ (product id: ${productId})`, 404);
  }

  const userAgent = request.headers.get('User-Agent') || null;
  const isBot = isLikelyBot(userAgent);

  const url = new URL(request.url);

  // ประเทศผู้เข้าชม (Cloudflare ให้ฟรีที่ request.cf.country) — ?cc=GB ใช้ทดสอบ
  const ccOverride = (url.searchParams.get('cc') || '').toUpperCase();
  const country = /^[A-Z]{2}$/.test(ccOverride)
    ? ccOverride
    : (request.cf && request.cf.country) || null;

  // GRAVITY ENHANCEMENT (2026-09-16): unique click_id per real (non-bot) click,
  // injected into the outbound URL as a platform-specific subtag
  // (ascsubtag for Amazon, customid for eBay). See affiliate-tracking.js.
  const clickId = !isBot ? crypto.randomUUID() : null;

  let trackedUrl = cleanedUrl;
  if (!isBot) {
    // ลองร้านประเทศผู้ซื้อก่อน (ถ้าเปิดสวิตช์ + มี tag ของประเทศนั้น) ไม่งั้นใช้ flow เดิม
    trackedUrl =
      buildGeoAmazonUrl(env, productInfo, country, clickId) ||
      buildTrackedUrl(
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
    return errorPage('Invalid link', `This product link is broken / ลิงก์สินค้านี้มีปัญหา (product id: ${productId})`, 502);
  }

  const referrer = request.headers.get('Referer') || null;
  const utmSource = url.searchParams.get('utm_source') || null;
  const utmMedium = url.searchParams.get('utm_medium') || null;
  const ip = request.headers.get('CF-Connecting-IP') || null;

  if (!isBot) {
    // บันทึกประเทศด้วย (ต้องมีคอลัมน์ clicks.country — ถ้ายังไม่มี จะ fallback
    // ไป insert แบบเดิมโดยอัตโนมัติ ไม่ทำให้ click tracking พัง)
    // ALTER TABLE clicks ADD COLUMN country TEXT;
    waitUntil(
      env.DB.prepare(`
        INSERT INTO clicks (product_id, event_type, referrer, utm_source, utm_medium, user_agent, ip, click_id, country)
        VALUES (?, 'click', ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        String(productId), referrer, utmSource, utmMedium, userAgent, ip, clickId, country
      ).run().catch(() =>
        env.DB.prepare(`
          INSERT INTO clicks (product_id, event_type, referrer, utm_source, utm_medium, user_agent, ip, click_id)
          VALUES (?, 'click', ?, ?, ?, ?, ?, ?)
        `).bind(
          String(productId), referrer, utmSource, utmMedium, userAgent, ip, clickId
        ).run()
      ).catch((err) => {
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
          country: country || '(unknown)',
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

  // no-store: ปลายทางขึ้นกับประเทศ/click_id ห้าม cache / noindex: กัน crawler ทำดัชนีลิงก์ redirect
  return new Response(null, {
    status: 302,
    headers: {
      Location: validatedUrl,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
