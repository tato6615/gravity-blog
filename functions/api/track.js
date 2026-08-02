// functions/api/track.js
// Internal click/view tracking — replaces the broken external worker
// (af.pakpiromjajaja.workers.dev, which had no /api/track-click or
// /api/track-view routes). Writes straight into this project's own D1.

export async function onRequestPost({ request, env }) {
  try {
    const { productId, eventType, referrer, utmSource, utmMedium } = await request.json();

    if (!productId) {
      return new Response(JSON.stringify({ error: 'productId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const type = eventType === 'view' ? 'view' : 'click';
    const userAgent = request.headers.get('User-Agent') || null;
    const ip = request.headers.get('CF-Connecting-IP') || null;

    await env.DB.prepare(`
      INSERT INTO clicks (product_id, event_type, referrer, utm_source, utm_medium, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      String(productId),
      type,
      referrer || null,
      utmSource || null,
      utmMedium || null,
      userAgent,
      ip
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('track error:', error.message);
    return new Response(JSON.stringify({ error: 'Failed to record event' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
