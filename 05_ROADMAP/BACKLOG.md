<!--
วิธีใช้ไฟล์นี้: เอาส่วนด้านล่างไปแทนที่/แทรกในตำแหน่งเดิมของ 05_ROADMAP/BACKLOG.md
ไม่ใช่ไฟล์ backlog ฉบับเต็ม — เป็น patch เฉพาะส่วนที่เปลี่ยน
-->

## แก้ไขใน P0.2 — หมายเหตุ ให้เปลี่ยนจาก:

เดิม:
```
- `variant_id` ใน event มาจาก `article.variantId` — ต้องเช็คว่า `d1-articles.js` return field นี้มาด้วยไหม
```

เป็น:
```
- ✅ FIXED & VERIFIED (2026-09-16): `d1-articles.js`'s getLiveArticles() ไม่ได้
  SELECT c.variant_id/c.variant_label และไม่ได้ return variantId/variantLabel
  ออกมาเลย ทำให้ attention_events.variant_id = null เสมอ — แก้แล้ว (commit
  8fe3546), verified บน production จริง: เปิดหน้า
  .../apollo-walker-cat-carrier-backpack-for-small-medium-cats-dog-248-value_anchor
  แล้วเห็น event id 2 (view) และ id 3 (exit) มี variant_id = "value_anchor" ถูกต้อง
```

---

## เพิ่มใหม่ใน P1.1 — หมายเหตุ (ต่อท้าย 3 checkbox เดิม)

```
**⭐ ข้อจำกัดที่เจอ (2026-09-16), ต้องแก้ก่อนถึงจะทำ conversion breakdown ตาม
variant/channel ได้จริง:**

`conversions` table (id, product_id, commission, order_id, status, timestamp,
click_id) ไม่มี session_id/variant_id เลย ส่วน `attention_events` ก็ไม่มี
click_id — แปลว่า tracker บนหน้า article (client-side) กับระบบสร้าง click_id
ใน `/go/[id].js` (server-side ตอน redirect ออก Amazon) เป็นคนละระบบที่ไม่เชื่อม
กัน ตอนนี้ join ได้แค่ระดับ product_id เท่านั้น — ได้แค่ "product นี้ขายได้กี่
ครั้ง" ไม่รู้ว่า "variant ไหน/channel ไหนที่ทำให้ขายได้"

funnel-stats.js (P1.1 endpoint) ตอนนี้ return `conversion` เป็นตัวเลขรวมต่อ
product (`is_product_level_only: true`) ไปพลางก่อน

TODO ต่อ (ทำให้ conversion แยกตาม variant ได้จริง):
- [ ] แก้ inline attention tracker (functions/_lib/article.js →
      buildAttentionTrackerScript) ให้แนบ session_id/variant_id เป็น query
      param บนลิงก์ /go/[id] ก่อนคลิกออกไป
- [ ] แก้ /go/[id].js ให้รับ query param นั้น แล้วเก็บลง `clicks` table คู่กับ
      click_id ที่มันสร้าง (ต้องขอดูไฟล์ /go/[id].js และ schema ตาราง `clicks`
      ก่อน ยังไม่เคยเห็น)
- [ ] เมื่อ clicks มี session_id/variant_id แล้ว conversions (join ผ่าน
      click_id) จะได้ variant_id ติดมาด้วยโดยอัตโนมัติ — ตอนนั้นค่อยแก้
      funnel-stats.js ให้ breakdown conversion ตาม variant/channel จริง
```