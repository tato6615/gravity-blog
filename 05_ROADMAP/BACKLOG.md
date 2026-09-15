# BACKLOG — งานที่ต้องทำ
**อัปเดตล่าสุด:** 2026-09-15
## 🟢 ปกติ (ทำได้เรื่อยๆ)

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
