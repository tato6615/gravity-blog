# DONE — งานที่เสร็จแล้ว
**Archive เท่านั้น — ไม่ต้องทำซ้ำ**

---

## 2026-09-15

| งาน | หลักฐาน/Commit | ผลลัพธ์ |
|---|---|---|
| **[SEC-001]** Rotate Google Service Account Key (`ga4-views-sync@...`) | Google Cloud Console | key เก่า revoke ✅ |
| **[SEC-002]** Rotate Discord Webhook, Cloudflare Token, Telegram Bot Token | Dashboard ทุกบริการ | credentials เก่า revoke ✅ |
| **[CLEAN-001]** ลบ `functions/api/debug-tumblr-env.js` | `f7443e5` | endpoint ลบแล้ว ✅ |
| **[FEAT-001]** Community Hub CRUD form ใน admin.html | มีอยู่แล้ว (ยืนยัน audit) | emoji/ชื่อ/ลิงก์/cta/ลบ/เพิ่ม/บันทึก ✅ |
| **SEO** robots.txt absolute sitemap URL | `abdb316` | `Sitemap: https://...` ✅ |
| **SEO** parse `##`/`###` → `<h2>`/`<h3>` ใน formatArticleBody | `b08959a` | heading render ถูกต้อง ✅ |
| **[GRAVITY ARS STEP 1-3]** 13 agents + control-agent + tick.js | `ad1fd285` | pipeline อัตโนมัติทุก 10 นาที ✅ |
| Worker "af": แก้ race condition สินค้าซ้ำ | Dashboard + UNIQUE INDEX | `COUNT(*) = 1` ✅ |

## 2026-08-14

| งาน | Commit | ผลลัพธ์ |
|---|---|---|
| `/go/[id].js` — แก้ redirect ดาวน์โหลดไฟล์ | `f1e5a90` | 302 ✅ |
| Route functions ทั้งหมด — เพิ่ม try/catch | `eca094f`, `2bf09ab` | ไม่ 500 ดิบ ✅ |
| Worker "af" Source Adapter Pattern | Dashboard | 200 ✅ |

## 2026-08-13

| งาน | Commit | ผลลัพธ์ |
|---|---|---|
| D1 "too many SQL variables" sort bug | `f642b0a` | rank ถูกต้อง ✅ |
| ลบ debug endpoints (firstseen/sort/encoding) | `8946046`, `c2cca54` | ✅ |
| Community Hub integrate | — | `/community` ✅ |

## 2026-08-12

| งาน | Commit | ผลลัพธ์ |
|---|---|---|
| ลบ `_worker.bundle` | `d529e95` | deploy ถูกต้อง ✅ |
| Grist 429 cache fix | `8ba1d8c`, `cda04cb` | เว็บปกติ ✅ |
| Telegram/Discord/Mastodon publish | — | ✅ |

## ก่อนหน้า (2026-08-02 ถึง 2026-08-11)

- Phase 0-6 ทั้งหมด (Foundation → Growth/Email) ✅
- Multi-platform publish: Telegram, Discord, Mastodon, Facebook, Threads ✅
- D1 tracking, Grist integration, GA4, Newsletter (Resend) ✅
- System Health Dashboard 14 จุด ✅