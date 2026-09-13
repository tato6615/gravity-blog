/**
 * functions/_lib/agents/handlers/media-agent.js — GRAVITY ARS STEP 2 (slice 12)
 * ---------------------------------------------------------------------------
 * Media Agent's first real capability: claims pending `agent_tasks` rows
 * addressed to `media` (created by Content Agent once a `content` row
 * exists for a product — see content-agent.js's `content_ready` handoff)
 * and packages the REAL media assets that already exist for that product
 * (products.image_url, products.gallery_image_urls) — same "never invent
 * facts" rule as every other agent in this chain.
 *
 * Unlike content/audience/offer, Media Agent is NOT starting from zero on
 * generation: a real, already-credentialed video pipeline exists in this
 * repo (functions/api/product-webhook.js → Shotstack render API, using
 * env.SHOTSTACK_API_KEY / SHOTSTACK_ENV / SITE_URL, called back by
 * functions/api/shotstack-callback.js which writes video_url/video_status
 * straight onto the `products` row). Per spec section 13, a missing
 * credential is a legitimate reason to stop and ask the human — but this
 * credential is NOT missing, it's already wired and working. So this
 * handler reuses that same real capability instead of inventing a new one
 * or leaving the product with no video:
 *
 *   - product already has a finished video (video_status='done')
 *       → package it as-is, do NOT re-render (avoid burning Shotstack
 *         credits / creating duplicate render jobs for the same product).
 *   - a render is already in flight (video_status='rendering')
 *       → package what's real right now (image), do NOT trigger a second
 *         render for the same product.
 *   - no render yet, but a real product image exists and Shotstack env
 *     vars are present
 *       → trigger ONE real Shotstack render (same edit JSON shape as
 *         product-webhook.js) and record the render id, exactly like that
 *         webhook does.
 *   - no product image at all
 *       → cannot generate a video from nothing; package honestly notes
 *         this as a warning instead of pretending an asset exists.
 *   - Shotstack env vars are missing entirely
 *       → this IS the "need an API credential" case from section 13; note
 *         it plainly as a warning/limitation rather than silently no-op'ing.
 *
 * Nothing here duplicates state: it reads products.image_url /
 * gallery_image_urls / video_url / video_status / shotstack_render_id
 * (already written by product-webhook.js / shotstack-callback.js) rather
 * than maintaining a second copy of "what media exists" anywhere.
 *
 * Hands off to `distribution` next in the spec's pipeline
 * (CONTENT → MEDIA → DISTRIBUTION), even though no Distribution Agent
 * handler exists yet — same reasoning as every earlier handoff in this
 * chain: the task sits safely in the queue until that handler is
 * implemented, rather than silently dropped.
 */

import { claimNextTask, completeTask, failTask, createTask, writeMemory, nowIso } from '../db.js';

const MAX_TASKS_PER_RUN = 5;

function parseGallery(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  const str = String(raw).trim();
  if (str.startsWith('[')) {
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) return arr.filter(Boolean);
    } catch { /* fall through to plain split */ }
  }
  return str.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

// Same Shotstack edit JSON shape as functions/api/product-webhook.js —
// kept as its own small copy here (rather than importing from an `api/`
// route module) so the agent handler doesn't depend on an HTTP route
// file's internals; both call the same real Shotstack API with the same
// real credentials.
async function triggerShotstackRender({ productName, imageUrl, env }) {
  const apiBase = `https://api.shotstack.io/edit/${env.SHOTSTACK_ENV}/render`;

  const editJson = {
    timeline: {
      background: '#000000',
      tracks: [
        {
          clips: [
            {
              asset: {
                type: 'text',
                text: productName,
                font: { color: '#ffffff', size: 40, family: 'Montserrat ExtraBold' },
                alignment: { horizontal: 'center', vertical: 'bottom' }
              },
              start: 0,
              length: 5,
              offset: { y: 0.05 }
            }
          ]
        },
        {
          clips: [
            {
              asset: { type: 'image', src: imageUrl },
              start: 0,
              length: 5,
              effect: 'zoomIn',
              fit: 'contain'
            }
          ]
        }
      ]
    },
    output: { format: 'mp4', size: { width: 1080, height: 1920 } },
    callback: `${env.SITE_URL}/api/shotstack-callback`
  };

  const res = await fetch(apiBase, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.SHOTSTACK_API_KEY
    },
    body: JSON.stringify(editJson)
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(`Shotstack render failed: ${JSON.stringify(data)}`);
  }

  return data.response.id; // render id
}

async function assembleOneMedia(env, task) {
  let payload;
  try {
    payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {});
  } catch {
    payload = {};
  }
  const { marketId, marketName, category, country, productId, productName, contentId } = payload;

  if (!productId) {
    throw new Error('Task payload ไม่มี productId — ไม่มีสินค้าให้จัดการ media (ควรมาจาก Content Agent เสมอ)');
  }

  const product = await env.DB.prepare(`
    SELECT id, product_name, image_url, gallery_image_urls, video_url, video_status, shotstack_render_id
    FROM products WHERE id = ?
  `).bind(productId).first();

  if (!product) {
    throw new Error(`ไม่พบสินค้า id=${productId} ใน products table (ข้อมูลไม่ตรงกัน)`);
  }

  const galleryImageUrls = parseGallery(product.gallery_image_urls);
  const hasShotstackCreds = Boolean(env.SHOTSTACK_API_KEY && env.SHOTSTACK_ENV && env.SITE_URL);

  let qualityScore = 0;
  const qualityWarnings = [];
  let videoStatus = product.video_status || null;
  let videoUrl = product.video_url || null;
  let shotstackRenderId = product.shotstack_render_id || null;
  let renderAction = 'NONE';

  if (product.image_url) {
    qualityScore += 40;
  } else {
    qualityWarnings.push('ไม่มีรูปภาพสินค้า (image_url) — สร้างวิดีโอไม่ได้ถ้าไม่มีรูปจริง');
  }

  if (galleryImageUrls.length) {
    qualityScore += 10;
  } else {
    qualityWarnings.push('ไม่มี gallery images เพิ่มเติมสำหรับทำ creative variation');
  }

  if (videoStatus === 'done' && videoUrl) {
    qualityScore += 50;
    renderAction = 'ALREADY_DONE';
  } else if (videoStatus === 'rendering' && shotstackRenderId) {
    qualityScore += 25;
    qualityWarnings.push(`วิดีโอกำลัง render อยู่แล้ว (renderId=${shotstackRenderId}) — ไม่สั่ง render ซ้ำ`);
    renderAction = 'ALREADY_RENDERING';
  } else if (product.image_url && hasShotstackCreds) {
    // No video yet, no render in flight, and the real Shotstack credential
    // already exists in this environment — trigger ONE real render now,
    // exactly like functions/api/product-webhook.js does.
    shotstackRenderId = await triggerShotstackRender({
      productName: product.product_name,
      imageUrl: product.image_url,
      env
    });
    videoStatus = 'rendering';
    await env.DB.prepare(
      `UPDATE products SET shotstack_render_id = ?, video_status = ?, video_updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(shotstackRenderId, videoStatus, product.id).run();
    qualityScore += 25;
    renderAction = 'TRIGGERED';
  } else if (product.image_url && !hasShotstackCreds) {
    qualityWarnings.push('มีรูปสินค้าแล้ว แต่ไม่มี SHOTSTACK_API_KEY/SHOTSTACK_ENV/SITE_URL ใน environment — ต้องขอ credential นี้ก่อนถึงจะสร้างวิดีโออัตโนมัติได้ (ตามข้อ 13 ของสเปค)');
    renderAction = 'BLOCKED_NO_CREDENTIAL';
  }

  const qualityTier = qualityScore >= 70 ? 'HIGH' : qualityScore >= 40 ? 'MEDIUM' : 'LOW';

  const mediaPackage = {
    productId, productName: product.product_name, contentId,
    primaryImageUrl: product.image_url || null,
    galleryImageUrls,
    videoUrl, videoStatus, shotstackRenderId,
    renderAction,
    qualityScore, qualityTier, qualityWarnings,
    packagedAt: nowIso()
  };

  await writeMemory(env, 'media_reports', `product_${productId}`, mediaPackage, 'media');

  const result = {
    marketId, marketName, category, country, productId, productName: product.product_name,
    status: 'MEDIA_PACKAGED',
    contentId,
    mediaQualityScore: qualityScore, mediaQualityTier: qualityTier, qualityWarnings,
    renderAction,
    note: renderAction === 'TRIGGERED'
      ? `สั่ง render วิดีโอจริงผ่าน Shotstack สำหรับ "${product.product_name}" แล้ว (renderId=${shotstackRenderId}) — ผลจะกลับมาทาง shotstack-callback`
      : `จัดชุด media สำหรับ "${product.product_name}" สำเร็จ (คุณภาพ: ${qualityTier}, คะแนน ${qualityScore}/100) — ประกอบจาก asset จริงที่มีอยู่ ไม่ได้แต่งขึ้นเอง`
  };

  const createdTask = await createTask(env, {
    senderAgent: 'media',
    receiverAgent: 'distribution',
    messageType: 'media_ready',
    priority: 6,
    payload: {
      marketId, marketName, category, country,
      productId, productName: product.product_name, contentId,
      primaryImageUrl: mediaPackage.primaryImageUrl,
      galleryImageUrls,
      videoUrl, videoStatus,
      mediaQualityTier: qualityTier
    }
  });

  return { ...result, nextTaskId: createdTask.id };
}

export async function executeMediaWorkflow(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const processed = [];
  const failed = [];

  for (let i = 0; i < MAX_TASKS_PER_RUN; i++) {
    const claimed = await claimNextTask(env, 'media');
    if (!claimed) break;

    try {
      const result = await assembleOneMedia(env, claimed);
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
      ? `จัดชุด media สำเร็จ ${processed.length} รายการ ส่งต่อ Distribution Agent แล้วทุกรายการ`
      : (failed.length ? `พยายามแล้วแต่ล้มเหลว ${failed.length} รายการ` : 'ไม่มี task ค้างอยู่ในคิวสำหรับ media ตอนนี้'),
    processed, failed
  };

  await writeMemory(env, 'media_reports', 'latest', report, 'media');
  return report;
}
