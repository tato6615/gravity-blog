# VISION — GRAVITY OS

## คืออะไร

GRAVITY OS คือระบบ affiliate content platform อัตโนมัติ — นำสินค้าจาก Amazon/eBay มาสร้างบทความรีวิวภาษาไทย/อังกฤษ ส่งออกไป 6 platforms พร้อมกัน และ track conversion ครบวงจร

ระบบขับเคลื่อนด้วย **13 AI agents** ที่ทำงานอัตโนมัติตลอด 24 ชั่วโมง ไม่ใช่แค่ pipeline URL→บทความ→publish แบบตรงเส้นอีกต่อไป

## Business Model

```
นำเข้า URL สินค้า
    ↓ Worker "af" pipeline
สร้างบทความ (TH + EN)
    ↓
เผยแพร่บนเว็บ + 6 social platforms
    ↓
ผู้ใช้คลิก affiliate link → redirect ไป Amazon/eBay
    ↓
ได้ commission จาก Amazon Associates / eBay Partner
```

## 6 Platforms

1. 🌐 Website (`gravity-blog.pages.dev`)
2. 📱 Telegram
3. 💬 Discord
4. 🦣 Mastodon
5. 📘 Facebook
6. 💬 Threads
7. 🎨 Tumblr (⏳ ยังไม่เสร็จ)

## ระบบ Multi-Agent (GRAVITY ARS)

GRAVITY OS ไม่ได้รันเป็น script เดี่ยว — ระบบใช้ **13 AI agents** ที่แต่ละตัวรับผิดชอบงานเฉพาะทาง ทำงานประสานกันผ่าน `control-agent.js` และถูก trigger อัตโนมัติทุก 10 นาทีโดย `tick.js` (Cloudflare Cron)

### Pipeline Chain

```
Opportunity Agent → Audience Agent → Offer Agent
    → Content Agent → Media Agent → Distribution Agent
```

แต่ละ agent อ่านสถานะจาก registry, รับงานจาก control-agent, และส่งต่อผลลัพธ์ให้ agent ถัดไปในสาย

### 13 Agents

| # | Agent | หน้าที่ |
|---|---|---|
| 1 | **Opportunity Agent** | ค้นหาโอกาส: สินค้าใหม่, niche ที่ demand สูง |
| 2 | **Audience Agent** | วิเคราะห์กลุ่มเป้าหมาย, intent, pain point |
| 3 | **Offer Agent** | เลือกสินค้า, affiliate link, ราคา, USP |
| 4 | **Content Agent** | สร้างบทความ TH+EN ครบถ้วน |
| 5 | **Media Agent** | จัดการรูปภาพ, rehost, alt text |
| 6 | **Distribution Agent** | publish ไป 6 platforms พร้อมกัน |
| 7 | **SEO Agent** | optimize title, meta, slug, sitemap |
| 8 | **Analytics Agent** | ดึง GA4, sync ลง Grist, สรุป performance |
| 9 | **Market Agent** | monitor สินค้าใหม่จาก Worker "af", manage queue |
| 10 | **Quality Agent** | ตรวจ content ก่อน publish: link, grammar, image |
| 11 | **Engagement Agent** | ติดตาม comment/reply บน platforms |
| 12 | **Revenue Agent** | track click → conversion → commission |
| 13 | **Control Agent** | orchestrator กลาง: รับ tick, เลือก agent, chain pipeline |

### โครงสร้างไฟล์หลัก

```
registry.js       — ลงทะเบียน agents ทั้ง 13 ตัว + capabilities
capabilities.js   — นิยาม skill/tool ที่แต่ละ agent ใช้ได้
control-agent.js  — orchestrator: รับ task → routing → chain
tick.js           — Cron entry point ทุก 10 นาที
```

ดูรายละเอียดสถาปัตยกรรมเต็มได้ที่ `01_ARCHITECTURE/OVERVIEW.md`

## เป้าหมายระยะยาว

- Fully automated pipeline: URL เข้า → content ออก → publish ทุก platform
- Real-time analytics: click → conversion → revenue tracking
- Community: 11,480+ members across 6 platforms
- Agent self-improvement: agents ปรับ strategy ตาม performance data อัตโนมัติ