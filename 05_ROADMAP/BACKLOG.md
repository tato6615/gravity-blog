# GRAVITY — Attention → Behavior → Conversion → Loop Backlog

> เพิ่มเข้า BACKLOG.md หลักของ repo — จัดลำดับตาม priority จริง (ไม่ใช่ตาม level)
> เพราะ Loop จะปิดไม่ได้ถ้าไม่มี variant + event tracking ก่อน

หลักคิด: `Attention ≠ Traffic`. เป้าหมายคือจับ **attention ของคนที่มี intent**
แล้วป้อนกลับเข้า pipeline ให้ AI เขียนคอนเทนต์แม่นขึ้นเรื่อยๆ แบบไม่ต้องมีคน
compile insight เอง

วงจรเป้าหมาย:
```
ATTENTION → BEHAVIOR → DATA → INSIGHT → EXPERIMENT → BETTER ATTENTION → ...
```

---

## 🔴 P0 — ต้องทำก่อน (ไม่งั้น loop ปิดไม่ได้เลย)

### ✅ P0.1 — Content/Hook Variants — DONE (verified 2026-09-16)
- [x] เพิ่มคอลัมน์ `variant_id`, `variant_label` ในตาราง `content` และ `social` (D1 migration) — cid 20-21
- [x] แก้ `content-agent.js` ให้ `generateHookVariants()` สร้าง headline 4 แบบ/สินค้า แล้ว INSERT 1 แถวต่อ 1 variant (specificity / problem_first / audience_curiosity / value_anchor)
- [x] แก้ `offer-agent.js` — idempotency guard + update `pipeline_status = 'matched'` กัน duplicate content บั๊ก
- [x] `distribute.js` แก้ให้เลือก hook variant แยกจาก link ปลายทาง — ยืนยันโพสต์ขึ้น Facebook จริง
- [x] End-to-end verified: product 248 มี 4 variant rows (id 519-522) พร้อม `variant_id` ครบ

**หมายเหตุ**:
- SOCIAL table ยังไม่มี agent generate ข้อความแยกตาม variant จริง — `distribute.js` fallback ไปแถวแรกเสมอ (ค้างไว้ทำทีหลัง)
- ล้างข้อมูลทดสอบ: `UPDATE products SET pipeline_status = 'enriched' WHERE id = 248;`

### ✅ P0.2 — Attention Events Table — DONE (verified 2026-09-16)
- [x] สร้างตาราง `attention_events` ใน D1 พร้อม index บน `product_id` และ `session_id`
- [x] สร้าง endpoint `functions/api/track-event.js` — รับ event จาก client, validate, กรอง bot, INSERT ลง D1
- [x] แก้ `functions/_lib/article.js` — ฝัง inline attention tracker script แทน `/api/track` เดิม
      - track: view, scroll_25/50/75/100, click (affiliate link + buy-btn), exit (visibilitychange + pagehide)
      - detect channel จาก `utm_source` อัตโนมัติ
      - `data-section` attribute บน review, buying_guide, faq, cta
- [x] สร้าง `functions/_lib/attention-tracker.js` (external script สำรอง)
- [x] End-to-end verified: `curl POST /api/track-event` → `{"ok":true}` → event เข้า D1 ถูกต้อง

**หมายเหตุ**:
- session_id เป็น in-memory เท่านั้น (ไม่ใช้ localStorage/cookie) — ไม่ track ข้าม visit
- bot filter ใช้ regex เดียวกับ `/go/[id].js`
- `variant_id` ใน event มาจาก `article.variantId` — ต้องเช็คว่า `d1-articles.js` return field นี้มาด้วยไหม

### P0.3 — Quality Score ↔ Conversion Reality Check
- [ ] Query join `content.quality_score` / `quality_tier` กับ conversion จริงจาก `ai_analytics`
- [ ] ทำเป็น scheduled report (รายสัปดาห์) เทียบว่า AI ประเมินคุณภาพตัวเองแม่นแค่ไหน
- **Why first**: ข้อมูลมีอยู่แล้ว ไม่ต้องรอ infra ใหม่ ได้ insight เร็วที่สุด

---

## 🟠 P1 — ทำถัดมา (ใช้ข้อมูลจาก P0)

### P1.1 — Funnel Dashboard (Level 2: Behavior)
- [ ] ต่อ `attention_events` เป็น funnel: `view → scroll_50 → scroll_100 → click → conversion`
- [ ] แสดง drop-off % ต่อขั้น, แยกตาม `channel` และ `variant_id`
- [ ] แยก drop-off ตาม `section` — รู้ว่าคอนเทนต์ส่วนไหน (review/comparison/FAQ) ดึงคนไม่อยู่

### P1.2 — Auto-flag ระบบ
- [ ] Cron job เช็ค: variant/quality_tier ที่ conversion ต่ำต่อเนื่อง เกิน N วัน
- [ ] ส่ง flag เข้า System Health หรือ webhook แจ้งเตือน
- [ ] หยุดใช้ pattern ที่แพ้ซ้ำๆ ในการ generate content รอบใหม่โดยอัตโนมัติ

### P1.3 — Cross-reference Dashboard
- [ ] ตาราง: category/market ↔ conversion rate
- [ ] ตาราง: channel ↔ conversion rate
- [ ] ตาราง: quality_score bucket ↔ conversion rate

---

## 🟡 P2 — ทำเมื่อมีปริมาณข้อมูลพอ

### P2.1 — Return Behavior / Retention (Level 4: Loop เต็มรูป)
- [ ] Session ID แบบ anonymous คงอยู่ข้าม visit
- [ ] Return rate ภายใน 7/30 วัน
- [ ] Cross-product path

### P2.2 — Experimentation Framework (Level 8)
- [ ] Hypothesis log
- [ ] A/B compare ผลก่อน-หลังเปลี่ยน
- [ ] Insight digest รายสัปดาห์ ป้อนกลับเข้า prompt

---

## 📌 Dashboard: หน้าใหม่ "Attention"

1. **Attention** — Attention Rate, Avg. Scroll Depth, Bounce Rate *(P0.2 พร้อมแล้ว)*
2. **ทำไมคนหยุด** — Funnel + Drop-off by section/channel *(รอ P1.1)*
3. **Conversion** — quality_score/category/channel ↔ conversion *(P1.3)*
4. **Loop** — Auto-flag list + hypothesis log *(รอ P1.2 / P2.2)*

---

## ✅ Progress Log — 2026-09-16

### เสร็จแล้ว
- **Security fix**: ลบ endpoint `/api/click` (open-redirect vulnerability). Commit `8d289be`.
- **Root cause conversion=0**: ตั้งค่า `IMPORT_SECRET` + ยืนยัน `/api/conversions/import` ทำงาน.
- **Per-click subtag tracking**: เพิ่ม `click_id` ใน `clicks`/`conversions`, `affiliate-tracking.js`, แก้ `/go/[id].js`. Commit `f62171d`.
- **P0.1 Hook Variants**: verified — product 248 มี 4 variant rows. Deploy #490.
- **P0.2 Attention Events**: verified — `track-event` endpoint ทำงาน, event เข้า D1 ถูกต้อง. Commit `b019cc6`.

### ค้างอยู่
- [ ] Import conversion จาก Amazon Associates — ออกแบบ ASIN → `product_id` mapping
- [ ] เช็ค Amazon Associates report มีคอลัมน์ `ascsubtag` ไหม
- [ ] SOCIAL variant generation (distribute.js fallback อยู่)
- [ ] สินค้า 234, 235, 238, 239 — pipeline ยังไม่ครอบคลุม
- [ ] ล้างข้อมูลทดสอบ: `UPDATE products SET pipeline_status = 'enriched' WHERE id = 248;`
- [ ] เช็คว่า `d1-articles.js` return `variantId` มาด้วยไหม (ถ้าไม่มี attention_events จะได้ `variant_id = null` เสมอ)