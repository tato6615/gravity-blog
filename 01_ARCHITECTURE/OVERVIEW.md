[OVERVIEW.md](https://github.com/user-attachments/files/31093591/OVERVIEW.md)

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
| ตรวจ product links | Hourly | `fix-content-product-links.js` |
| Sync D1 → Grist | ทุก 30 นาที | `sync-analytics-to-grist.js` |
| Sync GA4 → Grist | Manual | `sync-ga4-views-to-grist.js` |
