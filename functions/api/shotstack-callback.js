/**
 * functions/api/shotstack-callback.js
 *
 * Shotstack ยิง POST มาที่นี่ทุกครั้งที่สถานะ render เปลี่ยน (queued/rendering/done/failed)
 * เราสนใจแค่ตอน status === "done" → ดึง video url → หา record ใน Grist ที่มี
 * shotstack_render_id ตรงกัน (ที่ product-webhook.js บันทึกไว้ก่อนหน้า) → อัปเดต video_url
 *
 * ใช้ env vars ชุดเดียวกับ product-webhook.js
 */

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    const { id: renderId, status, url } = payload;

    if (status !== "done") {
      // แค่ log ไว้เฉยๆ ระหว่างสถานะยัง queued/rendering — ไม่ต้องทำอะไร
      return new Response(JSON.stringify({ received: true, status }), { status: 200 });
    }

    // หา record ใน Grist ที่ shotstack_render_id ตรงกับ renderId นี้
    const rowId = await findGristRowByRenderId({ renderId, env });

    if (!rowId) {
      console.warn(`No Grist row found for render id ${renderId}`);
      return new Response(JSON.stringify({ received: true, matched: false }), { status: 200 });
    }

    await updateGristRecord({
      rowId,
      fields: { video_url: url, video_status: "done" },
      env,
    });

    // TODO ขั้นถัดไป: trigger upload ไป YouTube/TikTok ตรงนี้ (เมื่อ credentials พร้อม)

    return new Response(JSON.stringify({ received: true, matched: true, rowId }), { status: 200 });
  } catch (err) {
    console.error("shotstack-callback error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}

async function findGristRowByRenderId({ renderId, env }) {
  const url = `https://docs.getgrist.com/api/docs/${env.GRIST_DOC_ID}/tables/${env.GRIST_PRODUCTS_TABLE}/records?filter=${encodeURIComponent(
    JSON.stringify({ shotstack_render_id: [renderId] })
  )}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.GRIST_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`Grist lookup failed: ${await res.text()}`);
  }

  const data = await res.json();
  const record = data.records && data.records[0];
  return record ? record.id : null;
}

async function updateGristRecord({ rowId, fields, env }) {
  const url = `https://docs.getgrist.com/api/docs/${env.GRIST_DOC_ID}/tables/${env.GRIST_PRODUCTS_TABLE}/records`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GRIST_API_KEY}`,
    },
    body: JSON.stringify({ records: [{ id: rowId, fields }] }),
  });

  if (!res.ok) {
    throw new Error(`Grist update failed: ${await res.text()}`);
  }
}
