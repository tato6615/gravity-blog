/**
 * functions/api/product-webhook.js
 *
 * Grist ยิง webhook มาที่ endpoint นี้ทุกครั้งที่มี record ใหม่ใน table PRODUCTS
 * → เราสร้าง Shotstack render job (รูปสินค้า + zoom + ชื่อสินค้า)
 * → เขียน render_id + status="rendering" กลับเข้า Grist ทันที
 * → Shotstack จะยิง callback มาที่ /api/shotstack-callback เมื่อ render เสร็จ
 *
 * Cloudflare Pages env vars ที่ต้องตั้ง (Settings > Environment variables):
 *   GRIST_API_KEY        - API key ส่วนตัว (Grist > Profile Settings > API Key)
 *   GRIST_DOC_ID          - ดูจาก URL ตอนเปิด doc เช่น docs.getgrist.com/<DOC_ID>/GRAVITY_OS...
 *   GRIST_PRODUCTS_TABLE  - ชื่อ table เช่น "PRODUCTS"
 *   SHOTSTACK_API_KEY     - sandbox key ที่ใช้ทดสอบอยู่แล้ว
 *   SHOTSTACK_ENV         - "stage" (sandbox) หรือ "v1" (production)
 *   SITE_URL              - โดเมนจริงของ gravity-blog เช่น https://gravity-blog.pages.dev
 */

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();

    // Grist webhook ส่งมาเป็น array ของ record ที่เปลี่ยนแปลง
    // รูปแบบทั่วไป: { records: [ { id, fields: {...} } ] } หรือ array ตรงๆ แล้วแต่การตั้งค่า webhook
    const records = Array.isArray(payload) ? payload : payload.records || [payload];

    const results = [];

    for (const record of records) {
      const fields = record.fields || record;
      const rowId = record.id || record.rowId;

      const productName = fields.product_name;
      const imageUrl = fields.image_url;

      if (!productName || !imageUrl) {
        results.push({ rowId, skipped: true, reason: "missing product_name or image_url" });
        continue;
      }

      // 1) สร้าง Shotstack render job
      const renderId = await triggerShotstackRender({
        productName,
        imageUrl,
        env,
      });

      // 2) เขียนกลับเข้า Grist: บันทึก render id + สถานะ "rendering"
      await updateGristRecord({
        rowId,
        fields: {
          shotstack_render_id: renderId,
          video_status: "rendering",
        },
        env,
      });

      results.push({ rowId, renderId, status: "rendering" });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("product-webhook error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function triggerShotstackRender({ productName, imageUrl, env }) {
  const apiBase = `https://api.shotstack.io/edit/${env.SHOTSTACK_ENV}/render`;

  const editJson = {
    timeline: {
      background: "#000000",
      tracks: [
        {
          clips: [
            {
              asset: { type: "text", text: productName, font: { color: "#ffffff", size: 40, family: "Montserrat ExtraBold" }, alignment: { horizontal: "center", vertical: "bottom" } },
              start: 0,
              length: 5,
              offset: { y: 0.05 },
            },
          ],
        },
        {
          clips: [
            {
              asset: { type: "image", src: imageUrl },
              start: 0,
              length: 5,
              effect: "zoomIn",
              fit: "contain",
            },
          ],
        },
      ],
    },
    output: { format: "mp4", size: { width: 1080, height: 1920 } }, // แนวตั้ง เหมาะกับ TikTok/Shorts
    callback: `${env.SITE_URL}/api/shotstack-callback`,
  };

  const res = await fetch(apiBase, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.SHOTSTACK_API_KEY,
    },
    body: JSON.stringify(editJson),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(`Shotstack render failed: ${JSON.stringify(data)}`);
  }

  return data.response.id; // render id
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
    const text = await res.text();
    throw new Error(`Grist update failed: ${text}`);
  }
}
