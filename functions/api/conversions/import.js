// functions/api/conversions/import.js
//
// GRAVITY NEW (2026-08-23): POST /api/conversions/import
// รับรายงาน conversion จาก affiliate network (Amazon Associates / eBay
// Partner Network ฯลฯ ที่ export เป็น CSV แล้วแปลงเป็น JSON ก่อนส่งเข้ามา)
// แล้ว insert/update เข้า D1 table `conversions`
//
// GRAVITY ENHANCEMENT (2026-09-16): แต่ละแถวรับ click_id เพิ่มได้ (optional)
// — ถ้า network ส่ง subtag/customid ที่ตรงกับ click_id ที่เราฝังไว้ตอน
// redirect กลับคืนมาในรายงาน commission ก็ map ตรงนี้ได้ ทำให้จับคู่
// click กับ conversion แบบ 1:1 แทนที่จะเป็นแค่ aggregate ต่อ product_id
// เหมือนก่อนหน้านี้ ถ้า network ไหนไม่ส่ง subtag กลับมา ก็แค่ไม่ใส่
// click_id ตรงนี้ ระบบยังทำงานได้ปกติเหมือนเดิมทุกอย่าง (backward compatible)

export async function onRequestPost({ request, env }) {
  const expectedSecret = env.IMPORT_SECRET;
  if (!expectedSecret) {
    console.error('conversions/import: IMPORT_SECRET env var ยังไม่ได้ตั้งค่า');
    return json({ ok: false, error: 'Server ยังไม่ได้ตั้งค่า auth — ติดต่อผู้ดูแลระบบ' }, 500);
  }

  const providedSecret = request.headers.get('X-Import-Secret');
  if (!providedSecret || providedSecret !== expectedSecret) {
    return json({ ok: false, error: 'Unauthorized: X-Import-Secret ไม่ถูกต้องหรือไม่ได้ส่งมา' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Request body ไม่ใช่ JSON ที่ถูกต้อง' }, 400);
  }

  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows || rows.length === 0) {
    return json({ ok: false, error: 'ต้องส่ง rows เป็น array ที่มีอย่างน้อย 1 แถว เช่น { rows: [{product_id, commission, order_id, status, click_id}] }' }, 400);
  }

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
      clickId: r.click_id != null ? String(r.click_id).trim() : null,
    });
  }

  if (valid.length === 0) {
    return json({ ok: false, error: 'ไม่มีแถวไหนผ่าน validation เลย', skipped }, 400);
  }

  try {
    const stmt = env.DB.prepare(`
      INSERT INTO conversions (product_id, commission, order_id, status, click_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(order_id) DO UPDATE SET
        status = excluded.status,
        commission = excluded.commission,
        click_id = COALESCE(excluded.click_id, conversions.click_id)
    `);
    const batch = valid.map(r => stmt.bind(r.productId, r.commission, r.orderId, r.status, r.clickId));
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
