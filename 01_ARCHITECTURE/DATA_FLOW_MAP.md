# GRAVITY — Data Flow Map (Living Doc)
> อัปเดตทุกครั้งที่เจอไฟล์จริง/ไฟล์ตายใหม่ — กันไม่ให้ต้อง grep หาซ้ำ

## Tracking (clicks / views / conversions)

| เรื่อง | ไฟล์จริงที่ใช้งาน | สถานะ |
|---|---|---|
| Affiliate click redirect | `functions/go/[id].js` | ✅ ใช้งานจริง — filter bot, insert `clicks`, ยิง GA4 |
| Internal event tracker (view+click) | `functions/api/track.js` | ⚠️ เขียนไว้แล้ว รองรับ event_type view/click แต่**ยังไม่มีใครเรียก** |
| ~~functions/api/click.js~~ | — | ❌ DEAD — GET-only, ไม่กรอง bot, ไม่มีใครเรียกจริง |
| Conversion import | `functions/api/conversions/import.js` | ✅ insert เข้า `conversions` |
| Stats/Analytics dashboard data | `functions/api/stats.js` | ✅ query `clicks` + `conversions` (ไม่ใช่ `ai_analytics`!) |

## D1 Tables ที่เกี่ยวกับ Attention/Behavior

| ตาราง | Schema (คอลัมน์หลัก) | เขียนจากไฟล์ไหน |
|---|---|---|
| `clicks` | `product_id, timestamp, referrer, utm_source, utm_medium, user_agent, ip, event_type` | `go/[id].js` (event_type='click'), `track.js` (view/click) |
| `conversions` | `product_id, commission, order_id, status, timestamp` | `conversions/import.js` |
| `ai_analytics` | `product, views, clicks, conversions, last_updated` | ⚠️ **คนละตัวกับ `clicks`/`conversions`!** เป็นตัวนับสะสมจาก `db.js` (Worker "af" pipeline) — ไม่ใช่ event log |

⚠️ **สำคัญ**: มี "clicks/conversions" อยู่ 2 ระบบคู่ขนานที่ไม่ได้เชื่อมกัน:
1. `clicks`/`conversions` table (event-log, มี timestamp ต่อครั้ง) → ใช้โดย `stats.js` → หน้า Analytics dashboard
2. `ai_analytics` table (ตัวนับสะสม) → ใช้โดย Worker "af" `db.js` → หน้า agent-health

ก่อนเพิ่มฟีเจอร์ใหม่ (เช่น Attention tab) ต้องเลือกใช้ตัวไหนให้ชัด — Attention tab ควรใช้ระบบที่ 1 (`clicks`) เพราะมี event-level data

## หน้า Product (content ที่ publish จริง)
- Sample/dev only: `en/product/sample-template.html` — มี `PRODUCT_ID_HERE` ที่ไม่ถูกแทนที่ (ห้ามใช้อ้างอิง)
- ยังไม่รู้: ไฟล์ template จริงที่ generate หน้า product ทั้งหมดอยู่ที่ไหน — ต้องหาต่อ (ดู pipeline.js / publish.js flow)

## Grist vs D1 (อัปเดต 2026-09-16)
- Pipeline สินค้าใหม่ทั้งหมด → D1 (ผ่าน `db.js` shim ที่ยังใช้ชื่อฟังก์ชันเดิมจาก Grist แต่ implementation เป็น D1 จริง)
- Grist ยังใช้จริงเฉพาะ: `scripts/reddit-publish-queue.js`, `scripts/delete-broken-content-links.js` (ของเก่า/คอนเทนต์เดิม — ตั้งใจเก็บไว้)

## ตาราง Worker "af" ↔ Pages Function (คนละระบบ)
- **Worker "af"** (`af.pakpiromjajaja.workers.dev`) — import/pipeline/publish/distribute/market-discovery, มี `db.js` shim ของตัวเอง
- **Pages Functions** (`functions/api/*.js` ใน repo นี้) — stats, system-health, community, agents, track, click, conversions/import — connect D1 ตรงๆ ผ่าน `env.DB` binding ของตัวเอง (คนละ binding กับ Worker "af" หรือเปล่ายังไม่ยืนยัน — ต้องเช็ค)

---
_แก้ไฟล์นี้ทุกครั้งที่เจอ dead code ใหม่ หรือยืนยันว่าไฟล์ไหนคือของจริง จะได้ไม่ต้อง grep ซ้ำอีก_
