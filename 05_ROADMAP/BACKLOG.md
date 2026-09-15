# BACKLOG — งานที่ต้องทำ
**อัปเดตล่าสุด:** 2026-09-15

---

## 🟡 ควรทำเร็ว (ภายในสัปดาห์นี้)

### [FEAT-001] Community Hub — CRUD form ใน admin.html
เป็นขั้นสุดท้ายของ Community Hub feature
- [ ] ช่องกรอก emoji/ชื่อ/ลิงก์/cta ต่อ platform
- [ ] ปุ่ม "ลบ" ต่อแถว
- [ ] ปุ่ม "➕ เพิ่ม platform ใหม่"
- [ ] ปุ่ม "💾 บันทึกทั้งหมด" → POST `/api/community-platforms`
- [ ] โหลด platform list จาก GET `/api/community-platforms` ตอนเปิด admin

### [CLEAN-001] ลบ debug endpoint ที่ค้างอยู่
- [ ] `functions/api/debug-tumblr-env.js` — ควรลบทิ้ง
- [ ] `functions/api/debug-env.js` — ถ้ายังมีอยู่
---

## 🟢 ปกติ (ทำได้เรื่อยๆ)

### [FEAT-002] Tumblr Integration
ใช้ pattern เดียวกับ Discord (`functions/api/send-discord.js`)
ต้องการ 5 keys: Consumer Key/Secret, OAuth Token/Secret, Blog ID
ดู: `15_INTEGRATIONS/THIRD_PARTY.md`

### [FEAT-003] buy_url Audit ทุก Product ใน Grist
เช็คว่ามีสินค้าตัวไหนที่ affiliate_link พัง/ว่าง/ขาด https:// ซ่อนอยู่อีกไหม
```bash
curl -s -H "Authorization: Bearer $GRIST_API_KEY" \
  "https://docs.getgrist.com/api/docs/$GRIST_DOC_ID/tables/PRODUCTS/records" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
for r in data['records']:
  url = r['fields'].get('affiliate_link', '')
  if not url or not url.startswith('http'):
    print(f\"ID {r['id']}: '{url}'\")
"
```

### [REFACTOR-001] Standardize Publisher Structure
- Telegram อยู่ใน `_lib/publishers/telegram.js`
- Discord/Mastodon อยู่ใน `api/send-*.js`
- ควรรวมให้เป็นมาตรฐานเดียวกัน

### [TEST-001] ทดสอบ Worker "af" กับ URL สินค้าจริง
ดูรายละเอียด: `02_SYSTEMS/WORKER_AF.md`

---

## 🤖 Agent System — งานค้าง (ยืนยันจาก tick.js)

### [AGENT-001] Full Priority Scoring ข้าม 13 Agents
ระบบ tick.js ปัจจุบัน schedule agents แบบ round-robin หรือ fixed order — ยังไม่มี priority scoring แบบ dynamic ที่เปรียบเทียบ urgency/value ข้าม agents ทั้ง 13 ตัวพร้อมกัน
- [ ] ออกแบบ scoring model: urgency × value × cost ต่อ agent
- [ ] implement ใน `control-agent.js` หรือ `tick.js` ให้ agent ที่ score สูงสุดรันก่อน
- [ ] ทดสอบว่า pipeline chain ยังได้ลำดับถูกต้อง (opportunity→audience→offer→content→media→distribution)

### [AGENT-002] Real-time Event / Webhook Response
tick.js รันทุก 10 นาที — ทำให้ระบบตอบสนองต่อ external event ได้ช้าสูงสุด 10 นาที
- [ ] เพิ่ม webhook endpoint ที่ trigger `control-agent.js` ทันทีเมื่อมี event เข้า (เช่น สินค้าใหม่จาก Worker "af", Discord mention, Telegram command)
- [ ] กำหนด event types และ routing ว่า event ไหน wake agent ตัวไหน
- [ ] ทำให้ tick.js และ webhook coexist ได้โดยไม่ race กัน

### [AGENT-003] Market Agent Self-Refill เมื่อ Worker "af" หยุดรัน
Market Agent อาศัย Worker "af" ส่งสินค้าใหม่เข้ามา — ถ้า Worker "af" หยุด queue จะแห้ง และ agent pipeline ทั้งหมดจะ idle โดยไม่มี signal ชัดเจน
- [ ] เพิ่ม health check ใน Market Agent: ถ้าไม่มีสินค้าใหม่เกิน X นาที → alert หรือ self-trigger fallback
- [ ] พิจารณา fallback source (เช่น re-queue สินค้าเก่าที่ยังไม่ได้ distribute ครบ platform)
- [ ] เพิ่ม metric ใน System Health dashboard: "Worker af last activity"

---

## ✅ เสร็จแล้ว — ดูที่ `05_ROADMAP/DONE.md`
