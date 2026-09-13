/**
 * functions/_lib/agents/handlers/distribution-agent.js — GRAVITY ARS STEP 2 (slice 14)
 * ---------------------------------------------------------------------------
 * Distribution Agent's real capability: claims pending `agent_tasks` rows
 * addressed to `distribution` (created by Media Agent's `media_ready`
 * handoff) and publishes the product's real content to whichever channels
 * this system already has a REAL, credentialed way to reach — same
 * "never invent facts / never fabricate an action" rule as every other
 * agent in this chain.
 *
 * 🔁 GRAVITY CHANGE (slice 14): This handler no longer duplicates any
 * social-posting logic itself. The AI Product Engine Worker deployed at
 * https://af.pakpiromjajaja.workers.dev ("Worker af") already has real,
 * working credentials for Mastodon/Facebook/Threads/Telegram/Discord/
 * X/Pinterest/YouTube (see its distribute.js) and shares the SAME D1
 * database (binding "DB", database "gravity_affiliate",
 * id da05a906-cf21-4717-a96f-c1da3966fd56) that this repo's env.DB also
 * points at — confirmed by comparing wrangler.toml on both sides. That
 * means the SAME productId this handler already has is valid input to
 * Worker af's POST /api/distribute with zero translation/mapping needed.
 *
 * Rather than re-implementing 6+ social integrations here (which would
 * mean requesting a second full set of credentials and maintaining two
 * copies of logic that can drift apart), this handler now simply CALLS
 * Worker af's already-working endpoint, once per channel, exactly the
 * way admin.html's own distributeToChannels() does. See that function
 * (admin.html, Worker af repo) for the reference implementation this
 * mirrors.
 *
 * Two channel families exist:
 *
 *   - AF_CHANNELS (mastodon, facebook, threads, telegram, discord, x,
 *     pinterest, youtube): posted for real via Worker af's
 *     POST /api/distribute. This handler does not need any social media
 *     credentials of its own anymore — Worker af holds them all.
 *   - Reddit: scripts/reddit-publish-queue.js + the sync-reddit-queue.yml
 *     cron ALREADY poll `publish_queue` (channel='reddit', status=
 *     'pending') and post for real. Worker af does not support Reddit,
 *     so this handler still enqueues a row into that same real queue —
 *     unchanged from the previous slice, same async-handoff pattern
 *     Media Agent uses with Shotstack (trigger now, real result lands
 *     later via the existing separate worker).
 *
 * Every attempt (success or failure) is logged to `publish_log` — a
 * pre-existing table this repo defines. A channel that's skipped (e.g.
 * already posted successfully before, per hasSuccessfulLog()) is NOT
 * logged as a new attempt — it only shows up in the task result's
 * `skipped` list, so `publish_log` stays an honest record of real
 * publish attempts only.
 *
 * Distribution is the end of THIS task chain (CONTENT → MEDIA →
 * DISTRIBUTION). Traffic/Conversion/Revenue Agents already run on their
 * own independent report cycle (see control-agent.js's
 * ORDERED_IMPLEMENTED_IDS, run every full cycle regardless of any specific
 * product's publish event) rather than being triggered per-product, so no
 * further createTask() handoff is created here.
 */

import { claimNextTask, completeTask, failTask, writeMemory, nowIso } from '../db.js';

const MAX_TASKS_PER_RUN = 5;

// Worker af — the AI Product Engine that already holds real, working
// credentials for every channel below and shares this repo's D1 database.
// See header comment for how this was confirmed (same database_id in both
// wrangler.toml files).
const AF_API_BASE = 'https://af.pakpiromjajaja.workers.dev';
const AF_DISTRIBUTE_TIMEOUT_MS = 45000;

// Every channel Worker af's /api/distribute genuinely knows how to post to
// for real today. Keep this list in sync with Worker af's own
// DISTRIBUTABLE_CHANNELS (admin.html) — if Worker af adds a new channel,
// add it here too so Distribution Agent picks it up automatically.
const AF_CHANNELS = ['mastodon', 'facebook', 'threads', 'telegram', 'discord', 'x', 'pinterest', 'youtube'];

const CHANNEL_LABELS = {
  mastodon: 'Mastodon', facebook: 'Facebook', threads: 'Threads',
  telegram: 'Telegram', discord: 'Discord', x: 'X', pinterest: 'Pinterest', youtube: 'YouTube'
};

async function hasSuccessfulLog(env, productId, channel) {
  const row = await env.DB.prepare(
    `SELECT id FROM publish_log WHERE product_id = ? AND channel = ? AND status = 'success' LIMIT 1`
  ).bind(productId, channel).first();
  return Boolean(row);
}

async function writePublishLog(env, { productId, channel, status, liveUrl, postId, note }) {
  await env.DB.prepare(`
    INSERT INTO publish_log (product_id, channel, status, live_url, published_at, post_id, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(productId, channel, status, liveUrl || null, nowIso(), postId || null, note || null).run();
}

// Calls Worker af's real POST /api/distribute for one channel. Mirrors
// admin.html's distributeToChannels() request shape exactly so Worker af
// treats this the same as a human clicking "Publish" in the admin UI.
async function postViaWorkerAf({ productId, channel, lang = 'th' }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AF_DISTRIBUTE_TIMEOUT_MS);
  try {
    const res = await fetch(`${AF_API_BASE}/api/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, platform: channel, lang }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) {
      const msg = data?.error || `Worker af ตอบ HTTP ${res.status}`;
      throw new Error(msg);
    }
    return { postUrl: data.postUrl || data.link || null, postId: data.postId || null };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Worker af ไม่ตอบกลับภายใน ${Math.round(AF_DISTRIBUTE_TIMEOUT_MS / 1000)} วินาที (timeout)`);
    }
    throw err;
  }
}

async function assembleOneDistribution(env, task) {
  let payload;
  try {
    payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {});
  } catch {
    payload = {};
  }
  const { marketId, marketName, category, country, productId, productName, contentId } = payload;

  if (!productId) {
    throw new Error('Task payload ไม่มี productId — ไม่มีสินค้าให้ distribute (ควรมาจาก Media Agent เสมอ)');
  }
  if (!contentId) {
    throw new Error('Task payload ไม่มี contentId — ไม่มี content ให้เผยแพร่ (ควรมาจาก Media Agent เสมอ)');
  }

  const content = await env.DB.prepare(`
    SELECT slug FROM content WHERE id = ?
  `).bind(contentId).first();

  if (!content) {
    throw new Error(`ไม่พบ content id=${contentId} ใน content table (ข้อมูลไม่ตรงกัน)`);
  }

  const attempted = [];
  const skipped = [];
  const warnings = [];

  if (!content.slug) {
    warnings.push('content row นี้ไม่มี slug — Worker af อาจสร้าง canonical URL ให้ไม่ได้ ผลอาจล้มเหลว');
  }

  // --- AF_CHANNELS: real posting delegated to Worker af, one call per channel ---
  for (const channel of AF_CHANNELS) {
    if (await hasSuccessfulLog(env, productId, channel)) {
      skipped.push({ channel, reason: 'เคยโพสต์สำเร็จไปแล้วสำหรับสินค้านี้ (กัน duplicate post)' });
      continue;
    }
    try {
      const { postUrl, postId } = await postViaWorkerAf({ productId, channel });
      await writePublishLog(env, {
        productId, channel, status: 'success', liveUrl: postUrl, postId,
        note: 'โพสต์จริงผ่าน Worker af (POST /api/distribute)'
      });
      attempted.push({ channel, status: 'success', liveUrl: postUrl });
    } catch (err) {
      const msg = err.message || String(err);
      await writePublishLog(env, { productId, channel, status: 'failed', note: msg });
      attempted.push({ channel, status: 'failed', error: msg });
    }
  }

  // --- Reddit: Worker af doesn't support it — enqueue into the existing real publish_queue + cron ---
  const existingQueue = await env.DB.prepare(
    `SELECT id, status FROM publish_queue WHERE product_id = ? AND channel = 'reddit' ORDER BY id DESC LIMIT 1`
  ).bind(productId).first();

  if (existingQueue && (existingQueue.status === 'pending' || existingQueue.status === 'done')) {
    skipped.push({ channel: 'reddit', reason: `มีอยู่ในคิวแล้ว (status=${existingQueue.status}) — ไม่ enqueue ซ้ำ` });
  } else {
    await env.DB.prepare(
      `INSERT INTO publish_queue (product_id, channel, status) VALUES (?, 'reddit', 'pending')`
    ).bind(productId).run();
    await writePublishLog(env, { productId, channel: 'reddit', status: 'queued', note: 'enqueue เข้า publish_queue จริง รอ sync-reddit-queue.yml cron ไปโพสต์ (Worker af ไม่รองรับ Reddit)' });
    attempted.push({ channel: 'reddit', status: 'queued' });
  }

  const successCount = attempted.filter(a => a.status === 'success' || a.status === 'queued').length;
  const failedCount = attempted.filter(a => a.status === 'failed').length;

  const result = {
    marketId, marketName, category, country, productId, productName, contentId,
    status: successCount ? 'DISTRIBUTED' : (failedCount ? 'ERRORS' : 'NO_CHANNEL_AVAILABLE'),
    attempted, skipped, warnings,
    note: successCount
      ? `เผยแพร่/enqueue สำเร็จ ${successCount} channel (${attempted.filter(a => a.status !== 'failed').map(a => CHANNEL_LABELS[a.channel] || a.channel).join(', ')}) ผ่าน Worker af` + (failedCount ? ` — ${failedCount} channel ล้มเหลว (ดู attempted)` : '')
      : (failedCount ? `ทุก channel ที่ลองล้มเหลว (${failedCount} channel) — ดู attempted` : 'ยังไม่มี channel ไหนที่พร้อมเผยแพร่ได้จริงตอนนี้ (ดู warnings)')
  };

  await writeMemory(env, 'distribution_reports', `product_${productId}`, result, 'distribution');

  return result;
}

export async function executeDistribution(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const processed = [];
  const failed = [];

  for (let i = 0; i < MAX_TASKS_PER_RUN; i++) {
    const claimed = await claimNextTask(env, 'distribution');
    if (!claimed) break;

    try {
      const result = await assembleOneDistribution(env, claimed);
      await completeTask(env, claimed.id, result);
      processed.push(result);
    } catch (err) {
      const msg = err.message || String(err);
      await failTask(env, claimed.id, msg);
      failed.push({ taskId: claimed.id, error: msg });
    }
  }

  const report = {
    generatedAt: nowIso(),
    status: processed.length ? 'PROCESSED' : (failed.length ? 'ERRORS' : 'NO_PENDING_TASKS'),
    note: processed.length
      ? `ประมวลผล distribution สำเร็จ ${processed.length} รายการ`
      : (failed.length ? `พยายามแล้วแต่ล้มเหลว ${failed.length} รายการ` : 'ไม่มี task ค้างอยู่ในคิวสำหรับ distribution ตอนนี้'),
    processed, failed
  };

  await writeMemory(env, 'distribution_reports', 'latest', report, 'distribution');
  return report;
}
