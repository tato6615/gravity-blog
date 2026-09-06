/**
 * functions/api/shotstack-callback.js  (D1 version — เลิกพึ่ง Grist)
 *
 * Shotstack ยิง POST มาที่นี่ทุกครั้งที่สถานะ render เปลี่ยน (queued/rendering/done/failed)
 * สนใจแค่ตอน status === "done" → หาแถวใน D1 `products` ที่ shotstack_render_id ตรงกัน
 * (บันทึกไว้ก่อนหน้าโดย product-webhook.js) → อัปเดต video_url + video_status
 *
 * ต้องมี D1 binding env.DB (เช็คชื่อ binding จริงให้ตรงกับ wrangler.toml)
 * และคอลัมน์ shotstack_render_id / video_url / video_status / video_updated_at
 * ใน products ต้องมีอยู่แล้ว (ดู ALTER TABLE ใน product-webhook.js)
 */

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    const { id: renderId, status, url } = payload;

    if (status !== "done") {
      // แค่ log ไว้เฉยๆ ระหว่างสถานะยัง queued/rendering — ไม่ต้องทำอะไร
      return new Response(JSON.stringify({ received: true, status }), { status: 200 });
    }

    // หาแถวใน D1 ที่ shotstack_render_id ตรงกับ renderId นี้
    const product = await env.DB.prepare(
      "SELECT id FROM products WHERE shotstack_render_id = ?"
    )
      .bind(renderId)
      .first();

    if (!product) {
      console.warn(`No D1 product row found for render id ${renderId}`);
      return new Response(JSON.stringify({ received: true, matched: false }), { status: 200 });
    }

    await env.DB.prepare(
      "UPDATE products SET video_url = ?, video_status = ?, video_updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
      .bind(url, "done", product.id)
      .run();

    // TODO ขั้นถัดไป: trigger upload ไป YouTube/TikTok ตรงนี้ (เมื่อ credentials พร้อม)
    return new Response(
      JSON.stringify({ received: true, matched: true, productId: product.id }),
      { status: 200 }
    );
  } catch (err) {
    console.error("shotstack-callback error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
