# BUG-006 — สินค้าซ้ำใน Worker "af" — Check-then-Insert Race Condition

**วันที่พบ:** 2026-09 (ไม่ระบุวันแน่ชัด ก่อน 2026-09-15)
**วันที่แก้ + deploy + verify:** 2026-09-15
**สถานะ:** ✅ แก้แล้ว + deploy แล้ว + ทดสอบผ่านจริง (ปิดเคส)
**ระบบที่เกี่ยวข้อง:** Worker "af" (`https://af.pakpiromjajaja.workers.dev`) — **ไม่ใช่ repo gravity-blog** ดู `02_SYSTEMS/WORKER_AF.md`
**ไฟล์ที่แก้:** `db.js`, `import.js` (deploy ผ่าน Cloudflare Dashboard Quick Edit — ไม่มี git สำหรับ Worker af)

---

## อาการ

Import สินค้าจาก URL เดียวกัน แล้วเกิดแถวซ้ำ 2 แถวใน D1 table `products` (พบครั้งแรกที่ id 277/278 แล้วตรวจเจอเพิ่มอีกหลายกลุ่ม)

## ต้นตอ

`handleImport()` เดิมทำ dedup แบบ "check-then-insert" ที่ไม่ atomic:
1. เช็คว่ามี URL นี้อยู่แล้วหรือยัง (query)
2. scrape + AI + rehost รูป (กินเวลาหลักสิบวินาที)
3. insert จริง

ถ้ามี 2 request เข้ามาใกล้กัน (user กดปุ่ม import ซ้ำ / frontend retry) ทั้งคู่เช็คตอนที่อีกฝั่งยัง insert ไม่เสร็จ → insert ซ้ำ 2 แถว

ยืนยันจาก `ai_analysis.generated_at` ของ id 277/278 ห่างกันแค่ ~29 วินาที — ตรงกับ race condition ไม่ใช่เหตุการณ์แยกกัน ไม่ใช่บั๊กที่ `normalizeUrl()` (ฟังก์ชันนั้นถูกต้องมาตลอด)

## วิธีแก้ (Pattern มาตรฐาน — atomic insert แทน check-then-insert)

1. เพิ่มคอลัมน์ `normalized_source_url` ใน `products` (migration `002_add_normalized_source_url.sql`)
2. สร้าง `createProductIfNotExists()` ใน `db.js` — insert แบบ atomic โดยพึ่ง UNIQUE constraint แทนการเช็คด้วย JS ก่อน
3. ลบ early dedup check (fetchTableRecords + .find) ออกจาก `import.js` — ย้ายไปใช้ `createProductIfNotExists()` ตอน insert จริงแทน
4. Cleanup ข้อมูลซ้ำเก่าที่ค้างอยู่ก่อน migration (พบ 3 กลุ่ม A/B/C รวม duplicate id 16, 195, 196, 197 — ดูรายละเอียดขั้นตอนแบบเต็มใน chat log เดิม ถ้าต้องอ้างอิงซ้ำ)
5. สร้าง UNIQUE INDEX:
   ```sql
   CREATE UNIQUE INDEX idx_products_normalized_source_url
   ON products(normalized_source_url)
   WHERE normalized_source_url IS NOT NULL AND normalized_source_url != '';
   ```

## ผลทดสอบหลังแก้ (2026-09-15)

- Import จริงผ่าน HTTP: URL Amazon จริง (`B07S1BZT9J`, Dogline dog leash) → `200 OK`, `productId: 280`, `duplicate: false`
- ยิง URL เดิมซ้ำ 3 ครั้งติดกัน → ทุกครั้ง `200 OK` เหมือนกันหมด, pipeline รันเต็มทุกรอบ (ตามคาด — เป็น correctness fix ไม่ใช่ cost-avoidance)
- เช็ค D1: `SELECT COUNT(*) FROM products WHERE normalized_source_url LIKE '%B07S1BZT9J%'` → **= 1** ยืนยันไม่มีแถวซ้ำแม้ยิงซ้ำหลายครั้ง

## งานที่เหลือ (ไม่ใช่ priority)

- พิจารณาเพิ่ม best-effort early-check แบบ non-blocking เพื่อลด compute ที่เสียไปตอน "แพ้ race" (scrape/AI/rehost ซ้ำโดยเปล่าประโยชน์) — correctness ปลอดภัยแล้วด้วย UNIQUE constraint ไม่ใช่เรื่องด่วน

## หมายเหตุเครื่องมือทดสอบ (กันงงรอบหน้า)

- ReqBin / Cloudflare Worker HTTP tester รับ **JSON ดิบเท่านั้น** ห้ามใส่โค้ด JS
- Body field ของ `/api/import` คือ **`input`** ไม่ใช่ `url`
- ยิง parallel request จริงต้องใช้ browser JS console เท่านั้น (ReqBin ยิงได้ทีละคำขอ)
- Safari บน iPad ไม่มี dev console ในตัว

## กฎที่ได้จากบั๊กนี้

**Pattern ใหม่ที่ควรเพิ่มใน `08_DEVELOPMENT_RULES/RULES.md`:** ห้ามทำ dedup แบบ "check-then-insert" ที่มีช่องว่างเวลาระหว่าง check กับ insert (โดยเฉพาะถ้าระหว่างนั้นมี network call เช่น scrape/AI) — ให้พึ่ง DB constraint (UNIQUE index) เป็นแหล่งความจริงเสมอ แล้ว insert แบบ atomic
