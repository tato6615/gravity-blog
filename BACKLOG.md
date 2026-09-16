
---

## ✅ Progress Log — 2026-09-16 (ต่อ 2) — ปิดรูรั่ว schema.org bypass tracking

### สรุปปัญหาที่พบ
สืบจาก conversion=0 ยืนยันแล้ว → พบว่า Amazon รายงาน 2,894 คลิก/30 วัน แต่คลิกจริงที่ระบบเราวัดได้หลังกรอง bot มีแค่ 243 คลิก (ต่างกันเกือบ 12 เท่า) ไล่หาสาเหตุจนพบว่า:

- ปุ่ม "ซื้อ" หลักในบทความ (`buy-btn`, `article.js:137`) **ปลอดภัยอยู่แล้ว** — ใช้ `trackedBuyUrl` ผ่าน `/go/{id}` ถูกต้องตั้งแต่ต้น
- **รูรั่วจริงอยู่ที่ JSON-LD structured data** (`layout.js` ฟังก์ชัน `generateProductJsonLd`) — `schema.offers.url` เคยใช้ `article.product.buyUrl` (raw affiliate_link เช่น `amzn.to/xxx`) ตรงๆ โดยไม่ผ่าน tracking เลย ทำให้ search/social crawler (Googlebot, Applebot, Facebook's meta-externalagent ฯลฯ) ที่ parse schema สามารถแตะ affiliate link ตรงได้โดยไม่ผ่าน `/go/[id].js` — อธิบายได้ว่าทำไม bot user-agent เหล่านี้ถึงมี footprint สูงมากใน `clicks` table (Applebot 271, meta-externalagent 420+ ครั้ง/30 วัน)

### แก้ไขแล้ว (commit c4d7160, 7163f1b)
- [x] `functions/_lib/article.js` — เพิ่ม `article.product.trackedBuyUrl = trackedBuyUrl;` ให้ layout.js เข้าถึงค่าที่ track แล้วได้
- [x] `functions/_lib/layout.js` — `schema.offers.url` เปลี่ยนจาก `sanitizeUrl(article.product.buyUrl)` เป็น `sanitizeUrl(toAbsoluteUrl(article.product.trackedBuyUrl) || article.product.buyUrl)`
  - เจอบั๊กรอบสอง: `sanitizeUrl()` ใช้ `new URL()` แบบไม่มี base เลย relative path (`/go/34?...`) throw error แล้ว fallback ไปใช้ canonical url ของหน้าเว็บเอง (ไม่ใช่ amzn.to แต่ก็ไม่ใช่ tracked link เหมือนกัน) — แก้ด้วย `toAbsoluteUrl()` ที่มีอยู่แล้วในไฟล์ (ใช้ `SITE_URL` เป็น base)
- [x] ทดสอบ end-to-end บน product id=34 (`cat-recovery-suit`) สำเร็จ: `offers.url` เปลี่ยนเป็น `https://gravity-blog.pages.dev/go/34` ถูกต้อง

### ค้างอยู่ / ขั้นต่อไป
- [ ] **รอดูผลจริง 3-7 วัน**: เช็คว่า gap ระหว่าง Amazon click count กับ real clicks ในระบบเราแคบลงหลัง fix นี้ deploy ครบทุกหน้าหรือไม่ (baseline ก่อนแก้: 2,894 vs 243)
- [ ] **Batch-check affiliate_link tag ทั้งหมด**: มีสคริปต์ `check-affiliate-tags.js` (เช็คว่า short link amzn.to แต่ละตัว resolve ไปเจอ `tag=gravityos-20` จริงไหม) เขียนไว้แล้วแต่ยังไม่ได้รันกับข้อมูลจริงทั้ง 228 รายการ — query แรกที่ query ตรงๆ จากตัวหนังสือ short link (ไม่ resolve) ให้ false positive สูง (211/228 "ไม่มี tag") ต้องรันสคริปต์ resolve จริงถึงจะเชื่อถือได้
- [ ] เช็คว่ามีจุดอื่นในโค้ดที่ยังใช้ `article.product.buyUrl` ตรงๆ (raw, ไม่ผ่าน tracked) หลงเหลืออยู่ไหม (grep `buyUrl` แล้ว cross-check ทุกจุดที่ output เป็น HTML/JSON ที่ external system อ่านได้)

### บั๊กใหม่ที่เจอระหว่างทาง (ยังไม่แก้ ให้บันทึกไว้ก่อน)
- [ ] **Content ซ้ำซ้อนต่อสินค้าเดียว**: พบว่า product id=2 (Insta360 X5), id=34 (Cat Recovery Suit), id=35 (STMK Cat Birthday) แต่ละตัวมีหลายแถวใน `content` table (บางตัวถึง 7 แถว) พร้อม slug ต่างกัน (บางอันซ้ำ slug เดิม บางอันคนละ slug เช่น `insta360-x5-review`, `san-pham-khao-khwam-d`, `ebay-product-review`) — ต้องหา root cause ว่า content generation pipeline รันซ้ำทำไม และตัดสินใจว่าจะเก็บ/ลบแถวไหน
- [ ] **`pipeline_status` มีค่าหลากหลายที่ควร map ให้ชัด**: `enriched`, `published`, `imported`, `enriching`, `blocked_low_quality`, `skipped_market_not_approved`, `<null>` — พบว่า id=2 (Insta360 X5) ค้างอยู่ที่ `enriched` ไม่เคยขยับไป `published` ทั้งที่มี content ครบแล้ว ควรเช็คว่ามีสินค้าตัวอื่นค้างสถานะแบบนี้อีกเท่าไหร่ (potential lost revenue — สินค้าพร้อมขายแต่ไม่เคยขึ้นเว็บจริง)

## ✅ Progress Log — 2026-09-16 (แก้บั๊ก Offer Agent duplicate เสร็จแล้ว)

### เสร็จแล้ว
- **[FIXED] Offer Agent match สินค้าซ้ำไม่หยุด** — แก้ root cause แล้ว: เดิมโค้ดไม่เคยอัปเดต `pipeline_status` ของสินค้าหลัง match สำเร็จ ทำให้สินค้าตัวเดิม (เช่น 269, 294) ถูกเลือกเป็น top candidate ซ้ำไปเรื่อยๆ ทุกครั้งที่มี opportunity ใหม่เข้ามาในหมวดเดียวกัน
- แก้ไข `functions/_lib/agents/handlers/offer-agent.js` — 2 ชั้น:
  1. หลัง match สำเร็จ `UPDATE products SET pipeline_status = 'matched'` ทันที เพื่อดึงออกจาก backlog query รอบถัดไป
  2. เพิ่ม idempotency guard — เช็คตาราง `content` ก่อนเลือก candidate ทุกครั้ง ข้ามสินค้าที่มี content อยู่แล้ว
- ยืนยันผ่าน `node --check` ว่า syntax ถูกต้อง
- Manual update `pipeline_status = 'matched'` ให้สินค้า 269, 294 ที่ค้างอยู่ (กันโดน match ซ้ำอีกรอบก่อนโค้ดใหม่ deploy)
- Commit `180612e`: "fix: offer-agent duplicate content bug - update pipeline_status after match + idempotency guard"
- Push ขึ้น `main` สำเร็จ (`ac25ec5..180612e`)

### สิ่งที่ต้องเช็คต่อ (เพิ่งแก้ ยังไม่ผ่านการทดสอบ production จริง)
- [ ] เช็คว่า `pipeline_status = 'matched'` ไม่ทำให้สินค้าหายจาก dashboard/query อื่นๆ ที่อาจ hardcode รายชื่อ status ไว้ (เช็คแล้วเบื้องต้นจาก `grep -rn "pipeline_status"` — ไม่พบจุดที่ต้องแก้เพิ่ม แต่ควร monitor หลัง deploy จริง)
- [ ] ดู Workflow run ว่า deploy ผ่านหรือไม่
- [ ] Monitor สินค้าอื่นๆ ในหมวดเดียวกับ 269/294 อีกสักพัก ว่า pipeline ทำงานปกติ ไม่มี match ซ้ำเกิดขึ้นอีก

### การตัดสินใจ (อัปเดต)
- ✅ **ปลดล็อก P0.1 (hook variants) แล้ว** — บั๊ก Offer Agent duplicate ถูกแก้เรียบร้อย ไม่ต้องพักไว้ก่อนแล้ว
- 🔜 ขั้นต่อไป: เริ่ม P0.1 — เช็คว่า AI สร้าง hook/headline กี่แบบต่อสินค้าตอนนี้ ตามคำถามเดิมใน backlog
