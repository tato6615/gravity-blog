/**
 * functions/api/track-event.js
 * ---------------------------------------------------------------------------
 * รับ attention events จาก client-side tracking snippet บนหน้า product/content
 * แล้วบันทึกลง D1 ตาราง attention_events
 *
 * POST /api/track-event
 * Body (JSON):
 *   session_id  : string (required) — anonymous session id จาก client
 *   product_id  : number (optional)
 *   variant_id  : string (optional)
 *   channel     : string (optional) — facebook/x/pinterest/website/direct/...
 *   event_type  : string (required) — view|scroll_25|scroll_50|scroll_75|scroll_100|click|exit
 *   section     : string (optional) — review|comparison|faq|buying_guide|cta
 *   device      : string (optional) — mobile|desktop|tablet (detect server-side ถ้าไม่ส่งมา)
 *
 * Response: { ok: true } หรือ { ok: false, error: "..." }
 *
 * Bot filter: เช็ค User-Agent เบาๆ เหมือน /go/[id].js
 * CORS: รับจาก gravity-blog.pages.dev และ localhost (dev)
 */

const VALID_EVENT_TYPES = new Set([
  'view', 'scroll_25', 'scroll_50', 'scroll_75', 'scroll_100', 'click', 'exit'
]);

const VALID_SECTIONS = new Set([
  'review', 'comparison', 'faq', 'buying_guide', 'cta'
]);

const VALID_CHANNELS = new Set([
  'facebook', 'x', 'pinterest', 'website', 'direct', 'email', 'other'
]);

const BOT_PATTERN = /bot|crawler|spider|crawling|facebook|google|bing|yandex|baidu|duckduck|slurp|teoma|ia_archiver/i;

function detectDevice(ua = '') {
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
    return /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile';
  }
  return 'desktop';
}

function isBot(ua = '') {
  return BOT_PATTERN.test(ua);
}

const ALLOWED_ORIGINS = [
  'https://gravity-blog.pages.dev',
  'http://localhost:8788',
  'http://localhost:3000'
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  const ua = request.headers.get('User-Agent') || '';

  // bot filter
  if (isBot(ua)) {
    return Response.json({ ok: false, error: 'bot' }, {
      status: 400,
      headers: corsHeaders(origin)
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid JSON' }, {
      status: 400,
      headers: corsHeaders(origin)
    });
  }

  const { session_id, product_id, variant_id, channel, event_type, section } = body;

  // validate required fields
  if (!session_id || typeof session_id !== 'string' || session_id.length > 128) {
    return Response.json({ ok: false, error: 'session_id invalid' }, {
      status: 400,
      headers: corsHeaders(origin)
    });
  }

  if (!event_type || !VALID_EVENT_TYPES.has(event_type)) {
    return Response.json({ ok: false, error: `event_type must be one of: ${[...VALID_EVENT_TYPES].join(', ')}` }, {
      status: 400,
      headers: corsHeaders(origin)
    });
  }

  // sanitize optional fields
  const safeProductId = product_id && Number.isInteger(Number(product_id)) ? Number(product_id) : null;
  const safeVariantId = variant_id && typeof variant_id === 'string' ? variant_id.slice(0, 64) : null;
  const safeChannel = channel && VALID_CHANNELS.has(channel) ? channel : 'other';
  const safeSection = section && VALID_SECTIONS.has(section) ? section : null;
  const safeDevice = detectDevice(ua);
  const ts = new Date().toISOString();

  try {
    await env.DB.prepare(`
      INSERT INTO attention_events
        (session_id, product_id, variant_id, channel, event_type, section, device, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      session_id,
      safeProductId,
      safeVariantId,
      safeChannel,
      event_type,
      safeSection,
      safeDevice,
      ts
    ).run();

    return Response.json({ ok: true }, { headers: corsHeaders(origin) });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, {
      status: 500,
      headers: corsHeaders(origin)
    });
  }
}
