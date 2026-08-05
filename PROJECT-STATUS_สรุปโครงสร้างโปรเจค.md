
### 2026-08-05 (05:47) — ✅ Phase 5 (Email) เดินหน้าต่อ: Mailchimp keys + D1 table + แก้ query
- เช็ค Mailchimp API keys ผ่าน Account → Extras → API keys พบว่าค่าที่มีไว้แต่แรก 2 ตัวสับสนกัน: ตัวที่คิดว่าเป็น "server" จริงๆ คือ Mobile SDK Client key (คนละหมวด ใช้กับ Mailchimp API ไม่ได้) — ค่าที่ถูกต้องคือ API key ตัวเดียวที่มีจริง (`297f...us7`) + server prefix คือ `us7` (ท้าย API key เอง) — **คีย์เก่าเคยหลุดเป็น plain text ในแชท แนะนำ revoke แล้วสร้างใหม่ก่อนตั้งเป็น secret จริง (ยังไม่ยืนยันว่าทำแล้วหรือยัง)**
- สร้าง D1 table `email_subscribers` สำเร็จผ่าน D1 Console (schema: id, email UNIQUE, name, subscribed_at) — ยืนยันจาก `SELECT name FROM sqlite_master` เห็นตารางใหม่ในลิสต์แล้ว
- พบว่า `handleSendNewsletter` ใน `api/email.js` เดิม query `JOIN products p` แต่ D1 ไม่มีตาราง `products` เลย (มีแต่ `clicks`, `conversions`, `email_subscribers`) — ชื่อสินค้าจริงอยู่ใน Grist `PRODUCTS` table ต่างหาก
- แก้โดยเพิ่มฟังก์ชัน `getProductNamesByIds` ใน `_lib/grist.js` (ดึงชื่อสินค้าจาก Grist ตาม id) แล้วแก้ `handleSendNewsletter` ให้เรียกใช้แทนการ join D1 — commit + push แล้ว
- **ยังไม่ได้ทำ:** (1) ตั้ง MAILCHIMP_API_KEY / MAILCHIMP_SERVER / MAILCHIMP_LIST_ID เป็น secret จริงใน Cloudflare Dashboard (2) revoke + สร้าง Mailchimp API key ใหม่ (3) ยิงทดสอบ `/api/email/subscribe` จริงหลัง deploy (4) ทดสอบ `/api/email/send-newsletter`

**กติกาถาวร (เพิ่ม 2026-08-05):** ทุกครั้งที่อัพเดทไฟล์นี้ ให้ใช้คำสั่ง `cat >> ไฟล์ << EOF ... EOF` ผ่าน terminal เท่านั้น — ห้ามพิมพ์/paste ผ่าน nano หรือ editor UI เพราะเคยทำให้ไฟล์พังมาก่อน (ดู entry 2026-08-04 เรื่อง sync-ga4-views-to-grist.js) วิธีนี้เร็วกว่าและกันสับสนได้ดีที่สุด
