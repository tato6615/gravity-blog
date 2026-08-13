// functions/api/community-toggle.js
// GET  /api/community-toggle  -> { visible: boolean }
// POST /api/community-toggle  { visible: boolean } -> { ok: true, visible: boolean }
// เก็บสถานะเปิด/ปิด Community Hub บน homepage ไว้ใน D1 (ตาราง settings)

const KEY = 'community_hub_visible';

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(KEY).first();
    const visible = row ? row.value === 'true' : false;
    return new Response(JSON.stringify({ visible }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ visible: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json();
    const visible = body.visible === true;
    await env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(KEY, visible ? 'true' : 'false').run();
    return new Response(JSON.stringify({ ok: true, visible }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
