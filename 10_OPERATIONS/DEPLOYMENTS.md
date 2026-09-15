# DEPLOYMENTS — Chronological Release Log

**Format:** วันที่ · commit/method · สิ่งที่ ship · ผลทดสอบ
**หมายเหตุ:** Worker "af" deploy ผ่าน Cloudflare Dashboard Quick Edit (ไม่มี git commit)

---

## 2026-09-15

| เวลา | Deploy | สิ่งที่ ship | ผล |
|---|---|---|---|
| 08:53 UTC | `ad1fd285` (main) | docs: log BUG-006 product duplicate race condition + อัปเดต `02_SYSTEMS/WORKER_AF.md` | ✅ |
| — | Dashboard (Worker "af") | `db.js`: `createProductIfNotExists()` atomic insert + UNIQUE constraint · `import.js`: ลบ early dedup check · migration `002_add_normalized_source_url.sql` · UNIQUE INDEX `idx_products_normalized_source_url` · cleanup duplicate rows (id 16, 195, 196, 197) | import ซ้ำ 3 ครั้ง → `COUNT(*) = 1` ✅ |

---

## 2026-08-14

| เวลา | Commit | สิ่งที่ ship | ผล |
|---|---|---|---|
| 21:11 | `eca094f` | `functions/index.js`, `functions/en/index.js`, `functions/community.js` — เพิ่ม try/catch ทุก route · `functions/go/[id].js` รวม fix redirect | `/` 200, `/en` 200, `/community` 200, `/go/152` 302 ✅ |
| — | `f1e5a90` | `functions/go/[id].js` — URL validation + try/catch ครอบ redirect · `functions/product/[slug].js` — เพิ่ม try/catch | ✅ |
| — | `2bf09ab` | `functions/en/product/[slug].js` — เพิ่ม try/catch | ✅ |
| — | Dashboard (Worker "af") | Source Adapter Pattern รองรับ Amazon/eBay/generic URL | root `/` 200 ✅ |

---

## 2026-08-13

| เวลา | Commit | สิ่งที่ ship | ผล |
|---|---|---|---|
| — | `f642b0a` | `functions/_lib/homepage.js` — chunk D1 query (max 90 params) แก้ "too many SQL variables" sort bug | Harloon rank 69 → 4 ✅ |
| — | `8946046` | ลบ debug endpoints: `debug-firstseen`, `debug-sort` | ✅ |
| — | `c2cca54` | ลบ debug endpoint: `debug-encoding` · Community Hub integrate 4 ไฟล์ (async + D1 + endpoint) | `/community` ✅ |

---

## 2026-08-12

| เวลา | Commit | สิ่งที่ ship | ผล |
|---|---|---|---|
| — | `d529e95` | `git rm _worker.bundle` — ลบไฟล์ที่ block functions/ ทั้งหมด | Publish ผ่าน Dashboard ใช้โค้ดใหม่ ✅ |
| — | `8ba1d8c` | `functions/_lib/homepage.js` — cache 5 นาที | Grist 429 หาย ✅ |
| — | `cda04cb` | `functions/_lib/grist.js` — cache ใน `getLiveArticles()` | เว็บปกติ ✅ |
| 10:02–10:04 | — | Telegram, Discord, Mastodon publish ยืนยัน live · Homepage search bar (real-time filter) | ✅ |

---

## 2026-08-05 ถึง 2026-08-11

| วันที่ | สิ่งที่ ship | ผล |
|---|---|---|
| 2026-08-10 | System Health Dashboard 14 จุด · GA4 Key Event `affiliate_click` · GitHub Actions 403 fix (GITHUB_TOKEN) · product-webhook/shotstack-callback health check | 14/14 ✅ |
| 2026-08-05 | `functions/sitemap.xml.js` เขียนใหม่ดึงบทความ live จาก Grist | 200 + XML ครบ ✅ |
| 2026-08-05 | Phase 4 verify: affiliate_link ครบทุกบทความ live (ผ่าน Grist API ตรง) | ✅ |
| 2026-08-05 | Phase 6 verify: 3 GitHub Actions workflows มี run สำเร็จตาม schedule จริง | ✅ |

---

## 2026-08-02 ถึง 2026-08-04 (Phase 0–3)

- Phase 0 (Foundation): Cloudflare Pages setup, D1 database, Grist integration
- Phase 1 (Web): Homepage TH/EN, product pages, affiliate redirect `/go/:id`
- Phase 2 (Social): Telegram, Discord, Mastodon, Facebook, Threads publishers
- Phase 3 (Analytics): D1 click tracking, GA4 Measurement Protocol, Newsletter (Resend)

---

## 2026-09-15 (เพิ่มเติม)

| เวลา | Commit | สิ่งที่ ship | ผล |
|---|---|---|---|
| — | `abdb316` | `robots.txt` — เปลี่ยน Sitemap เป็น absolute URL | ✅ |
| — | `b08959a` | `functions/_lib/layout.js` — parse `##`/`###` → `<h2>`/`<h3>` ใน formatArticleBody | heading render ถูกต้อง ✅ |
| — | `f7443e5` | ลบ `functions/api/debug-tumblr-env.js` (security cleanup) | endpoint ลบแล้ว ✅ |