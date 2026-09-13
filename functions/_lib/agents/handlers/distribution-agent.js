/**
 * functions/_lib/agents/handlers/distribution-agent.js — GRAVITY ARS STEP 2 (slice 13)
 * ---------------------------------------------------------------------------
 * Distribution Agent's first real capability: claims pending `agent_tasks`
 * rows addressed to `distribution` (created by Media Agent's `media_ready`
 * handoff) and publishes the product's real content to whichever channels
 * this repo already has a REAL, credentialed way to reach — same
 * "never invent facts / never fabricate an action" rule as every other
 * agent in this chain.
 *
 * Two real channels exist already, and this handler reuses both rather
 * than inventing new integrations:
 *
 *   - Mastodon: functions/api/send-mastodon.js already posts to a real
 *     Mastodon instance via env.MASTODON_INSTANCE_URL / MASTODON_ACCESS_TOKEN.
 *     That logic is duplicated here as `postToMastodon()` (same reasoning
 *     as media-agent.js duplicating Shotstack's call rather than importing
 *     an `api/` route module) and called directly with the product's real
 *     seo_title/meta_description/canonical URL from the `content` table —
 *     never invented ad copy.
 *   - Reddit: scripts/reddit-publish-queue.js + the
 *     sync-reddit-queue.yml cron ALREADY poll `publish_queue` (channel=
 *     'reddit', status='pending') and post for real. This handler does not
 *     call Reddit's API itself (that script runs with GitHub Actions
 *     secrets this Pages Function doesn't have) — it just enqueues a row
 *     into that same real queue, exactly the same async-handoff pattern
 *     Media Agent uses with Shotstack (trigger now, real result lands
 *     later via the existing separate worker).
 *
 * Any other channel (facebook/threads/discord/telegram/x/pinterest/...)
 * has no working credential or endpoint anywhere in this repo yet — this
 * handler reports that honestly as a warning (the section-13 "need a
 * credential" case) instead of pretending to post.
 *
 * The canonical URL for every channel is the real `/product/{slug}` page
 * (functions/product/[slug].js), the same URL shape scripts/reddit-
 * publish-queue.js already assumes — so every channel drives traffic
 * through the one page Traffic Agent's click tracking already instruments
 * (functions/go/[id].js), rather than a second, untracked link shape.
 *
 * Every attempt (success or failure) is logged to `publish_log` — a
 * pre-existing table this repo defines but until now nothing wrote to.
 * A channel that's skipped for lack of credential/data is NOT logged as
 * an attempt (nothing was actually attempted) — it only shows up in the
 * task result's warnings, so `publish_log` stays an honest record of real
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
const MASTODON_MAX_CHARS = 480;

async function postToMastodon({ text, env }) {
  const instanceUrl = env.MASTODON_INSTANCE_URL.replace(/\/+$/, '');
  const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.MASTODON_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ status: text, visibility: 'public' })
  });

  if (!res.ok) {
    const details = await res.text().catch(() => '');
    throw new Error(`Mastodon API ปฏิเสธ request (${res.status}): ${details}`);
  }

  const data = await res.json().catch(() => null);
  return data?.url || null;
}

function buildMastodonText({ seoTitle, metaDescription, canonicalUrl }) {
  const fixed = [seoTitle, canonicalUrl].filter(Boolean).join('\n\n');
  const remaining = MASTODON_MAX_CHARS - fixed.length - 2;
  const desc = metaDescription && remaining > 20 ? metaDescription.slice(0, remaining) : '';
  return [seoTitle, desc, canonicalUrl].filter(Boolean).join('\n\n');
}

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
    SELECT slug, seo_title, meta_description FROM content WHERE id = ?
  `).bind(contentId).first();

  if (!content) {
    throw new Error(`ไม่พบ content id=${contentId} ใน content table (ข้อมูลไม่ตรงกัน)`);
  }

  const attempted = [];
  const skipped = [];
  const warnings = [];

  if (!content.slug) {
    warnings.push('content row นี้ไม่มี slug — สร้าง canonical URL ไม่ได้ ข้าม channel ทั้งหมดที่ต้องใช้ลิงก์');
  }
  if (!env.SITE_URL) {
    warnings.push('ไม่มี SITE_URL ใน environment — สร้าง canonical URL ไม่ได้');
  }

  const canonicalUrl = (content.slug && env.SITE_URL)
    ? `${env.SITE_URL.replace(/\/+$/, '')}/product/${content.slug}`
    : null;

  // --- Mastodon: real credentialed endpoint, post directly ---
  const hasMastodonCreds = Boolean(env.MASTODON_INSTANCE_URL && env.MASTODON_ACCESS_TOKEN);
  if (!canonicalUrl) {
    skipped.push({ channel: 'mastodon', reason: 'ไม่มี canonical URL' });
  } else if (!hasMastodonCreds) {
    warnings.push('ไม่มี MASTODON_INSTANCE_URL/MASTODON_ACCESS_TOKEN ใน environment — ต้องขอ credential นี้ก่อนถึงจะโพสต์ Mastodon อัตโนมัติได้ (ตามข้อ 13 ของสเปค)');
    skipped.push({ channel: 'mastodon', reason: 'ไม่มี credential' });
  } else if (await hasSuccessfulLog(env, productId, 'mastodon')) {
    skipped.push({ channel: 'mastodon', reason: 'เคยโพสต์สำเร็จไปแล้วสำหรับสินค้านี้ (กัน duplicate post)' });
  } else {
    const text = buildMastodonText({
      seoTitle: content.seo_title || productName,
      metaDescription: content.meta_description,
      canonicalUrl
    });
    try {
      const postUrl = await postToMastodon({ text, env });
      await writePublishLog(env, { productId, channel: 'mastodon', status: 'success', liveUrl: postUrl, note: 'โพสต์จริงผ่าน Mastodon API' });
      attempted.push({ channel: 'mastodon', status: 'success', liveUrl: postUrl });
    } catch (err) {
      const msg = err.message || String(err);
      await writePublishLog(env, { productId, channel: 'mastodon', status: 'failed', note: msg });
      attempted.push({ channel: 'mastodon', status: 'failed', error: msg });
    }
  }

  // --- Reddit: enqueue into the existing real publish_queue + cron ---
  if (!canonicalUrl) {
    skipped.push({ channel: 'reddit', reason: 'ไม่มี canonical URL' });
  } else {
    const existingQueue = await env.DB.prepare(
      `SELECT id, status FROM publish_queue WHERE product_id = ? AND channel = 'reddit' ORDER BY id DESC LIMIT 1`
    ).bind(productId).first();

    if (existingQueue && (existingQueue.status === 'pending' || existingQueue.status === 'done')) {
      skipped.push({ channel: 'reddit', reason: `มีอยู่ในคิวแล้ว (status=${existingQueue.status}) — ไม่ enqueue ซ้ำ` });
    } else {
      await env.DB.prepare(
        `INSERT INTO publish_queue (product_id, channel, status) VALUES (?, 'reddit', 'pending')`
      ).bind(productId).run();
      await writePublishLog(env, { productId, channel: 'reddit', status: 'queued', note: 'enqueue เข้า publish_queue จริง รอ sync-reddit-queue.yml cron ไปโพสต์' });
      attempted.push({ channel: 'reddit', status: 'queued' });
    }
  }

  // --- Everything else: no real credential/endpoint exists in this repo yet ---
  for (const channel of ['facebook', 'threads', 'discord', 'telegram', 'x', 'pinterest']) {
    skipped.push({ channel, reason: 'ยังไม่มี credential/endpoint จริงสำหรับ channel นี้ในระบบ' });
  }

  const successCount = attempted.filter(a => a.status === 'success' || a.status === 'queued').length;
  const failedCount = attempted.filter(a => a.status === 'failed').length;

  const result = {
    marketId, marketName, category, country, productId, productName, contentId,
    status: successCount ? 'DISTRIBUTED' : (failedCount ? 'ERRORS' : 'NO_CHANNEL_AVAILABLE'),
    attempted, skipped, warnings,
    note: successCount
      ? `เผยแพร่/enqueue สำเร็จ ${successCount} channel (${attempted.filter(a => a.status !== 'failed').map(a => a.channel).join(', ')}) — channel อื่นข้ามเพราะไม่มี credential จริง`
      : 'ยังไม่มี channel ไหนที่พร้อมเผยแพร่ได้จริงตอนนี้ (ดู warnings)'
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
