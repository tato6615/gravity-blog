// functions/api/conversions/import.js
//
// GRAVITY NEW (2026-08-23): POST /api/conversions/import
// รับรายงาน conversion จาก affiliate network (Amazon Associates / eBay
// Partner Network ฯลฯ ที่ export เป็น CSV แล้วแปลงเป็น JSON ก่อนส่งเข้ามา)
// แล้ว insert/update เข้า D1 table `conversions` ที่มีอยู่แล้ว — ไม่มี
// endpoint ไหนเคยเติมข้อมูลตารางนี้มาก่อน ทำให้ analytics dashboard เห็น
// clicks ปกติแต่ conversions/commission เป็น 0 ตลอด (root cause ที่เจอ
// จาก system check ก่อนหน้านี้) ไฟล์นี้แก้จุดนั้นโดยเฉพาะ ไม่แตะไฟล์อื่น
//
// UPDATE (2026-08-23): เพิ่ม secret key auth — endpoint เดิมเป็น public
// ล้วนๆ ไม่มีการเช็คสิทธิ์เลย ใครรู้ URL ก็ยิงข้อมูลปลอมเข้าได้ จึงเพิ่ม
// การเช็ค header X-Import-Secret เทียบกับ env var IMPORT_SECRET ก่อน
// ทำงานส่วนอื่นทุกครั้ง ถ้าไม่ตรง/ไม่มี header นี้ → ตอบ 401 ทันที
// ไม่แตะฐานข้อมูลเลย ต้องตั้งค่า IMPORT_SECRET ใน Cloudflare Pages
// Settings → Environment variables (แบบ Encrypted) ก่อนถึงจะใช้งานได้
//
// วิธีเรียก:
//   POST https://gravity-blog.pages.dev/api/conversions/import
//   Content-Type: application/json
//   X-Import-Secret: <ค่าเดียวกับ env var IMPORT_SECRET>
//   Body: { "rows": [
//     { "product_id": "104", "commission": 12.5, "order_id": "AMZ-001", "status": "approved" },
//     ...
//   ]}
//
// พฤติกรรม:
//   - ถ้า header X-Import-Secret ไม่ตรงกับ env.IMPORT_SECRET → 401 ทันที
//   - ถ้ายังไม่ได้ตั้งค่า env.IMPORT_SECRET ใน Cloudflare → ปฏิเสธด้วย 500
//     (fail-safe: ไม่ปล่อยให้ endpoint เปิดโล่งโดยไม่ตั้งใจ)
//   - แต่ละแถวต้องมี product_id + order_id (unique key ของตาราง) ไม่งั้นข้าม
//     แถวนั้นแล้วรายงานกลับมาใน `skipped` แทนที่จะทำให้ทั้ง batch fail
//   - ใช้ ON CONFLICT(order_id) เหมือนโค้ดต้นฉบับที่ user เตรียมไว้ — ยิงซ้ำ
//     ไฟล์เดิมได้โดยไม่ insert ซ้ำ (update status/commission แทน)
//   - ห่อทุกจุดที่อาจ throw ด้วย try/catch (ตาม pattern เดียวกับ go/[id].js)
//     กัน unhandled exception หลุดไปเป็น raw 500

export async function onRequestPost({ request, env }) {
  // --- Auth check: ต้องผ่านก่อนแตะอะไรทั้งนั้น ---
  const expectedSecret = env.IMPORT_SECRET;
  if (!expectedSecret) {
    // ยังไม่ได้ตั้งค่า env var ใน Cloudflare — ปฏิเสธไว้ก่อนเพื่อความปลอดภัย
    console.error('conversions/import: IMPORT_SECRET env var ยังไม่ได้ตั้งค่า');
    return json({ ok: false, error: 'Server ยังไม่ได้ตั้งค่า auth — ติดต่อผู้ดูแลระบบ' }, 500);
  }

  const providedSecret = request.headers.get('X-Import-Secret');
  if (!providedSecret || providedSecret !== expectedSecret) {
    return json({ ok: false, error: 'Unauthorized: X-Import-Secret ไม่ถูกต้องหรือไม่ได้ส่งมา' }, 401);
  }
  // --- จบ auth check ---

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Request body ไม่ใช่ JSON ที่ถูกต้อง' }, 400);
  }

  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows || rows.length === 0) {
    return json({ ok: false, error: 'ต้องส่ง rows เป็น array ที่มีอย่างน้อย 1 แถว เช่น { rows: [{product_id, commission, order_id, status}] }' }, 400);
  }

  // จำกัดขนาด batch กันยิงเผลอทีเดียวเป็นหมื่นแถวจน D1 batch limit พัง
  const MAX_ROWS = 500;
  if (rows.length > MAX_ROWS) {
    return json({ ok: false, error: `ส่งได้สูงสุด ${MAX_ROWS} แถวต่อครั้ง (ส่งมา ${rows.length}) — แบ่งไฟล์แล้วยิงหลายรอบ` }, 400);
  }

  const valid = [];
  const skipped = [];

  for (const r of rows) {
    const productId = r?.product_id != null ? String(r.product_id).trim() : '';
    const orderId = r?.order_id != null ? String(r.order_id).trim() : '';
    if (!productId || !orderId) {
      skipped.push({ row: r, reason: 'ขาด product_id หรือ order_id (จำเป็นทั้งคู่)' });
      continue;
    }
    const commission = Number(r.commission);
    valid.push({
      productId,
      commission: Number.isFinite(commission) ? commission : 0,
      orderId,
      status: r.status ? String(r.status).trim() : 'pending',
    });
  }

  if (valid.length === 0) {
    return json({ ok: false, error: 'ไม่มีแถวไหนผ่าน validation เลย', skipped }, 400);
  }

  try {
    const stmt = env.DB.prepare(`
      INSERT INTO conversions (product_id, commission, order_id, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(order_id) DO UPDATE SET
        status = excluded.status,
        commission = excluded.commission
    `);
    const batch = valid.map(r => stmt.bind(r.productId, r.commission, r.orderId, r.status));
    await env.DB.batch(batch);

    return json({
      ok: true,
      inserted: valid.length,
      skipped: skipped.length,
      skippedRows: skipped.length ? skipped : undefined,
    });
  } catch (e) {
    console.error('conversions/import: D1 batch failed:', e.message);
    return json({ ok: false, error: 'บันทึกลง D1 ไม่สำเร็จ: ' + e.message }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
