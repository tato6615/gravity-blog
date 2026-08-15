[FILE_STRUCTURE.md](https://github.com/user-attachments/files/31093593/FILE_STRUCTURE.md)
# FILE STRUCTURE — gravity-blog repo
**อัปเดตล่าสุด:** 2026-08-14
**Verified จาก:** `find functions -type f | sort` บน Codespaces

---

```
gravity-blog/
├── functions/
│   ├── index.js                        GET /           Homepage TH ✅ try/catch
│   ├── sitemap.xml.js                  GET /sitemap.xml
│   ├── community.js                    GET /community  Community Hub page ✅ try/catch
│   │
│   ├── go/
│   │   └── [id].js                     GET /go/:id     Affiliate redirect + click log ✅ try/catch + URL validation
│   │
│   ├── product/
│   │   └── [slug].js                   GET /product/:slug  หน้าบทความ TH ✅ try/catch
│   │
│   ├── en/
│   │   ├── index.js                    GET /en         Homepage EN ✅ try/catch
│   │   └── product/
│   │       └── [slug].js               GET /en/product/:slug  หน้าบทความ EN ✅ try/catch
│   │
│   ├── [category]/
│   │   └── [slug].js                   Route ตาม category (hardcode 8 หมวด — ไม่ได้ใช้จริง)
│   │
│   ├── api/
│   │   ├── click.js                    Log click (GET-only)
│   │   ├── track.js                    Tracking endpoint
│   │   ├── stats.js                    D1 → conversion rate/commission
│   │   ├── product-webhook.js          Shotstack API สร้างวิดีโอสินค้า
│   │   ├── shotstack-callback.js       Callback → PATCH Grist
│   │   ├── system-health.js            Health check 14 จุด
│   │   ├── community-platforms.js      GET/POST platform list จาก D1 🆕
│   │   ├── send-discord.js             Discord publish
│   │   ├── send-mastodon.js            Mastodon publish
│   │   ├── send-tumblr.js              ⏳ ยังไม่เสร็จ
│   │   ├── debug-tumblr-env.js         ⚠️ ควรลบทิ้ง
│   │   ├── telegram-webhook.js         Debug tool (ทิ้งไว้เผื่อใช้)
│   │   └── email/
│   │       └── [[path]].js             Newsletter endpoint (Resend) — catch-all
│   │
│   └── _lib/
│       ├── grist.js                    Grist API wrapper (getLiveArticles, getProductBuyUrlById ฯลฯ)
│       ├── article.js                  Article data + affiliate_link render
│       ├── homepage.js                 Homepage logic + search bar + community section
│       ├── layout.js                   Shared HTML template/CSS
│       ├── community-hub.js            Community Hub HTML generator (async, ดึงจาก D1) 🆕
│       └── publishers/
│           └── telegram.js             Telegram publish
│
├── .github/workflows/
│   ├── check-product-links.yml         Hourly — ตรวจ product links
│   ├── sync-analytics.yml              30 นาที — sync D1 → Grist
│   ├── sync-ga4-views.yml              Manual trigger
│   └── sync-reddit-queue.yml           (ยังไม่ได้ implement เต็ม)
│
├── admin.html                          Dashboard (Analytics/Health/Publish picker)
├── wrangler.toml                       Cloudflare config
├── fix-content-product-links.js        Sync/แก้ product links (Hourly)
├── sync-analytics-to-grist.js          Sync D1 → Grist (30 min)
└── sync-ga4-views-to-grist.js          Sync GA4 → Grist (Manual)
```

---

## Try/Catch Status

| ไฟล์ | try/catch | หมายเหตุ |
|---|---|---|
| `index.js` | ✅ | แก้แล้ว 2026-08-14 |
| `en/index.js` | ✅ | แก้แล้ว 2026-08-14 |
| `community.js` | ✅ | แก้แล้ว 2026-08-14 |
| `go/[id].js` | ✅ | แก้แล้ว 2026-08-14 |
| `product/[slug].js` | ✅ | แก้แล้ว 2026-08-14 |
| `en/product/[slug].js` | ✅ | แก้แล้ว 2026-08-14 |
| `api/send-tumblr.js` | ❌ | ยังไม่เสร็จ — ทำทีหลัง |
| `api/telegram-webhook.js` | ❌ | Debug tool — ความเสี่ยงต่ำ |
| `_lib/publishers/telegram.js` | ❌ | Library — ความเสี่ยงต่ำ |

---

## หมายเหตุสำคัญ

- **ไม่มี `functions/th/`** — TH ใช้ `functions/product/[slug].js` และ `functions/index.js` เป็น default
- **ไม่มี `functions/en/` นอกจาก** `index.js` และ `product/[slug].js`
- **Worker "af"** เป็นระบบแยก ไม่อยู่ใน repo นี้ → ดู `02_SYSTEMS/WORKER_AF.md`
