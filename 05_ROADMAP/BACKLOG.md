# BACKLOG — งานที่ต้องทำ
**อัปเดตล่าสุด:** 2026-08-14 21:11

---

## 🔴 ด่วนที่สุด — ทำทันที

### [SEC-001] Rotate Google Service Account Key
**ทำไมด่วน:** Key หลุดในแชทแล้ว ยังใช้งานได้อยู่ตอนนี้

**ขั้นตอน:**
1. ไปที่ [console.cloud.google.com](https://console.cloud.google.com)
2. IAM & Admin → Service Accounts → `ga4-views-sync@gen-lang-client-0149890375.iam.gserviceaccount.com`
3. Keys → ลบ key ID `416a0ab80a23970e745fb6dcc846292f705ea2c1`
4. สร้าง key ใหม่ → download JSON
5. อัปเดต GitHub Secret `GA4_SERVICE_ACCOUNT_KEY`

---

## 🟡 ควรทำเร็ว (ภายในสัปดาห์นี้)

### [SEC-002] ลบ/Rotate Credentials ที่หลุดเก่า
- [ ] Rotate Discord Webhook URL (หลุดในแชทก่อนหน้า)
- [ ] Revoke Cloudflare API Token เก่า (หลุดในแชท)
- [ ] Revoke Telegram Bot Token เก่า (หลุดในแชท 2 ครั้ง)

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

## ✅ เสร็จแล้ว — ดูที่ `05_ROADMAP/DONE.md`
