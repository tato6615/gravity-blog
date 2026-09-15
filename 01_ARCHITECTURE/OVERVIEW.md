# SYSTEM OVERVIEW — GRAVITY OS

---

## ระบบมี 2 ส่วนแยกกันสนิท

```
┌─────────────────────────────────────────────────────────┐
│  gravity-blog (Cloudflare Pages)                        │
│  gravity-blog.pages.dev                                 │
│  git push → auto-deploy                                 │
│                                                         │
│  เว็บบล็อก affiliate — อ่านอย่างเดียว                   │
│  ดึงข้อมูลจาก Grist + D1                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Worker "af" (Cloudflare Worker แยกต่างหาก)            │
│  af.pakpiromjajaja.workers.dev                          │
│  แก้ผ่าน Dashboard Quick Edit เท่านั้น — ไม่มี git     │
│                                                         │
│  Product pipeline: import → scrape → generate → publish │
└─────────────────────────────────────────────────────────┘
```

---

## Multi-Agent Architecture (GRAVITY ARS)

ระบบขับเคลื่อนด้วย **13 AI agents** ที่ทำงานอัตโนมัติผ่าน `control-agent.js` และถูก trigger ทุก 10 นาทีโดย `tick.js` (Cloudflare Cron Trigger)

### ไฟล์หลักของระบบ Agent

| ไฟล์ | หน้าที่ |
|---|---|
| `registry.js` | ลงทะเบียน agents ทั้ง 13 ตัว พร้อม metadata (ชื่อ, capability, priority) |
| `capabilities.js` | นิยาม tools/skills ที่แต่ละ agent เรียกใช้ได้ (Grist API, D1, GA4, publishers) |
| `control-agent.js` | Orchestrator กลาง: รับ tick → เลือก agent จาก registry → chain pipeline → handle error |
| `tick.js` | Entry point สำหรับ Cloudflare Cron — เรียก control-agent ทุก 10 นาที |

### 13 Agents และหน้าที่

| # | Agent | หน้าที่ |
|---|---|---|
| 1 | **Opportunity Agent** | ค้นหาโอกาส: สินค้าใหม่ใน queue, niche ที่ demand สูง, seasonal trend |
| 2 | **Audience Agent** | วิเคราะห์กลุ่มเป้าหมาย, purchase intent, pain point ที่ content ควรแก้ |
| 3 | **Offer Agent** | เลือกสินค้า, ตรวจสอบ affiliate link, ราคา, USP เทียบคู่แข่ง |
| 4 | **Content Agent** | สร้างบทความรีวิว TH+EN ครบถ้วน ตาม SEO guideline |
| 5 | **Media Agent** | rehost รูปจาก Amazon/eBay ลง Cloudflare Images, สร้าง alt text |
| 6 | **Distribution Agent** | publish ไป 6 platforms พร้อมกัน (Web, Telegram, Discord, Mastodon, Facebook, Threads) |
| 7 | **SEO Agent** | optimize title, meta description, slug, canonical, อัปเดต sitemap |
| 8 | **Analytics Agent** | sync GA4 views → Grist, sync D1 clicks → Grist, สรุป performance report |
| 9 | **Market Agent** | monitor queue สินค้าใหม่จาก Worker "af", จัดลำดับความสำคัญ |
| 10 | **Quality Agent** | ตรวจ content ก่อน publish: broken link, image load, grammar, completeness |
| 11 | **Engagement Agent** | ติดตาม comment/reply บน platforms, flag งานที่ต้อง response |
| 12 | **Revenue Agent** | track affiliate click → conversion → commission per product |
| 13 | **Control Agent** | Orchestrator กลาง (ดูด้านบน) — ไม่ทำงานโดยตรง แต่ขับเคลื่อน agents ทั้งหมด |

### Pipeline Chain

งานทุกชิ้นไหลผ่าน pipeline ตามลำดับนี้:

```
[tick.js ทุก 10 นาที]
        ↓
[control-agent.js]
        ↓
Opportunity → Audience → Offer
                              ↓
                          Content → Media → Distribution
                                                   ↓
                                            [เผยแพร่ครบ 6 platforms]
```

agents ที่รันอยู่ด้านข้าง (ไม่ได้อยู่ใน chain หลัก):
- **Analytics, SEO, Market** — รันแบบ parallel ตาม schedule ของตัวเอง
- **Quality** — รันก่อน Distribution เสมอ (gate)
- **Engagement, Revenue** — รันหลัง Distribution เพื่อ monitor ผลลัพธ์

---

## Data Flow — gravity-blog

```
User เข้าเว็บ
    ↓
Cloudflare Pages (CDN)
    ↓
functions/index.js (หรือ route อื่น)
    ↓
_lib/grist.js → Grist API → PRODUCTS / CONTENT table
    ↓
Render HTML → ส่งกลับ user
    ↓
User คลิก affiliate link
    ↓
/go/:id → log ลง D1 (clicks table) + ยิง GA4 event
    ↓
Response.redirect(302) → Amazon / eBay
```

---

## Data Stores

| Store | ใช้กับ | ตารางหลัก |
|---|---|---|
| **Grist** | ข้อมูลสินค้า/บทความ (source of truth) | PRODUCTS, CONTENT, AI_ANALYTICS |
| **D1** (`gravity_affiliate`) | Tracking + Community | clicks, conversions, email_subscribers, community_platforms |
| **GA4** | Analytics (อ่านอย่างเดียว ดึงมา sync ลง Grist) | — |

---

## URL Structure

| URL | ไฟล์ | หมายเหตุ |
|---|---|---|
| `/` | `functions/index.js` | Homepage TH |
| `/en` | `functions/en/index.js` | Homepage EN |
| `/community` | `functions/community.js` | Community Hub |
| `/product/:slug` | `functions/product/[slug].js` | บทความ TH |
| `/en/product/:slug` | `functions/en/product/[slug].js` | บทความ EN |
| `/go/:id` | `functions/go/[id].js` | Affiliate redirect |
| `/api/stats` | `functions/api/stats.js` | Analytics API |
| `/api/community-platforms` | `functions/api/community-platforms.js` | Community platform list |

---

## Automated Jobs

| Job | Frequency | ไฟล์ |
|---|---|---|
| Agent pipeline (control-agent) | ทุก 10 นาที | `tick.js` → `control-agent.js` |
| ตรวจ product links | Hourly | `fix-content-product-links.js` |
| Sync D1 → Grist | ทุก 30 นาที | `sync-analytics-to-grist.js` |
| Sync GA4 → Grist | Manual | `sync-ga4-views-to-grist.js` |
