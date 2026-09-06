/**
 * functions/api/product-webhook.js  (D1 version — เลิกพึ่ง Grist)
 *
 * เดิม: Grist ยิง webhook มาทุกครั้งที่มี record ใหม่ใน table PRODUCTS
 * ตอนนี้: endpoint นี้รับ { id } (D1 product id) เป็น trigger เฉยๆ แล้วไปดึงข้อมูลจริง
 *         (product_name, image_url) จาก D1 เอง แทนที่จะเชื่อ field ที่ส่งมาใน body
 *         → ป้องกันปัญหา field ไม่ตรง/ไม่ครบจาก whoever เรียก webhook นี้
 *
 * ⚠️ ต้องเปลี่ยนตัวเรียก (caller) เดิมที่เป็น Grist's native webhook
 *    เป็นอะไรก็ตามที่เขียน product ใหม่ลง D1 (น่าจะเป็น Worker "af")
 *    ให้ยิง POST มาที่ /api/product-webhook พร้อม body: { "id": <product_id> }
 *    ทันทีหลัง insert แถวใหม่ใน D1 `products` — จุดนี้ยังไม่ได้แก้ ต้องไปเพิ่มโค้ดฝั่งนั้นเอง
 *
 * Cloudflare Pages env vars ที่ต้องมี:
 *   SHOTSTACK_API_KEY  - sandbox key
 *   SHOTSTACK_ENV      - "stage" หรือ "v1"
 *   SITE_URL           - เช่น https://gravity-blog.pages.dev
 *   D1 binding: env.DB - ⚠️ เช็คชื่อ binding จริงใน wrangler.toml / d1-products.js
 *                          ถ้าไม่ใช่ "DB" ต้องแก้ทุกจุดที่ env.DB ในไฟล์นี้
 *
 * D1 schema ที่ต้องมี (ALTER TABLE ถ้ายังไม่มี):
 *   ALTER TABLE products ADD COLUMN shotstack_render_id TEXT;
 *   ALTER TABLE products ADD COLUMN video_url TEXT;
 *   ALTER TABLE products ADD COLUMN video_status TEXT;
 *   ALTER TABLE products ADD COLUMN video_updated_at TEXT;
 *
 * ⚠️ คอลัมน์ `name` / `image_url` ด้านล่างเป็นชื่อที่ "เดา" ตาม pattern ทั่วไป
 *    ต้องเช็คกับผล PRAGMA table_info(products) จริง แล้วแก้ชื่อคอลัมน์ในควรี SELECT ด้านล่างให้ตรง
 */

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();

    // รองรับทั้งแบบส่ง id เดียว { id } และแบบ array [{ id }, ...] เผื่อ caller ยิงหลายตัวพร้อมกัน
    const records = Array.isArray(payload) ? payload : payload.records || [payload];
    const results = [];

    for (const record of records) {
      const fields = record.fields || record;
      const productId = record.id || record.rowId || fields.id || fields.productId;

      if (!productId) {
        results.push({ skipped: true, reason: "missing product id" });
        continue;
      }

      // ดึงข้อมูลสินค้าจาก D1 — แหล่งความจริงเดียว แทนที่จะเชื่อ field จาก webhook body
      const product = await env.DB.prepare(
        "SELECT id, name, image_url FROM products WHERE id = ?"
      )
        .bind(productId)
        .first();

      if (!product || !product.name || !product.image_url) {
        results.push({
          productId,
          skipped: true,
          reason: "product not found in D1, or missing name/image_url",
        });
        continue;
      }

      // 1) สร้าง Shotstack render job
      const renderId = await triggerShotstackRender({
        productName: product.name,
        imageUrl: product.image_url,
        env,
      });

      // 2) เขียนกลับเข้า D1: บันทึก render id + สถานะ "rendering"
      await env.DB.prepare(
        "UPDATE products SET shotstack_render_id = ?, video_status = ?, video_updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      )
        .bind(renderId, "rendering", product.id)
        .run();

      results.push({ productId: product.id, renderId, status: "rendering" });
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
              asset: {
                type: "text",
                text: productName,
                font: { color: "#ffffff", size: 40, family: "Montserrat ExtraBold" },
                alignment: { horizontal: "center", vertical: "bottom" },
              },
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
    output: { format: "mp4", size: { width: 1080, height: 1920 } },
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
