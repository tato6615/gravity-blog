## 🤖 Agent System — งานค้าง (ยืนยันจาก tick.js)
### [AGENT-003] Market Agent Self-Refill เมื่อ Worker "af" หยุดรัน
Market Agent อาศัย Worker "af" ส่งสินค้าใหม่เข้ามา — ถ้า Worker "af" หยุด queue จะแห้ง และ agent pipeline ทั้งหมดจะ idle โดยไม่มี signal ชัดเจน
- [ ] เพิ่ม health check ใน Market Agent: ถ้าไม่มีสินค้าใหม่เกิน X นาที → alert หรือ self-trigger fallback
- [ ] พิจารณา fallback source (เช่น re-queue สินค้าเก่าที่ยังไม่ได้ distribute ครบ platform)
- [ ] เพิ่ม metric ใน System Health dashboard: "Worker af last activity"
