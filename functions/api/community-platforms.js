// functions/api/community-platforms.js
// GET  /api/community-platforms -> { platforms: [...] }
// POST /api/community-platforms { platforms: [...] } -> { ok, platforms }

import { DEFAULT_PLATFORMS } from '../_lib/community-hub.js';

const KEY = 'community_platforms';

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(KEY).first();
    const parsed = row ? JSON.parse(row.value) : null;
    const platforms = Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PLATFORMS;
    return new Response(JSON.stringify({ platforms }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ platforms: DEFAULT_PLATFORMS, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const body = await request.json();
    const input = Array.isArray(body.platforms) ? body.platforms : [];

    const clean = input
      .filter(p => p && typeof p.name === 'string' && p.name.trim() && typeof p.url === 'string' && p.url.trim())
      .map(p => ({
        key: String(p.key || p.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'platform',
        emoji: String(p.emoji || '🔗').slice(0, 4),
        name: String(p.name).trim().slice(0, 40),
        tagline: String(p.tagline || '').trim().slice(0, 80),
        members: p.members ? String(p.members).trim().slice(0, 20) : null,
        memberLabel: String(p.memberLabel || 'followers').trim().slice(0, 20),
        cta: String(p.cta || 'Follow').trim().slice(0, 20),
        url: String(p.url).trim().slice(0, 300),
      }));

    await env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(KEY, JSON.stringify(clean)).run();

    // purge cache ทันที เพื่อให้เว็บอัปเดตเร็วขึ้น (ไม่ต้องรอ 60 วิเต็ม)
    const cache = caches.default;
    await cache.delete(new Request('https://cache.internal/community-platforms-data'));

    return new Response(JSON.stringify({ ok: true, platforms: clean }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
