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

### P0.1 — Content/Hook Variants
- [ ] เพิ่มคอลัมน์ `variant_id`, `variant_label` ในตาราง `content` และ `social` (D1 migration)
- [ ] แก้ prompt ใน content-generation step ให้ AI สร้าง **hook/headline อย่างน้อย 2-3 แบบ** ต่อสินค้า แทนที่จะเป็นแบบเดียวจบ
      (ตัวแปรที่ควรสลับ: curiosity gap / specificity / contrarian / problem-first)
- [ ] `distribute.js` สุ่มเลือก variant ต่อการโพสต์ (หรือกระจายเท่าๆ กันข้ามแพลตฟอร์ม/รอบเวลา)
- **Why first**: ไม่มี variant → ต่อให้ track ละเอียดแค่ไหนก็ไม่มีอะไรให้เทียบ

### P0.2 — Attention Events Table (D1)
- [ ] สร้างตาราง `attention_events`:
  ```sql
  CREATE TABLE attention_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    product_id INTEGER,
    variant_id TEXT,
    channel TEXT,             -- facebook/x/pinterest/website/...
    event_type TEXT NOT NULL, -- view | scroll_25 | scroll_50 | scroll_75 | scroll_100 | click | exit
    section TEXT,             -- review | comparison | faq | buying_guide | cta (nullable)
    device TEXT,              -- mobile | desktop | tablet
    ts TEXT NOT NULL
  );
  CREATE INDEX idx_attention_events_product ON attention_events(product_id);
  CREATE INDEX idx_attention_events_session ON attention_events(session_id);
  ```
- [ ] เพิ่ม endpoint `/api/track-event` (Worker) — รับ event จาก client-side script บนหน้าเว็บ
- [ ] ฝัง tracking snippet เบาๆ ในหน้า product/content page (scroll depth + time-on-page + exit)
- **Why first**: เป็นฐานของ funnel (Level 2), drop-off analysis, และ retention ทั้งหมด

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
- [ ] Cron job เช็ค: variant/quality_tier ที่ conversion ต่ำต่อเนื่อง (เช่น < X% เทียบ baseline) เกิน N วัน
- [ ] ส่ง flag เข้า System Health หรือ webhook แจ้งเตือน
- [ ] (ขั้นถัดไป) หยุดใช้ pattern ที่แพ้ซ้ำๆ ในการ generate content รอบใหม่โดยอัตโนมัติ

### P1.3 — Cross-reference Dashboard (ใช้ข้อมูลที่มีอยู่แล้ว วันนี้ทำได้เลย)
- [ ] ตาราง: category/market ↔ conversion rate
- [ ] ตาราง: channel ↔ conversion rate
- [ ] ตาราง: quality_score bucket ↔ conversion rate

---

## 🟡 P2 — ทำเมื่อมีปริมาณข้อมูลพอ

### P2.1 — Return Behavior / Retention (Level 4: Loop เต็มรูป)
- [ ] Session ID แบบ anonymous คงอยู่ข้าม visit (cookie/localStorage-free — ใช้ fingerprint เบาๆ หรือ UTM+timestamp)
- [ ] Return rate ภายใน 7/30 วัน
- [ ] Cross-product path (สินค้าไหนที่คนไปดูต่อหลังหลุดจากสินค้านี้)

### P2.2 — Experimentation Framework (Level 8)
- [ ] Hypothesis log: บันทึกทุกครั้งที่เปลี่ยน prompt/hook pattern พร้อมสมมติฐาน
- [ ] A/B compare ผลก่อน-หลังเปลี่ยน แบบมีนัยสำคัญทางสถิติขั้นต่ำ (จำนวน sample ที่พอ)
- [ ] Insight digest รายสัปดาห์ ป้อนกลับเข้า prompt ของ content generation (`buildMarketPrompt` และ content/social prompt)

---

## 📌 Dashboard: หน้าใหม่ "Attention" (บนสุด, ก่อน Analytics)

Tab ใหม่ต้องมี 4 section ตามลำดับ:

1. **Attention** — Attention Rate (clicks/views), Avg. Scroll Depth, Bounce Rate *(รอ P0.2)*
2. **ทำไมคนหยุด** — Funnel + Drop-off by section/channel *(รอ P1.1)*
3. **Conversion** — quality_score/category/channel ↔ conversion (ทำได้เลยจาก P1.3)
4. **Loop** — Auto-flag list + hypothesis log *(รอ P1.2 / P2.2)*

ดู mockup UI แนบไฟล์ `attention-dashboard-mockup.html`

---

## คำถามที่ต้องตอบก่อนเริ่ม P0.1
ตอนนี้ AI สร้าง hook/headline กี่แบบต่อสินค้า? (เช็คจาก content generation prompt ปัจจุบัน)
ถ้ายังเป็นแบบเดียว → เริ่มจาก P0.1 ก่อนอย่างอื่นทั้งหมด