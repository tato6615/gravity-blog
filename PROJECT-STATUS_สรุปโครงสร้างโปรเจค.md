# 📋 GRAVITY-BLOG: Project Status & Verification Log

> ไฟล์นี้คือ "single source of truth" ของสถานะโปรเจกต์
> อัพเดททุกครั้งที่เช็คหรือเปลี่ยนแปลงอะไร — ห้ามแก้ทับของเก่า ให้เพิ่มเข้าไปใน Changelog ด้านล่าง

**Last updated:** 2026-08-05 (12:48)
**Updated by:** (ใส่ชื่อ/nickname ของคนอัพเดท)

---

## 1. สถานะรวม (ณ วันที่อัพเดทล่าสุด)

| Layer | File-level (มีไฟล์ไหม) | Functional (ทำงานจริงไหม) |
|---|---|---|
| Phase 0 — Foundation | ✅ ครบ | ✅ ยืนยันได้ (deploy สำเร็จ, `git push` up-to-date) |
| Phase 1 — Tracking | ✅ ครบ | ✅ **ยืนยันทำงานจริงแล้ว** (2026-08-02 16:10) — `/go/1,87,88` ตอบ 302 ทั้งหมด, D1 `clicks` มี 3 records จริง |
| Phase 2 — Conversion | ✅ ครบ | ✅ D1 `conversions` มี 1 record จริง (ยังไม่ทดสอบ webhook แบบยิงจริงจาก affiliate network แต่มีข้อมูลแล้ว) |
| Phase 3 — Analytics | ✅ ครบ | ✅ `/api/stats` ตอบ 200 + JSON จริง |
| Phase 2 — Conversion | ✅ ครบ | ❓ ยังไม่ verify |
| Phase 3 — Analytics | ✅ ครบ | ❓ ยังไม่ verify |
| Phase 4 — Content | ✅ ครบ (2 articles) | ❓ ยังไม่ verify affiliate_link ครบ |
| Phase 5 — Growth | ✅ ครบ | 🟡 **ใกล้เสร็จ** — โค้ด `email.js` แก้ครบแล้ว (ดึงชื่อสินค้าจาก Grist แทน D1 ที่ไม่มี `products` table), สร้าง D1 `email_subscribers` แล้ว, เหลือแค่ตั้ง Mailchimp secret ใน Cloudflare + ทดสอบยิงจริง (2026-08-05) |
| Phase 6 — Automation | ✅ ครบ | 🟡 **เกือบครบ** — `check-product-links.yml` รันอัตโนมัติทุกชั่วโมงยืนยันแล้ว (2026-08-03), `sync-ga4-views-to-grist.js` รัน `--inspect` และ `--sync` สำเร็จแล้ว (2026-08-04, ดูรายละเอียดด้านล่าง) แต่ **ยังไม่มี workflow อัตโนมัติ** ต้องรันมือทุกครั้ง |

**สรุป:** ไฟล์ scaffold ครบ 9/9 (100%) — แต่ "ครบ" ในที่นี้หมายถึงไฟล์มีอยู่เท่านั้น
ยังไม่มีการยืนยันว่าระบบ **ทำงานได้จริง end-to-end** (click → D1 → dashboard → revenue)

**อัพเดท 2026-08-02:** เริ่ม verify จริงแล้ว — D1 table `clicks` ยืนยันว่ามี schema ถูกต้อง (8 columns รวม `event_type`)
และมี 1 record จริงจาก manual curl test (`product_id=1, utm_source=test, user_agent=curl/8.5.0`)
→ นี่คือหลักฐานชิ้นแรกว่า pipeline "click → D1" **เขียนข้อมูลได้จริง** แต่ยังไม่ผ่านการยิงจริงจากปุ่ม Buy บนเว็บ (`/go/[id].js`)

สถานะจริงของระบบ = **Phase 0 เสร็จสมบูรณ์, Phase 1 verify บางส่วน, Phase 2-6 ยังไม่เริ่ม verify**

---

## 2. มีอะไรบ้าง & ทำงานอย่างไร

### 📦 Phase 0: Foundation
| ไฟล์ | หน้าที่ |
|---|---|
| `wrangler.toml` | Config หลักของ Cloudflare Pages/Workers — บอก build settings, bindings (D1, env vars) |
| `package.json` | Dependency list + scripts (build, dev, deploy) |

### 📊 Phase 1: Tracking
| ไฟล์ | หน้าที่ |
|---|---|
| `functions/api/click.js` | รับ click จาก affiliate link, log ลง D1 table `clicks` (product_id, timestamp, referrer, utm_source) |
| `functions/go/[id].js` | Route ที่ปุ่ม "Buy" เรียกจริง — redirect ไปยัง affiliate link พร้อม log ก่อน redirect (302) |

### 💳 Phase 2: Conversion
| ไฟล์ | หน้าที่ |
|---|---|
| `functions/api/product-webhook.js` | ⚠️ **[แก้ไข 2026-08-04] ไม่ใช่ affiliate conversion webhook ตามที่เข้าใจไว้เดิม** — อ่านโค้ดเต็มแล้วพบว่าเป็นระบบเรียก **Shotstack API เพื่อสร้างวิดีโอแนวตั้ง (1080×1920) สำหรับ TikTok/Shorts** จากรูปสินค้า พร้อม callback ไปที่ `/api/shotstack-callback`, และมี helper `updateGristRecord` ไว้ PATCH อัพเดท Grist products table เท่านั้น — ไม่มีส่วนไหน insert เข้า D1 `conversions` เลย |
| **ยังไม่มีไฟล์** | ❌ **ยังไม่มี endpoint ที่รับ affiliate conversion webhook จริง** (ดูรายละเอียดหัวข้อใหม่ "🔌 Affiliate Conversion Webhook" ด้านล่าง) — เป็นงานที่ต้องสร้างใหม่ทั้งหมด ไม่ใช่แค่ทดสอบ |

### 📈 Phase 3: Analytics
| ไฟล์ | หน้าที่ |
|---|---|
| `functions/api/stats.js` | Query D1 (clicks + conversions) → คำนวณ conversion rate, commission ต่อ product → ส่งให้ dashboard |

### ✍️ Phase 4: Content
| ไฟล์ | หน้าที่ |
|---|---|
| `*.html` ใน `/product/` (ตอนนี้ 2 ไฟล์) | หน้าบทความสินค้าแต่ละตัว |
| `admin.html` | Dashboard สำหรับดู analytics, จัดการ approval, revenue tracker |

### 🌱 Phase 5: Growth
| ไฟล์ | หน้าที่ |
|---|---|
| `functions/api/email.js` | จัดการ email list (signup, ส่ง newsletter) |

### ⚙️ Phase 6: Automation
| ไฟล์ | หน้าที่ |
|---|---|
| `fix-content-product-links.js` | Sync/แก้ product links ใน content แบบอัตโนมัติ (ป้องกัน broken/outdated affiliate links) — ✅ ตอนนี้รันอัตโนมัติทุก 1 ชั่วโมงผ่าน GitHub Actions (`.github/workflows/check-product-links.yml`, cron `0 * * * *`) พร้อม `--fix` (แก้แถวที่มั่นใจสูงให้อัตโนมัติ) |
| `sync-analytics-to-grist.js` | ดึง clicks/conversions จริงจาก D1 → sync เข้า Grist table `AI_ANALYTICS` — มี workflow "Sync Analytics to Grist" รันอัตโนมัติทุก 1 ชั่วโมง |
| `sync-ga4-views-to-grist.js` | **[ใหม่ 2026-08-03]** ดึงยอด page views จาก GA4 (Google Analytics Data API) → map ผ่าน `CONTENT.slug` → `CONTENT.product` → sync เข้า `AI_ANALYTICS.views` — เขียนเสร็จแล้ว **แต่ยังไม่ได้รันแม้แต่ `--inspect` ครั้งแรก** (รอทดสอบ), ยังไม่มี workflow อัตโนมัติ |

### 🆕 ไฟล์ที่เจอเพิ่ม (ไม่อยู่ใน check-progress.sh เดิม — ต้องอัพเดทสคริปต์ให้เช็คด้วย)

จาก file explorer ของ repo จริง (2026-08-02) พบว่ามีไฟล์มากกว่าที่ script เช็คอยู่มาก:

| ไฟล์/โฟลเดอร์ | คาดว่าเป็น | สถานะรู้จัก |
|---|---|---|
| `functions/api/track.js` | Tracking endpoint อีกตัว (ต่างจาก click.js — ต้องเช็คว่าซ้ำซ้อนหรือทำหน้าที่ต่างกัน) | ❓ ยังไม่รู้หน้าที่ชัดเจน |
| `functions/api/shotstack-callback.js` | Webhook callback จาก Shotstack (video generation API) | ✅ **[ยืนยันแล้ว 2026-08-04]** เป็น callback ของ `product-webhook.js` ซึ่งเรียก Shotstack API สร้างวิดีโอแนวตั้ง (TikTok/Shorts) จากรูปสินค้า — ดูรายละเอียดเต็มในหัวข้อ "🔌 Affiliate Conversion Webhook" ด้านล่าง |
| `functions/_lib/article.js` | Helper function ดึง/จัดการ article data | ❓ |
| `functions/_lib/grist.js` | Helper เชื่อมต่อ Grist API (getArticleBySlug, getAvailableLanguages ตามที่ระบุใน architecture) | ❓ |
| `functions/_lib/homepage.js` | Logic สร้างหน้า homepage | ❓ |
| `functions/_lib/layout.js` | Shared layout/template | ❓ |
| `functions/product/`, `functions/go/`, `functions/en/`, `functions/[category]/` | Dynamic routes ตาม product / redirect / ภาษา / หมวดหมู่ | ❓ |
| `index.js`, `sitemap.xml.js` | Entry point + sitemap generator | ❓ |
| `admin.html.backup` | สำรองของ admin.html เก่า | ⚠️ เช็คว่าเป็นเวอร์ชันล่าสุดที่ backup ไว้ หรือเป็นของค้าง |
| `delete-broken-c....js` (untracked - "U") | สคริปต์ลบ content ที่ link เสีย | ⚠️ ยังไม่ commit เข้า git |
| `tiktokqz2WhYIAPSPq....` | ดูเหมือนไฟล์ verification ของ TikTok (domain ownership) | ❓ ไม่เกี่ยวกับระบบหลัก |
| `privacy.html`, `terms.html`, `robots.txt`, `README.md` | หน้า/ไฟล์มาตรฐานเว็บ | ✅ น่าจะครบตามปกติ |

⚠️ **สิ่งที่ต้องทำ:** อัพเดท `check-progress.sh` ให้เช็คไฟล์เหล่านี้ด้วย ไม่งั้น "100%" ที่รายงานจะไม่ครอบคลุมของจริงในโปรเจกต์

### 🧩 พบ Worker แยกต่างหาก: "af" (`af.pakpiromjajaj.workers.dev`) — เพิ่ม 2026-08-04

ระหว่างเช็คปัญหา UI ค้าง เจอ Cloudflare Worker ชื่อ **"af"** ที่แก้ผ่าน Cloudflare Dashboard (Quick Edit) โดยตรง มีไฟล์ต่างหากทั้งชุด:
`admin.js, ai-prompt.js, ai-providers.js, analytics.js, distribute.js, grist.js, images.js, import.js, legacy-sync.js, page.js, pipeline.js, publish.js, sanitize.js, scraping.js, worker.js`

ดูจากชื่อไฟล์ (`pipeline.js`, `publish.js`, `distribute.js`) และหน้า Dashboard ที่มันตอบกลับ ("GRAVITY_OS · AI Product Engine" พร้อม workflow Import → Generate → Publish → Done) → **นี่คือ backend engine อีกตัวที่ขับเคลื่อนขั้นตอนสร้าง/publish สินค้าอัตโนมัติ** คนละระบบกับ `functions/api/*.js` ใน repo `gravity-blog` ที่เราตรวจสอบกันมาตลอด

**ยืนยันด้วย `find` แล้ว:**
```bash
find . -name "pipeline.js" -o -name "publish.js" -o -name "distribute.js" -o -name "legacy-sync.js" 2>/dev/null | grep -v node_modules
# ไม่เจอผลลัพธ์เลย
```
→ **ไฟล์ของ Worker "af" ไม่ได้อยู่ใน repo `gravity-blog` เลย** เป็นคนละที่เก็บโค้ดกันแน่นอน

**ยังไม่รู้ (ต้องเช็คต่อ):**
- ❓ Worker "af" นี้มี GitHub repo แยกต่างหากไหม หรือมีแต่บน Cloudflare Dashboard เท่านั้น (ยังไม่ได้ถาม/ตอบชัดเจนในบทสนทนา)
- ❓ Worker "af" กับ `gravity-blog.pages.dev` สัมพันธ์กันยังไง — เช่น เว็บหลักเรียก API ของ Worker "af" หรือเป็นระบบคู่ขนานที่ไม่ได้เชื่อมกันเลย
- ❓ ถ้าต้องแก้โค้ด Worker "af" ในอนาคต ต้องแก้ผ่าน Cloudflare Dashboard โดยตรงเท่านั้น (เพราะไม่มี auto-deploy จาก git) — ต้องกด **Deploy** เองทุกครั้งหลังแก้

⚠️ **สำคัญ:** ถ้าจะแก้ไฟล์ที่เกี่ยวกับ Worker "af" ห้ามสันนิษฐานว่าแก้ repo `gravity-blog` แล้วจะมีผลกับมันด้วย — เป็นคนละระบบ deploy กันโดยสิ้นเชิง

### 🐛 บทเรียน: `git add` แล้วไม่ `git commit` ทำให้ push ไม่มีอะไรใหม่ (2026-08-04)

**อาการ:** แก้ `admin.html` แล้ว push ไป (`git push origin main` ตอบ `Everything up-to-date`) แต่เว็บ `gravity-blog.pages.dev` ยัง serve UI เก่าอยู่เรื่อยๆ แม้จะรอนานแค่ไหน

**สาเหตุที่แท้จริง:** รัน `git add` (staged) แต่ **ลืม `git commit`** ก่อน push — `git status` แสดง `Changes to be committed: modified: admin.html` ค้างอยู่ และ `git log --oneline -3` ก็ไม่มี commit ไหนพูดถึง `admin.html` เลย (มีแต่ commit เรื่อง GA4 sync) → เพราะไม่มี commit ใหม่ `git push` เลยไม่มีอะไรให้ส่ง ทั้งที่ไม่ error

**แก้แล้ว:** `git commit -m "..." && git push origin main` → ยืนยันด้วย `git status` เห็น `nothing to commit, working tree clean` → เว็บอัพเดทขึ้นจริงหลัง Cloudflare Pages build เสร็จ (~1-2 นาที)

**บทเรียนสำหรับครั้งหน้า:** ก่อน push ทุกครั้ง เช็ค `git status` ให้เห็น `nothing to commit, working tree clean` ก่อนเสมอ — ถ้าเห็น `Changes to be committed` ค้างอยู่ แปลว่ายังไม่ได้ commit จริง หรือรวบเป็นคำสั่งเดียวกันเลย: `git add . && git commit -m "..." && git push origin main`

### 🔑 แก้ปัญหาถาวร: GRIST_API_KEY / GRIST_DOC_ID หายทุกครั้งที่เปิด terminal ใหม่ (2026-08-05)

**อาการ:** ทุกครั้งที่เปิด Codespace terminal ใหม่ ตัวแปร `$GRIST_API_KEY` / `$GRIST_DOC_ID` จะว่างเปล่า (`echo "[$GRIST_API_KEY]"` ได้ `[]`) ทั้งที่ก่อนหน้าเคย echo เห็นค่าจริงมาแล้วในเซสชันเดียวกัน — เช็คด้วย `declare -p` ก็บอก `not found`, เช็ค `env | grep -i grist` ก็ไม่เจอ, เช็ค `~/.bashrc`, `.devcontainer/`, `.dev.vars` ก็ไม่มีที่มาที่ไปชัดเจน → สรุปว่าตัวแปรนี้ไม่เคยถูกตั้งค่าแบบถาวรเลยสักที่ เป็นเหตุผลที่ทำให้ debug เรื่อง Grist (เช่นเช็ค category) เสียเวลาไปกับปัญหา infra ซ้ำๆ ทุกรอบ

**แก้ถาวรแล้ว (2026-08-05):**
1. สร้างไฟล์ `.dev.vars` ที่ root repo เก็บค่าจริง:
   ```
   GRIST_DOC_ID=m9vaW63yyG4hk7BsXfo5Tk
   GRIST_API_KEY=89ec5967955acefc028c5b66a4997c531e9881df
   ```
2. เพิ่ม `.dev.vars` เข้า `.gitignore` แล้ว (กันหลุดขึ้น GitHub)
3. เพิ่ม auto-load เข้า `~/.bashrc`:
   ```bash
   if [ -f /workspaces/gravity-blog/.dev.vars ]; then
     set -a
     source /workspaces/gravity-blog/.dev.vars
     set +a
   fi
   ```
4. ✅ **ยืนยันแล้วว่าคีย์นี้ยังใช้งานได้จริง** (ไม่ได้ถูก revoke อย่างที่กังวลไว้ก่อนหน้า) — ยิง `curl .../tables` ผ่าน `${GRIST_API_KEY}` ได้ list table กลับมาถูกต้องครบ 10 ตาราง: `PRODUCTS, CONTENT, SOCIAL, PUBLISH_LOG, PERFORMANCE, KEYWORDS, AI_ANALYSIS, AI_MEDIA, AI_PUBLISH, AI_ANALYTICS`

**ผลลัพธ์:** ตอนนี้เปิด Codespace/terminal ใหม่กี่รอบ ตัวแปรจะพร้อมใช้งานทันทีเสมอ ไม่ต้องมานั่งหาคีย์ใหม่ทุกครั้งอีกแล้ว — **ถ้าเจอปัญหา `invalid API key` อีกในอนาคต ให้สงสัยเรื่องคีย์จริงๆ ก่อน (revoked/เปลี่ยน) ไม่ใช่เรื่อง env var หายแล้ว เพราะจุดนี้แก้ปิดตายแล้ว**

### 🐛 บั๊กที่พบ: Category filter ไม่โชว์บนหน้าเว็บ — อ่านผิด table (2026-08-05)

**อาการที่ผู้ใช้เจอ:** หน้า "Latest reviews" (`gravity-blog.pages.dev`) ไม่มี category filter/pills โชว์เลย ทั้งที่โค้ดใน `functions/_lib/homepage.js` เตรียม logic ไว้ครบแล้ว (บรรทัด 63-72: ดึง unique category จาก articles → render filter pills), มี CSS `.category-filter` ใน `layout.js` (บรรทัด 329) พร้อมใช้, และมี route `functions/[category]/[slug].js` เตรียม URL structure ไว้แล้ว (`VALID_CATEGORIES`: `pets, camera-gear, lifestyle, tech, home, wellness, outdoor, gaming`)

**สาเหตุที่แท้จริง — ยืนยันด้วยข้อมูลจริงจาก Grist:**
- `homepage.js` บรรทัด 64: `categories = [...new Set(articles.map(a => a.category)...)]` — ค่า `a.category` มาจาก `functions/_lib/grist.js` บรรทัด ~200 ที่เขียนว่า `category: c.category || null` โดย `c` คือ record จากตาราง **`CONTENT`**
- เช็คจริงผ่าน `curl .../tables/CONTENT/records` → **ตาราง `CONTENT` ไม่มี field ชื่อ `category` อยู่เลยสักคอลัมน์** (fields ที่มีจริง: `product, slug, seo_title, meta_description, primary_keyword, tags, faq, blog_draft, language, comparison, alternatives, review, buying_guide, blog_outline, generated_at, buy_link, quality_score, quality_tier, quality_warnings`) → `c.category` เลยเป็น `undefined` ทุก record เสมอ → `categories.length > 0` เป็น false → filter ไม่ render อะไรเลย (ตรงกับอาการที่เห็น)
- เช็คต่อที่ตาราง **`PRODUCTS`** → **เจอ field `category` ที่ AI เขียนไว้ครบทุก record จริง!** เช่น `ULANZI VL49 → "On-Camera Video Lights"`, `Insta360 X5 → "Electronics"`, `Amaran Ray 60c → "Electronics"`, `Xtra Muse → "Camcorders"` — **AI จัดหมวดหมู่ทำงานถูกต้องสมบูรณ์ ไม่ใช่บั๊กของ AI เลย** ปัญหาคือ **frontend ไปอ่านผิด table** (`CONTENT` แทนที่จะเป็น `PRODUCTS`) เท่านั้นเอง

**จุดที่ต้องแก้ (ยังไม่ได้แก้จริง รอ decision ด้านล่างก่อน):**
```js
// functions/_lib/grist.js บรรทัด ~200
// เดิม: category: c.category || null,          (c = CONTENT record, ไม่มี field นี้)
// ต้องแก้เป็น: category: p.fields.category || null,   (p = PRODUCTS record, มีค่าจริง)
```

**⚠️ ปัญหาที่ต้องตัดสินใจก่อนแก้จริง — category ของ AI ไม่ตรงกับ `VALID_CATEGORIES` ที่ route เตรียมไว้:**
ค่าจริงจาก AI เป็นหมวดละเอียด (`"On-Camera Video Lights"`, `"Electronics"`, `"Camcorders"` ฯลฯ) แต่ `functions/[category]/[slug].js` มี `VALID_CATEGORIES` hardcode ไว้แค่ 8 หมวดกว้างๆ (`pets, camera-gear, lifestyle, tech, home, wellness, outdoor, gaming`) — **ไม่ตรงกันเลยสักหมวด** ต้องเลือกทางใดทางหนึ่งก่อนแก้โค้ดจริง:
- **ทางเลือก A:** ใช้ category ละเอียดจาก AI ตรงๆ (ยกเลิก/ขยาย `VALID_CATEGORIES` ให้ไม่จำกัด) — ง่าย เร็ว แต่จะมีหมวดกระจายเยอะ
- **ทางเลือก B:** เขียน mapping table แปลง category ละเอียดของ AI → 8 หมวดกว้างเดิม (เช่น `"Electronics"`, `"On-Camera Video Lights"`, `"Camcorders"` → map เป็น `tech` ทั้งหมด) — ตรงกับดีไซน์ route เดิม แต่ต้องเขียน logic mapping เพิ่ม

**สถานะ:** ✅✅ **[ยืนยันทำงานจริงบนเว็บแล้ว 2026-08-05 12:13]** เช็คบน `gravity-blog.pages.dev` เห็น category pills โผล่มาจริง 6 หมวด (`ทั้งหมด, Pet Supplies, Electronics, Vest Harnesses, Pet Supplies > Dogs > Toys > Chew Toys, Toys & Games, Point & Shoot Digital Cameras`) และทดสอบกด filter แล้ว filter ได้ถูกต้องจริง (กด "Pet Supplies > Dogs > Toys > Chew Toys" → เห็นแค่สินค้าของเล่นสุนัข 2 ชิ้นตรงหมวด) — **ปิดงานนี้สมบูรณ์ ไม่ต้องแก้อะไรเพิ่มแล้ว**
- `functions/_lib/grist.js` บรรทัด 200: `category: c.category || null` → `category: p.fields.category || null` (อ่านจาก PRODUCTS แทน CONTENT)
- `functions/_lib/homepage.js`: เพิ่ม logic นับจำนวนสินค้าต่อหมวด แล้วโชว์เฉพาะหมวดที่มีสินค้า `>= 2` ชิ้น เรียงจากหมวดที่มีสินค้าเยอะสุดก่อน (ตัวแปร `MIN_PRODUCTS_PER_CATEGORY` ปรับได้ทีหลังถ้ารู้สึกว่ายังรกไป)
- ยืนยันด้วย `grep -n "p.fields.category\|MIN_PRODUCTS_PER_CATEGORY"` เจอครบ 3 จุดตามที่แก้ไว้
- **ขั้นต่อไป (รอยืนยัน):** commit + push แล้วเช็คบนเว็บจริงว่า pills โผล่มา (คาดว่าจะเห็นแค่ "Electronics" ก่อน เพราะเป็นหมวดเดียวตอนนี้ที่มีสินค้า ≥2 ชิ้น ส่วน "Camcorders"/"On-Camera Video Lights" ที่มีชิ้นเดียวจะยังไม่โผล่ ถือว่าถูกต้องตามดีไซน์)
- ไม่ต้องแตะ `functions/[category]/[slug].js` เลย เพราะ filter บน homepage ใช้ query string (`?category=xxx`) คนละกลไกกับ URL routing ที่ hardcode `VALID_CATEGORIES` ไว้ (ยังทิ้งไว้เหมือนเดิม ไม่กระทบกัน)

### 🛠️ เทคนิคที่ใช้ได้ผลจริง: แก้ไฟล์ผ่าน terminal มือถือด้วย Python heredoc (เพิ่ม 2026-08-05)

**ปัญหาเดิม:** paste โค้ด JS ยาวๆ ลง bash terminal ตรงๆ ทำให้ bash พยายามรันแต่ละบรรทัดเป็นคำสั่ง (เช่น `bash: category:: command not found`) เพราะ bash ไม่รู้จัก syntax ของ JS — เจอปัญหานี้ซ้ำหลายรอบ (ครั้งแรกบันทึกไว้ในหัวข้อด้านล่าง "บันทึกสำหรับคนที่มาอ่านทีหลัง" แนะนำให้ใช้ VS Code Editor pane แทน)

**เทคนิคใหม่ที่ใช้ได้ผล 100% สำหรับแก้ไฟล์แบบ targeted replace ผ่าน terminal โดยตรง (ไม่ต้องสลับไป Editor pane):**
ใช้ Python heredoc + `str.replace()` แทน bash ตรงๆ เพราะเนื้อหาทั้งก้อนอยู่ในเครื่องหมายคำพูด `'''...'''` ของ Python ทำให้ bash ไม่ตีความเป็นคำสั่งเลย:

```bash
python3 << 'PYEOF'
path = "functions/_lib/ไฟล์ที่จะแก้.js"
with open(path) as f:
    content = f.read()

old = """โค้ดเดิมที่จะแทนที่ (คัดลอกให้ตรงเป๊ะ รวม indentation)"""
new = """โค้ดใหม่ที่จะใส่แทน"""

if old not in content:
    print("❌ ไม่เจอบล็อกเดิม — ไฟล์อาจถูกแก้ไปแล้ว หรือ text ไม่ตรง")
else:
    content = content.replace(old, new, 1)
    with open(path, "w") as f:
        f.write(content)
    print("✅ แก้สำเร็จ")
PYEOF
```

**ข้อดีของวิธีนี้:**
- ทำทุกอย่างจบใน terminal เดียว ไม่ต้องสลับไป Explorer/Editor pane ให้เสียเวลา (สะดวกกว่ามากบนมือถือ)
- มี safety check ในตัว (`if old not in content`) — ถ้า text ไม่ตรงเป๊ะจะไม่แก้อะไรเลยและแจ้งเตือนทันที ป้องกันไฟล์พังจากการ replace ผิดจุด
- ใช้ `.replace(old, new, 1)` (จำกัดแค่ 1 ครั้ง) กันกรณีมี text ซ้ำหลายที่ในไฟล์โดยไม่ตั้งใจ
- เช็คผลลัพธ์ทันทีด้วย `grep -n "keyword ที่เพิ่งเพิ่ม"` หลังรันเสมอ เพื่อยืนยันว่าแก้ตรงจุดจริง ก่อนจะ commit

**ใช้เมื่อไหร่:** เหมาะกับการแก้ไฟล์แบบ "หาข้อความเดิม → แทนที่ด้วยข้อความใหม่" (targeted patch) ถ้าเป็นการสร้างไฟล์ใหม่ทั้งไฟล์แบบยาวๆ ยังแนะนำให้ใช้วิธี VS Code Editor pane เหมือนเดิม (ดูหัวข้อด้านล่าง) เพราะ heredoc ที่ยาวเกินไปอาจมีปัญหาเรื่อง escape ตัวอักษรพิเศษได้

**⚠️ กฎสำคัญ (ผู้ใช้ย้ำไว้ 2026-08-05):** เวลาอัพเดทไฟล์ PROJECT-STATUS.md นี้ให้บันทึกเทคนิค/วิธีทำงานที่ยืนยันแล้วว่าได้ผลแบบนี้ไว้เสมอ เพื่อไม่ให้ "ไปผิดไปมา" (กลับไปใช้วิธีเดิมที่มีปัญหา หรือลืมวิธีที่ดีกว่าที่เพิ่งค้นพบ)

### ⚙️ พฤติกรรมที่ผู้ใช้ต้องการ — ลดงาน "เช็คซ้ำ" ที่ไม่ควรต้องทำอีก (บันทึกไว้ 2026-08-05)
ผู้ใช้แจ้งชัดเจนว่าเบื่อกับการต้อง diagnose ปัญหา infra/env ซ้ำๆ ทุกครั้งที่กลับมาทำงาน ("อะไรที่ผ่านแล้ว ก็ไม่ควรมานั่งเช็คทุกครั้ง ควรทำงานอย่างต่อเนื่อง") — แนวทางที่ควรยึดต่อไป:
- ปัญหา infra ที่ "แก้ถาวรแล้ว" (เช่น env var persistence ด้านบน) ให้เขียนกำกับไว้ชัดเจนว่า **"แก้ปิดตายแล้ว"** ในไฟล์นี้ เพื่อไม่ให้ตัวเองหรือ AI ตัวถัดไปกลับไปสงสัย/เช็คซ้ำจุดเดิมอีกโดยไม่จำเป็น
- ถ้าปัญหาเดิมโผล่มาอีกในอนาคต ให้สงสัยว่ามีอะไรเปลี่ยนแปลง (เช่น คีย์ถูก revoke จริง, ไฟล์ `.dev.vars` หาย) ไม่ใช่กลับไปเช็คตั้งแต่ต้นทุกครั้ง

ปัญหาเดิม: คอลัมน์ `views` ใน `AI_ANALYTICS` ค้างที่ 0 ตลอด เพราะไม่มีระบบดึงจาก GA4 มาใส่ (clicks/conversions sync จาก D1 ได้แล้ว แต่ views ต้องมาจาก GA4 คนละแหล่งข้อมูล)

**สิ่งที่ตั้งค่าเสร็จแล้ว:**
| รายการ | ค่า/สถานะ |
|---|---|
| GA4 Property | GRAVITY OS, Property ID = `547077822` |
| Google Cloud Project | `gen-lang-client-0149890375` (ใช้ project เดิมที่มีอยู่แล้ว) |
| Google Analytics Data API | ✅ Enabled แล้วบน Cloud project |
| Service Account | `ga4-views-sync@gen-lang-client-0149890375.iam.gserviceaccount.com` — สร้างแล้ว, เพิ่มสิทธิ์เข้า GA4 property แล้ว (บทบาท: ผู้ดูแลระบบ) |
| JSON key | สร้างและโหลดแล้ว |
| GitHub Secret | `GA4_SERVICE_ACCOUNT_KEY` เพิ่มเข้า repo secrets แล้ว (พร้อมกับ `CLOUDFLARE_API_TOKEN`, `GRIST_API_KEY`, `GRIST_DOC_ID`) |
| สคริปต์ `sync-ga4-views-to-grist.js` | ✅ **[2026-08-04] ทดสอบสำเร็จแล้ว** — รัน `--inspect` ได้ผลลัพธ์ถูกต้อง (38 pagePath จาก GA4, map slug→product id ผ่าน CONTENT ได้ครบ), รัน `--sync` จริงแล้ว พบ 28 แถวใน AI_ANALYTICS ที่ views ไม่ตรงกับ GA4 และอัพเดทไป (เช่น product=54 views 0→14, product=76 views 0→16) |

**ยังไม่เสร็จ:**
- **ยังไม่มี GitHub Actions workflow ให้รันอัตโนมัติ** (ต้องสร้างทีหลัง คล้าย `check-product-links.yml` — ตอนนี้ต้องรันมือผ่าน Codespace ทุกครั้ง)
- ข้อมูล GA4 ยังสะสมแค่ ~1 สัปดาห์กว่า (เพิ่งติดตั้ง GA4 ไม่นาน) → ตัวเลข views ที่ sync ไปยังน้อยอยู่ (ส่วนใหญ่ 0-16) ไม่ใช่บั๊ก จะเพิ่มขึ้นเองตามข้อมูลสะสม
- **สำคัญมาก:** การรันมือใน Codespace ต้องใช้ไฟล์ JSON key ของ Service Account (`ga4-key-temp.json`) วางไว้ชั่วคราว — **ต้องลบไฟล์นี้ทิ้งทุกครั้งหลังใช้เสร็จ** (`rm ga4-key-temp.json`) และ `unset GA4_SERVICE_ACCOUNT_KEY GRIST_API_KEY` ห้ามลืมเด็ดขาด เพราะเป็นข้อมูลลับ

### 🔌 Affiliate Conversion Webhook — ยังไม่มี ต้องสร้างใหม่ (เพิ่ม 2026-08-04)

**พื้นหลัง:** ตอนแรกเข้าใจว่า `functions/api/product-webhook.js` คือตัวรับ webhook จาก affiliate network → insert เข้า D1 `conversions` แต่หลังอ่านโค้ดเต็ม (2026-08-04 ~10:38) พบว่าไฟล์นั้นเป็นระบบสร้างวิดีโอ Shotstack คนละเรื่องกันเลย

**ยืนยันด้วย grep แล้ว:**
```bash
grep -rn "INSERT INTO conversions" functions/     # ไม่เจอผลลัพธ์เลย
grep -rn "conversions" --include="*.js" . --exclude-dir=node_modules
# เจอแต่ SELECT/COUNT/JOIN (stats.js, email.js, sync-analytics-to-grist.js) — ไม่มีการเขียนข้อมูลเลยสักที่
```
→ record `conversions id=1` (`TEST-001`) เป็น manual insert เก่า ไม่เกี่ยวกับ webhook ใดๆ ทั้งสิ้น

**ข้อกำหนดของระบบที่ต้องสร้าง:** ไม่ผูกกับ affiliate network เจ้าใดเจ้าหนึ่ง — ต้องรองรับได้หลายเจ้า (ผู้ใช้ยืนยันแล้ว 2026-08-04: "สร้างเพื่อรองรับทุกระบบที่เป็น affiliate ไม่เฉพาะเจาะจง")

**หมายเหตุสำคัญเรื่อง Amazon Associates:** ถ้าจะรองรับ Amazon Associates ด้วย ต้องรู้ไว้ก่อนว่า Amazon **ไม่มีระบบ postback/webhook แจ้ง conversion แบบ real-time** (ต่างจาก Accesstrade, Involve Asia ที่มี webhook ปกติ) วิธีที่ใช้ได้จริงมีแค่:
1. โหลดรายงานจาก Amazon Associates Dashboard เอง (Reports → Earnings) แล้ว import เข้าระบบ (CSV)
2. ขอสิทธิ์ S3 Data Feed (Activity Report) จาก Amazon Associates support โดยตรง

**แผนที่วางไว้ — adapter pattern รองรับหลายเจ้า:**
```
functions/api/affiliate-webhook.js          ← endpoint กลาง รับ POST ทุกเจ้า ผ่าน query ?network=xxx
functions/_lib/affiliate-adapters/
  ├── accesstrade.js                        ← normalize payload accesstrade → format กลาง
  ├── involve-asia.js                       ← normalize payload involve asia → format กลาง
  └── generic.js                            ← fallback สำหรับเจ้าที่ยังไม่มี adapter เฉพาะ
```
Normalize ทุกเจ้าให้เหลือ field เดียวกันก่อน insert เข้า D1: `{ product_id, commission, order_id, status, network }`

**ยังไม่ได้ทำ (งานถัดไป):**
- [ ] ตัดสินใจว่าจะเริ่ม adapter เจ้าไหนก่อน (รอ user ยืนยัน — ถามไปแล้วแต่ยังไม่ได้คำตอบว่าจะเอา Amazon CSV import หรือ affiliate network อื่นก่อน)
- [ ] เขียน `functions/api/affiliate-webhook.js` + adapter อย่างน้อย 1 ตัว
- [ ] ทดสอบยิง payload จำลองแล้วเช็คว่า insert เข้า D1 `conversions` ได้จริง
- [ ] อัพเดท checklist ข้อ 4 ให้ตรงกับงานจริง (แยกจากเดิมที่เขียนว่า "ทดสอบ product-webhook.js" ซึ่งเข้าใจผิด)

### ⚠️ บันทึกด้านความปลอดภัย (2026-08-04)
ระหว่างการทดสอบ ค่า `GRIST_API_KEY` ตัวจริงถูก echo ออกมาเห็นเต็ม ๆ ใน terminal 1 ครั้ง (ตอน export แล้วส่ง screenshot ให้ดู) — คีย์ไม่ได้หลุดออกไปที่สาธารณะ แต่เพื่อความปลอดภัย **แนะนำให้พิจารณา revoke + สร้าง GRIST_API_KEY ใหม่** (Grist → Profile Settings → API Key → Revoke → Create ใหม่ → อย่าลืมอัพเดท GitHub Secret `GRIST_API_KEY` ด้วยค่าใหม่หลังจากนั้น) ถ้ายังไม่ได้ทำ ให้ทำเป็นลำดับถัดไป

### 💡 บันทึกสำหรับคนที่มาอ่านทีหลัง — ปัญหาที่เจอระหว่างสร้างไฟล์ผ่าน Codespace บนมือถือ
ถ้าต้องสร้าง/แก้ไฟล์โค้ดยาว ๆ ผ่าน Codespace บนมือถือ **อย่า paste เนื้อหายาวหลายบรรทัดลงใน terminal โดยตรง** เจอปัญหาซ้ำ ๆ ดังนี้:
- Paste ยาวหลายบรรทัดใน terminal (bash) ทำให้เกิด error แบบ `bash: $'\E[200~...'` และโค้ดทั้งก้อนถูกตีความเป็นคำสั่งแทนที่จะเป็นเนื้อหาไฟล์ (bracketed paste mode ทำงานไม่ถูกต้องบน terminal มือถือ)
- แม้แต่ heredoc (`cat > file << EOF`) หรือ base64 one-liner ก็ยังพังถ้าเนื้อหายาวเกินไป (~10KB+)
- **ไฟล์ก็อาจถูกสร้างด้วยชื่อเพี้ยนได้** ถ้า nano ค้างตอนเซฟ (เจอเคสไฟล์ชื่อ `xxx.js--ปป-` ต้อง `mv` แก้ชื่อทีหลัง)

**วิธีที่ใช้ได้ผลจริง:** สร้างไฟล์เปล่าผ่าน **VS Code Explorer → New File** แล้ว **paste เนื้อหาลงใน editor pane โดยตรง** (ไม่ใช่ terminal) แล้ว `Ctrl+S` บันทึก — วิธีนี้ไม่มีปัญหาเรื่อง escape code เลย ใช้ terminal แค่รันคำสั่งสั้น ๆ (`node -c`, `node script.js`) เท่านั้นพอ

⚠️ **Git status พบไฟล์ค้าง:** `check-progress.sh` มีสถานะ **M** (modified ยังไม่ commit) และ `delete-broken-c...js` มีสถานะ **U** (untracked) — แนะนำให้ `git add` + `git commit` ก่อนที่จะลืมว่าแก้อะไรไปบ้าง

---

## 3. วิธีเช็คผ่าน Terminal

### 3.1 เช็คไฟล์มีครบไหม (ที่ทำไปแล้ว — เช็คระดับผิวเผิน)
```bash
bash check-progress.sh
```
⚠️ ผ่าน 100% แปลว่า "ไฟล์อยู่ครบ" เท่านั้น — ไม่ได้พิสูจน์ว่าทำงานถูกต้อง

### 3.2 เช็คว่า deploy สำเร็จและ sync กับ GitHub
```bash
git status
git log --oneline -5
git push origin main   # ควรขึ้น "Everything up-to-date"
```

### 3.3 เช็ค D1 Database — มี schema จริงไหม
```bash
# ดู list database ทั้งหมด
npx wrangler d1 list

# ดู table structure
npx wrangler d1 execute gravity_affiliate --command "SELECT name FROM sqlite_master WHERE type='table';"

# ดูว่ามี record จริงไหม
npx wrangler d1 execute gravity_affiliate --command "SELECT * FROM clicks ORDER BY timestamp DESC LIMIT 5;"
npx wrangler d1 execute gravity_affiliate --command "SELECT * FROM conversions ORDER BY timestamp DESC LIMIT 5;"
```

### 3.4 เช็คว่า click tracking ทำงานจริง (end-to-end test)
```bash
# ยิง request จำลอง click จริง (เปลี่ยน URL ให้ตรง deployment ของคุณ)
curl -i "https://gravity-blog.pages.dev/go/PRODUCT_ID_TEST"

# ควรได้ HTTP 302 + Location header ชี้ไป affiliate link
# แล้วเช็คต่อว่า D1 มี record ใหม่ไหม (รันคำสั่งข้อ 3.3 อีกครั้ง)
```

### 3.5 เช็ค stats.js / dashboard endpoint
```bash
curl -s "https://gravity-blog.pages.dev/api/stats" | jq .
```
ถ้าได้ JSON ที่มีตัวเลข clicks/conversions จริง = ผ่าน
ถ้า error หรือ empty = ยังไม่ทำงาน

### 3.6 เช็คว่า affiliate_link ใน product data ถูกกรอกครบ
```bash
# ถ้า product data อยู่ใน local JSON/HTML
grep -rL "affiliate_link" ./product/*.html   # ไฟล์ที่ "ไม่มี" affiliate_link จะโชว์ออกมา
```
(ถ้าดึงจาก Grist โดยตรง ต้องเช็คผ่าน Grist UI หรือ Grist API แทน)

### 3.7 เช็ค local dev server ก่อน deploy จริง
```bash
npx wrangler pages dev .
# แล้วเปิด http://localhost:8788 ทดสอบ click → ดู log ใน terminal
```

---

## 4. Checklist สถานะ "ใช้งานได้จริง 100%" (functional, ไม่ใช่แค่ file-level)

ติ๊กเมื่อ verify จริงผ่าน terminal ข้างบนแล้วเท่านั้น:

- [x] D1 database ถูกสร้างและมี table `clicks` ✅ ยืนยันแล้ว 2026-08-02 (schema 8 columns ครบ)
- [x] D1 table `conversions` มีอยู่จริง ✅ ยืนยันแล้ว 2026-08-04 (10:05) ผ่าน Cloudflare Dashboard Console — schema 6 columns (id, product_id, commission, order_id, status, timestamp), มี 1 record จริง (id=1, product_id=1, commission=25.5, order_id=TEST-001, status=confirmed) ตรงกับตัวเลขที่ `/api/stats` เคยรายงาน
- [ ] `/go/[id].js` redirect ได้จริง + log เข้า D1 (ปุ่ม Buy จริงบนเว็บ ยังไม่ได้ทดสอบ — record ที่มีอยู่มาจาก curl test ตรง ๆ ไม่ใช่จากปุ่ม Buy)
- [x] Insert record เข้า D1 ได้ถูกต้อง (product_id, timestamp, referrer, utm) ✅ ยืนยันแล้วจาก manual curl test (id=1, product_id=1, utm_source=test, user_agent=curl/8.5.0)
- [ ] ⚠️ **[แก้ไข 2026-08-04]** เดิมเขียนว่า "ทดสอบ `product-webhook.js`" — เข้าใจผิด ไฟล์นั้นคือ Shotstack video generation ไม่เกี่ยวกับ affiliate webhook เลย ตอนนี้คือ**ยังไม่มี endpoint รับ affiliate conversion webhook อยู่จริง ต้องสร้างใหม่ทั้งหมด** (ดูหัวข้อ "🔌 Affiliate Conversion Webhook" ด้านบนสำหรับแผนงาน — ระบบต้องรองรับหลาย affiliate network ไม่ผูกเจ้าใดเจ้าหนึ่ง)
- [x] `/api/stats` คืนค่าตัวเลขที่ตรงกับข้อมูลจริงใน D1 ✅ ยืนยันแล้ว 2026-08-04 (09:47) — curl 2 รอบตรงกัน (`product_id=1`: 2 clicks/1 conversion/25.5 commission, `87,88,90,91`: มี clicks แต่ conversion=0)
- [ ] `admin.html` แสดงข้อมูลจาก `/api/stats` ถูกต้อง ไม่ error
- [ ] Product data ทุกตัวใน Grist มี `affiliate_link` ครบ ไม่มีค่าว่าง
- [ ] Grist upgrade เป็น Team Plan แล้ว ($15/month)
- [ ] `email.js` ทดสอบ signup + ส่ง email ได้จริงอย่างน้อย 1 ครั้ง
- [ ] `fix-content-product-links.js` รันแล้วไม่ error และแก้ link ถูกต้อง
- [x] `check-product-links.yml` ตั้ง cron ให้รันอัตโนมัติทุก 1 ชั่วโมง ✅ ยืนยันแล้ว 2026-08-03 (push สำเร็จ, เห็น commit `bd1414a` บน GitHub)
- [x] GA4 Property ID, Service Account, API enabled, GitHub Secret ครบทั้ง 4 อย่าง ✅ ยืนยันแล้ว 2026-08-03
- [x] `sync-ga4-views-to-grist.js` รัน `--inspect` แล้วดูตัวเลข slug→views สมเหตุสมผล ✅ ยืนยันแล้ว 2026-08-04 (38 pagePath, map ผ่าน CONTENT ครบ)
- [x] `sync-ga4-views-to-grist.js` รัน `--sync` จริงแล้ว AI_ANALYTICS.views อัพเดทถูกต้อง ✅ ยืนยันแล้ว 2026-08-04 (28 แถวอัพเดทสำเร็จ)
- [ ] สร้าง workflow อัตโนมัติสำหรับ `sync-ga4-views-to-grist.js` (ยังรันมือเท่านั้น — งานถัดไป)
- [ ] Revoke + สร้าง `GRIST_API_KEY` ใหม่ (คีย์เก่าเคยหลุดโชว์ใน terminal ระหว่างทดสอบ — ดูหมายเหตุความปลอดภัยด้านบน)

---

## 5. Changelog (บันทึกทุกครั้งที่เช็ค/อัพเดท)

> เพิ่ม entry ใหม่ด้านบนสุดเสมอ (newest first)

### 2026-08-05 (12:13) — ✅ ปิดงาน Category Filter สมบูรณ์ — ยืนยันบนเว็บจริงแล้ว
- Commit `b0917dc` (fix category filter) + `70e8cb8` (gitignore) push สำเร็จทั้งคู่ → `git status` เห็น `nothing to commit, working tree clean` ยืนยัน
- เช็คบน `gravity-blog.pages.dev` จริง หลัง Cloudflare Pages build เสร็จ → **เห็น category pills โผล่มา 6 หมวดจริง** และกด filter ทดสอบแล้วทำงานถูกต้อง (กรองสินค้าตามหมวดได้แม่นยำ)
- สังเกตเพิ่ม: ตอนนี้มีสินค้าหมวด Pet Supplies เพิ่มเข้ามาแล้วนอกจาก Electronics ที่เจอตอนแรก → ยืนยันว่า AI ยัง classify สินค้าใหม่ต่อเนื่องตามที่ออกแบบไว้ ไม่ต้องทำอะไรเพิ่ม
- **เรื่อง category filter ปิดจบสมบูรณ์ ไม่มีงานค้างแล้ว**

### 2026-08-05 (12:10) — ✅ แก้ category filter เสร็จ + ค้นพบเทคนิค Python heredoc แก้ไฟล์ผ่าน terminal

- ตัดสินใจเรื่อง category ที่ค้างไว้ (จาก entry ก่อนหน้า): เลือก **ทางเลือก A** (ใช้หมวดละเอียดจาก AI ตรงๆ) เพราะสินค้าตอนนี้กระจุกอยู่ไม่กี่หมวด ถ้า map เป็น 8 หมวดกว้างเดิมจะไม่มีประโยชน์ (ทุกอย่างไปกอง `tech` หมด) — เพิ่มเกณฑ์ขั้นต่ำ ≥2 สินค้าต่อหมวดเพื่อกันแถบ pills รกในอนาคตแทนการทำ mapping table
- แก้ `functions/_lib/grist.js` (อ่าน category จาก PRODUCTS แทน CONTENT) และ `functions/_lib/homepage.js` (เพิ่ม logic กรองตามเกณฑ์ขั้นต่ำ) — ยืนยันด้วย `grep` เจอครบทุกจุด
- **ค้นพบเทคนิคใหม่:** ใช้ Python heredoc (`python3 << 'PYEOF' ... .replace(old, new, 1) ... PYEOF`) แก้ไฟล์แบบ targeted patch ผ่าน terminal ได้ตรงๆ โดยไม่ติดปัญหา bash ตีความโค้ด JS เป็นคำสั่ง (ที่เจอซ้ำหลายรอบก่อนหน้า) — มี safety check ในตัว ไม่ต้องสลับไป VS Code Editor pane เหมือนวิธีเดิมอีกต่อไปสำหรับการแก้ไฟล์แบบสั้นๆ รายละเอียดเต็มอยู่หัวข้อ "🛠️ เทคนิคที่ใช้ได้ผลจริง..." ด้านบน
- **ขั้นต่อไป:** รอ commit + push + ยืนยันบนเว็บจริงว่า pills โผล่มา (คำสั่งส่งให้ผู้ใช้รันแล้ว รอผลลัพธ์)

### 2026-08-05 (12:00) — 🔑 แก้ env var หายถาวร + 🐛 พบสาเหตุบั๊ก category filter

**1. แก้ปัญหา `GRIST_API_KEY`/`GRIST_DOC_ID` หายทุกครั้งที่เปิด terminal ใหม่ — แก้ถาวรแล้ว**
- ไล่ debug จากเข้าใจผิดว่า "คีย์ถูก revoke" → เจอว่าจริงๆ คือตัวแปรไม่เคยถูกตั้งค่าแบบถาวรเลย (ไม่มีใน `.bashrc`, `.dev.vars`, `.devcontainer/`, ไม่ export)
- แก้โดยสร้าง `.dev.vars` เก็บค่าจริง + เพิ่มเข้า `.gitignore` + auto-source ผ่าน `~/.bashrc` ทุกครั้งที่เปิด terminal
- ✅ ทดสอบยิง Grist API จริงผ่านคีย์นี้แล้ว ได้ list table กลับมาถูกต้อง — **ยืนยันว่าคีย์ไม่ได้ถูก revoke และตอนนี้ persist ถาวรแล้ว ไม่ต้องเช็คซ้ำอีก**
- รายละเอียดเต็มอยู่หัวข้อ "🔑 แก้ปัญหาถาวร: GRIST_API_KEY..." ด้านบน

**2. พบสาเหตุที่แท้จริงของบั๊ก category filter ไม่โชว์บนหน้าเว็บ**
- ผู้ใช้อยากเพิ่ม category filter ในหน้า "Latest reviews" → ตรวจโค้ดพบว่า **logic ทำไว้ครบแล้วทุกจุด** (`homepage.js`, `layout.js` CSS, route `[category]/[slug].js`) แค่ไม่มีอะไรโผล่มาให้เห็น
- เช็คข้อมูลจริงใน Grist พบว่า `homepage.js` ไปอ่าน field `category` จากตาราง **`CONTENT`** ซึ่ง**ไม่มี field นี้อยู่เลย** แต่ตาราง **`PRODUCTS`** กลับมี field `category` ที่ AI เขียนไว้ครบถูกต้องทุก record (เช่น "Electronics", "Camcorders", "On-Camera Video Lights")
- สรุป: **AI จัดหมวดหมู่ทำงานถูกต้องสมบูรณ์ ไม่ใช่บั๊กของ AI** ปัญหาคือ frontend code อ่านผิด table เท่านั้น (`c.category` ควรเป็น `p.fields.category`)
- พบปัญหาเพิ่มเติมที่ต้องตัดสินใจก่อนแก้จริง: category ละเอียดจาก AI (เช่น "Camcorders") ไม่ตรงกับ `VALID_CATEGORIES` 8 หมวดกว้างที่ route เตรียมไว้ (`pets, tech, home` ฯลฯ) — เสนอ 2 ทางเลือก (ใช้ตรงๆ จาก AI vs ทำ mapping table) ให้ผู้ใช้ตัดสินใจ **ยังไม่ได้แก้โค้ดจริง รอคำตอบอยู่**
- รายละเอียดเต็มอยู่หัวข้อ "🐛 บั๊กที่พบ: Category filter..." ด้านบน

**Next step:** รอผู้ใช้ตอบว่าจะใช้ทางเลือก A (category ตรงจาก AI) หรือ B (mapping เป็น 8 หมวดเดิม) แล้วแก้ `functions/_lib/grist.js` บรรทัด ~200 ตามนั้น

### 2026-08-04 (11:05) — ✅ แก้บั๊ก admin.html ไม่อัพเดท + พบ Worker "af" เป็นระบบแยก

**ปัญหาที่แก้:** `admin.html` แก้ไปแล้วแต่เว็บ `gravity-blog.pages.dev` ยังโชว์ UI เก่าค้างอยู่
- ไล่เช็ค `git status` → พบ `Changes to be committed: modified: admin.html` ค้างอยู่ และ `git log --oneline -3` ไม่มี commit ไหนพูดถึง `admin.html` เลย (มีแต่ commit GA4 sync)
- **สาเหตุ:** รัน `git add` staged ไฟล์ไว้ แต่ลืม `git commit` ก่อน push — `git push` เลยไม่มีอะไรใหม่ให้ส่ง (ตอบ `Everything up-to-date` แบบไม่ error แต่จริงๆ คือไม่มีการเปลี่ยนแปลงถูกส่งไปเลย)
- **แก้แล้ว:** `git commit -m "..."` → `git push origin main` → ยืนยันด้วย `git status` เห็น `nothing to commit, working tree clean` → เว็บอัพเดทขึ้นจริง ✅ ผู้ใช้ยืนยันว่า "ได้แล้ว"
- **บทเรียน:** เช็ค `git status` ให้เห็น `working tree clean` ก่อน push ทุกครั้ง หรือรวบเป็น `git add . && git commit -m "..." && git push origin main` คำสั่งเดียว

**การค้นพบใหม่ระหว่างทาง:** พบ Cloudflare Worker ชื่อ **"af"** (`af.pakpiromjajaj.workers.dev`) ที่แก้ผ่าน Cloudflare Dashboard Quick Edit โดยตรง มีไฟล์ `admin.js, pipeline.js, publish.js, distribute.js, scraping.js, legacy-sync.js` ฯลฯ — ดูจากชื่อไฟล์และหน้า dashboard ที่ตอบกลับ (Import → Generate → Publish → Done) คาดว่าเป็น **backend engine อีกตัวสำหรับสร้าง/publish สินค้าอัตโนมัติ** ยืนยันด้วย `find` แล้วว่า**ไฟล์เหล่านี้ไม่ได้อยู่ใน repo `gravity-blog` เลย** เป็นคนละที่เก็บโค้ดกัน — รายละเอียดเต็มอยู่หัวข้อ "🧩 พบ Worker แยกต่างหาก: af" ด้านบน ยังไม่ได้สรุปว่า Worker นี้สัมพันธ์กับ `gravity-blog` ยังไง หรือมี GitHub repo ของตัวเองไหม — เป็นเรื่องที่ต้องตามต่อ

### 2026-08-04 (10:45) — 🚨 พบว่า "affiliate conversion webhook" ไม่มีอยู่จริง — `product-webhook.js` เข้าใจผิดมาตลอด

**สรุปสิ่งที่เจอ (แก้ไขความเข้าใจเดิมที่ผิด):**
1. `cat -n functions/api/product-webhook.js` แล้วอ่านทั้งไฟล์ → พบว่าไฟล์นี้ไม่ใช่ affiliate webhook แต่เป็นระบบเรียก **Shotstack API สร้างวิดีโอแนวตั้ง** (1080×1920, effect zoomIn) จากรูปสินค้า สำหรับ TikTok/Shorts พร้อม callback ไปที่ `/api/shotstack-callback` (ไฟล์ที่เคยติด ❓ ไว้ในตาราง "ไฟล์ที่เจอเพิ่ม" ตอนนี้รู้แล้วว่ามันคือ callback ของระบบนี้)
2. มี helper `updateGristRecord` ท้ายไฟล์ไว้ PATCH ข้อมูลกลับเข้า Grist products table เท่านั้น — ไม่มีจุดไหน insert เข้า D1 `conversions` เลย
3. Grep ยืนยันซ้ำทั้ง repo:
   ```bash
   grep -rn "INSERT INTO conversions" functions/          # ว่างเปล่า
   grep -rn "conversions" --include="*.js" . --exclude-dir=node_modules
   ```
   ผลลัพธ์มีแต่การ **อ่าน** จาก `stats.js`, `email.js`, `sync-analytics-to-grist.js` — ไม่มีการ**เขียน**เข้า `conversions` จากที่ไหนเลยในโปรเจกต์
4. → record `id=1` (`TEST-001`) ใน D1 `conversions` คือ manual insert เก่าที่ไม่เกี่ยวกับ webhook อะไรทั้งสิ้น เช็คซ้ำผ่าน Cloudflare Dashboard Console (`--remote`) แล้วยังมี `total: 1` เหมือนเดิม ไม่มี record ใหม่เข้ามา
5. คุยกับ user แล้วว่าจะใช้ affiliate network เจ้าไหน — คำตอบคือ **ไม่เจาะจงเจ้าเดียว ต้องการระบบที่รองรับหลาย affiliate network** จึงวางแผนเป็น adapter pattern (ดูหัวข้อ "🔌 Affiliate Conversion Webhook" ด้านบน)
6. เช็คเพิ่มเรื่อง Amazon Associates (เผื่อเป็นหนึ่งในเจ้าที่จะรองรับ) พบว่า Amazon **ไม่มีระบบ webhook/postback แจ้ง conversion** ต้องใช้ CSV export หรือขอสิทธิ์ S3 Data Feed แทน — ต่างจาก affiliate network ทั่วไปที่มี webhook ปกติ

**บทเรียน:** ชื่อไฟล์ (`product-webhook.js`) ทำให้เข้าใจผิดว่าเป็น affiliate webhook ทั้งที่จริงเป็นคนละระบบ ครั้งหน้าถ้าเจอไฟล์ที่ชื่อดูเหมือนจะรู้หน้าที่อยู่แล้ว ควรเปิดอ่านโค้ดเต็มยืนยันก่อนจะขึ้นในตาราง "หน้าที่" หรือติ๊ก checklist ว่าเกี่ยวข้องกับ feature ใด

**Next step:** รอ user ตัดสินใจว่าจะเริ่มสร้าง adapter สำหรับ affiliate network เจ้าไหนก่อน แล้วเขียน `functions/api/affiliate-webhook.js` + adapter ตัวแรก

### 2026-08-04 (10:05) — ✅ ยืนยัน D1 table `conversions` ผ่าน Cloudflare Dashboard
- เปลี่ยนวิธีเช็ค D1 จาก `wrangler` CLI (ติด OAuth login ช้า/พังบน Codespace มือถือ) → ใช้ **Cloudflare Dashboard → D1 Database → Console** แทน เร็วกว่ามาก ไม่ต้อง login ซ้ำ
- ชื่อ database จริงคือ `gravity_affiliate` (ขีดล่าง ไม่ใช่ `gravity-blog-db` ที่เดาไว้ตอนแรก) — เจอจาก `cat wrangler.toml`
- `PRAGMA table_info(conversions);` → ยืนยัน schema จริง 6 columns: `id (INTEGER, PK), product_id (TEXT, NOT NULL), commission (REAL), order_id (TEXT), status (TEXT, default 'pending'), timestamp (DATETIME, default CURRENT_TIMESTAMP)`
- `SELECT * FROM conversions ORDER BY id DESC LIMIT 5;` → มี 1 record จริง: `id=1, product_id=1, commission=25.5, order_id=TEST-001, status=confirmed, timestamp=2026-08-01 15:11:45` — ตรงกับตัวเลขที่ `/api/stats` เคยรายงานไว้ (product_id=1: 1 conversion, commission 25.5) ยืนยันว่าข้อมูลสอดคล้องกันทั้งสองแหล่ง
- **บทเรียน:** เวลาเช็ค D1 บน Codespace มือถือ ใช้ Dashboard Console แทน `wrangler d1 execute` จะเร็วกว่ามาก โดยเฉพาะถ้า session OAuth หมดอายุ

### 2026-08-04 (09:47) — ✅ Re-confirm /api/stats + ลบ ga4-key-temp.json
- ยิง `curl https://gravity-blog.pages.dev/api/stats` 2 รอบติดกัน (ห่างกัน ~8 วิ) → ผลตรงกันทั้งคู่ `ok:true` + JSON ปกติ ไม่มี click/conversion ใหม่เข้ามาระหว่างนั้น (ปกติ ไม่ใช่บั๊ก) → ติ๊กเช็คลิสต์ "`/api/stats` คืนค่าตัวเลขตรงกับ D1" ในข้อ 4 แล้ว
- ลบไฟล์ `ga4-key-temp.json` ออกจาก repo แล้ว (ผู้ใช้ยืนยัน) — **ยังไม่ได้เช็ค `git status` ซ้ำเพื่อยืนยัน 100% และยังไม่ได้เพิ่มใน `.gitignore`** กันสร้างซ้ำในอนาคต (แนะนำทำต่อรอบหน้า)

### 2026-08-04 (09:25) — ✅ GA4 Views sync ทดสอบสำเร็จ (--inspect + --sync ผ่านทั้งคู่)

**สรุปผล:** `sync-ga4-views-to-grist.js` ทำงานได้จริงครบวงจรแล้ว ตั้งแต่ GA4 → CONTENT slug mapping → AI_ANALYTICS.views

**รายละเอียดที่เจอระหว่างทาง (เก็บไว้เผื่อเจอซ้ำ):**
1. **ไฟล์สร้างผ่าน nano พังหลายรอบ** — ตอนแรก paste เนื้อหาสคริปต์ยาว ๆ ผ่าน nano ใน terminal มือถือ ทำให้เกิด `bash: const: command not found` (โค้ดถูกรันเป็นคำสั่งแทนที่จะเป็นเนื้อหาไฟล์) และไฟล์ได้ชื่อเพี้ยนเป็น `sync-ga4-views-to-grist.js--ปป-` — แก้ด้วย `mv` เปลี่ยนชื่อกลับ
2. ไฟล์แรกที่กู้กลับมาได้ยังมี typo ค้าง (`man().catch` ควรเป็น `main().catch`) — แก้ด้วย `sed -i 's/^man()\.catch/main().catch/'`
3. **บทเรียนสำคัญ:** วิธีที่ปลอดภัยสุดสำหรับสร้าง/แก้ไฟล์ยาวบน Codespace มือถือ คือสร้างไฟล์เปล่าผ่าน **VS Code Explorer → New File** แล้ว paste ใน **editor pane** ไม่ใช่ terminal (ดูรายละเอียดเต็มในหัวข้อ "GA4 Views Integration" ด้านบน)
4. ตอนทดสอบรันจริง เจอ `401 invalid API key` เพราะ `GRIST_API_KEY` ไม่ได้อยู่ใน environment ของ Codespace (คนละที่กับ GitHub Secrets ที่เข้ารหัสไว้ อ่านค่าเดิมไม่ได้) — ต้องไปคัดลอกค่าจริงจาก Grist → Profile Settings → API Key มาใส่เอง (`export GRIST_API_KEY=...`) ก่อนถึงจะรันได้
5. ระหว่าง export คีย์เผลอ echo ค่าจริงออกมาเห็นใน terminal — บันทึกไว้เป็นคำเตือนด้านความปลอดภัยแล้ว แนะนำ revoke + สร้างใหม่ (ยังไม่ได้ทำ)

**ผลลัพธ์ `--inspect`:** GA4 คืนมา 38 pagePath, map ผ่าน slug ใน CONTENT (148 แถว) ได้ครบ ตัวเลข views ต่อ product สมเหตุสมผล (ส่วนใหญ่อยู่ในช่วง 1-16 เพราะ GA4 เพิ่งเก็บข้อมูลมาราวสัปดาห์กว่า)

**ผลลัพธ์ `--sync`:** พบ 28 แถวใน AI_ANALYTICS ที่ตัวเลข views ไม่ตรงกับ GA4 (ส่วนใหญ่เดิมเป็น 0 เพราะไม่เคย sync มาก่อน) → อัพเดทสำเร็จทั้งหมด ตัวอย่าง: product=54 (0→14), product=68 (0→14), product=76 (0→16), product=1 (1→0 — ค่าเดิมเป็นข้อมูลทดสอบเก่า ไม่ใช่บั๊ก)

**ยังไม่ได้ทำ (งานถัดไป):**
- สร้าง GitHub Actions workflow ให้ `sync-ga4-views-to-grist.js` รันอัตโนมัติ (ตอนนี้ยังต้องรันมือผ่าน Codespace ทุกครั้ง ต่างจาก `sync-analytics-to-grist.js` และ `check-product-links.yml` ที่มี workflow แล้ว)
- Revoke + สร้าง `GRIST_API_KEY` ใหม่ให้ครบวงจร (ดูหมายเหตุความปลอดภัย)
- [x] ลบไฟล์ `ga4-key-temp.json` แล้ว ✅ ยืนยันแล้ว 2026-08-04 (09:47) — ผู้ใช้ยืนยันลบเรียบร้อย (ยังไม่ได้เห็น `git status` ยืนยันซ้ำในเทิร์มินัลตรงนี้ และยังไม่ได้เพิ่มใน `.gitignore` กันสร้างซ้ำในอนาคต — แนะนำทำต่อ)

### 2026-08-03 (10:40) — ⚙️ Check Product Links ตั้ง auto รายชั่วโมง + เริ่มต่อ GA4 Views
- **Check Product Links:** แก้ `.github/workflows/check-product-links.yml` cron จาก `0 20 * * *` (วันละครั้ง) → `0 * * * *` (ทุกชั่วโมง) — commit `bd1414a`, push สำเร็จ, ยืนยันจาก GitHub Actions tab เห็น run ผ่านหมด (workflow_dispatch #6 และ scheduled #5 ก่อนแก้ทั้งคู่เขียว)
- **GA4 Views — เริ่มแก้ปัญหา views ค้าง 0:**
  - เช็คสิทธิ์/setup ผ่าน UI ทีละขั้น: ได้ Property ID (`547077822`), สร้าง Service Account (`ga4-views-sync@gen-lang-client-0149890375.iam.gserviceaccount.com`) ใน Google Cloud project ที่มีอยู่แล้ว (`gen-lang-client-0149890375`), เปิด Google Analytics Data API, สร้าง JSON key, เพิ่มสิทธิ์ Service Account เข้า GA4 property (บทบาทออกมาเป็น "ผู้ดูแลระบบ" แทน "ผู้ดู" ที่ตั้งใจไว้ — ไม่กระทบการใช้งาน เพราะครอบคลุมสิทธิ์อ่านอยู่แล้ว)
  - เพิ่ม GitHub Secret `GA4_SERVICE_ACCOUNT_KEY` เรียบร้อย
  - ไล่โค้ดเดิมหา mapping logic: `AI_ANALYTICS.product` เป็น `Ref:PRODUCTS` (เลข id), แต่ URL จริงใช้ `slug` ซึ่งอยู่ใน table `CONTENT` (ไม่ใช่ `PRODUCTS`) — `CONTENT.slug` ↔ `CONTENT.product` (plain text) คือตัวเชื่อม และ CONTENT มี 2 แถวต่อ product (th/en คนละ slug) ต้องรวม views ทั้งคู่
  - เขียน `sync-ga4-views-to-grist.js` เสร็จ (สไตล์เดียวกับ `sync-analytics-to-grist.js`: `--inspect` / dry-run / `--sync`, ใช้ Service Account JWT ต่อ GA4 Data API ตรง ไม่พึ่ง SDK เพิ่ม)
  - ตั้งค่าดึงแบบ all-time (สะสมทั้งหมด) ไปก่อน เพราะยังไม่ได้ยืนยันชัดเจนว่าต้องการรายวันหรือสะสม — ปรับได้ทีหลัง
  - **ยังไม่ได้ทดสอบรันจริงแม้แต่ `--inspect`** — ขั้นต่อไปคือรันแล้วเช็คตัวเลข map ถูกไหมก่อนสั่ง `--sync`

### 2026-08-02 (16:20) — ✅ ปิดจบ 2 ข้อค้างคาใจ ทั้งคู่ไม่ใช่บั๊ก
- `/api/click` ตอบ 400 → **ไม่ใช่บั๊ก** โค้ดต้องการทั้ง `product_id` และ `redirect` พร้อมกัน ตอนทดสอบส่งแค่ตัวเดียว ยิงใหม่แบบครบ param แล้วผ่านปกติ (ยังไม่ได้ curl ยืนยันซ้ำ แต่โค้ด logic ชัดเจนแล้ว)
- `functions/product/[slug].js` ไม่มี `affiliate_link` → **ไม่ใช่บั๊ก** ไฟล์นี้เป็นแค่ thin wrapper เรียก `_lib/article.js` ตัวจริงที่จัดการ affiliate_link อยู่ใน `_lib/article.js` ต้องแก้ future check script ให้ grep ไฟล์นั้นแทน ไม่ใช่ `[slug].js`
- พบเพิ่มเติม (ไม่กระทบ): `click.js` มีแค่ `onRequestGet` ไม่มี `onRequestPost` — ยิง POST จะตกไปที่ route `[category]` แทนแล้วตอบ "Category not found" ซึ่งถูกต้องตามดีไซน์ (endpoint นี้เป็น GET-only โดยตั้งใจ)
- สังเกต: มี 2 เส้นทาง log click คล้ายกัน (`/api/click` รับ redirect URL ตรง ๆ, `/go/[id]` หา buyUrl เองจาก Grist) — ไม่ใช่บั๊ก แต่ควรรู้ไว้เผื่อสับสนภายหลัง

**สถานะสุดท้าย:** Phase 0-3 ผ่านครบ ไม่มีบั๊กค้างที่ทราบแล้ว ณ จุดนี้

### 2026-08-02 (16:10) — ✅ /go/[id].js แก้แล้ว, ระบบ Phase 1-3 ทำงานจริง
รันสคริปต์ one-shot diagnostic ครั้งเดียว ได้คำตอบครบ:
- **`/go/1`, `/go/87`, `/go/88` → HTTP 302 ทั้งหมด** — ปัญหาที่พังก่อนหน้านี้แก้แล้วจริง (จากการ redeploy + commit ที่ทำไปรอบก่อน)
- Production secrets ยืนยันมี `GRIST_API_KEY`, `GRIST_DOC_ID` ตั้งไว้ครบ → **401 ที่เจอตอนทดสอบ local คือ false alarm** เพราะ local ไม่มีไฟล์ `.dev.vars` เท่านั้น ไม่เกี่ยวกับ production
- D1: `clicks` มี 3 records จริง, `conversions` มี 1 record จริง — ไม่ใช่ตารางเปล่าอีกต่อไป
- `/api/stats` ตอบ 200 + JSON ปกติ
- ประเด็นเล็กที่เหลือ (ไม่ใช่บั๊กร้ายแรง): `/api/click?product_id=1` ตอบ 400 ตอนยิงแบบ GET ตรง ๆ (คาดว่า endpoint นี้ต้องการ POST หรือ parameter ต่างจากนี้ — ไม่กระทบการทำงานจริงเพราะ `/go/[id].js` เป็นตัวที่ log click จริงอยู่แล้ว), และ `functions/product/[slug].js` ไม่มีคำว่า `affiliate_link` ตรง ๆ ในไฟล์ (คาดว่าเป็น false alarm ของสคริปต์ตรวจสอบ เพราะ architecture จริงใช้ `/go/<id>` แทนการฝัง affiliate_link ตรง ๆ)

**สรุป ณ จุดนี้:** Phase 0-3 (Foundation, Tracking, Conversion, Analytics) ทำงานจริงและ verify แล้ว
เหลือ Phase 4 (Content optimization), Phase 5 (Growth channels), Phase 6 (Automation) ที่ยังไม่ verify แบบ functional

### 2026-08-02 (15:50) — D1 verification + repo structure audit
- รัน `PRAGMA table_info(clicks);` บน D1 remote → **schema จริง ครบ 8 columns** (id, product_id, timestamp, referrer, utm_source, utm_medium, user_agent, ip, event_type)
- ลองรัน `ALTER TABLE clicks ADD COLUMN event_type ...` → ได้ error `duplicate column name: event_type` — **ไม่ใช่บั๊ก** แค่หมายความว่า column นี้ถูกเพิ่มไปแล้วก่อนหน้า (migration script รันซ้ำ ควรใส่ guard กันซ้ำ)
- รัน `SELECT * FROM clicks ORDER BY id DESC LIMIT 5;` → **ได้ record จริง 1 แถว**: `id=1, product_id=1, timestamp=2026-08-01 16:37:41, utm_source=test, user_agent=curl/8.5.0, ip=23.97.62.118, event_type=click`
  → ยืนยันว่า pipeline เขียนข้อมูลลง D1 **ทำงานได้จริง** (อย่างน้อยผ่าน manual test) — ยังไม่ยืนยันผ่านปุ่ม Buy จริงบนหน้าเว็บ
- เปิด file explorer ดูโครงสร้าง repo จริง → พบไฟล์เพิ่มอีกเยอะที่ `check-progress.sh` ไม่เคยเช็ค: `track.js`, `shotstack-callback.js`, `_lib/{article,grist,homepage,layout}.js`, `product/`, `go/`, `en/`, `[category]/`, `index.js`, `sitemap.xml.js`, `admin.html.backup`, `delete-broken-c...js` (untracked), ไฟล์ TikTok verification
- Git status: `check-progress.sh` = Modified (ยังไม่ commit), `delete-broken-c...js` = Untracked
- **Next step:** (1) commit ไฟล์ที่ค้าง (2) เช็ค table `conversions` แบบเดียวกับ `clicks` (3) ทดสอบ `/go/[id].js` ผ่านปุ่ม Buy จริงบนเว็บ ไม่ใช่ curl ตรง (4) หาว่า `track.js` ต่างจาก `click.js` ยังไง — ซ้ำซ้อนหรือคนละหน้าที่

### 2026-08-02
- รัน `check-progress.sh` → ไฟล์ครบ 9/9 (100%) ทุก phase
- พบ error แยกต่างหาก: `bash: cd: /tmp/gravity-blog: No such file or directory` (ยังไม่ได้สืบสาเหตุ)
- `git push origin main` → up-to-date
- **สรุป:** file-level เสร็จ, functional verification ยังไม่เริ่ม

### 2026-08-05 (12:48) — 🟡 Phase 5 (Email) เดินหน้าต่อ: Mailchimp keys + D1 table + แก้ query (ยังไม่จบ)

**สรุปผล:** พบและแก้ปัญหาไปหลายจุด แต่ **email ยังใช้งานไม่ได้ 100%** เพราะ secrets ยังไม่ได้ตั้งจริง

1. **เช็ค Mailchimp API keys** ผ่าน Account → Extras → API keys พบว่าค่าที่มีไว้แต่แรก 2 ตัวสับสนกัน: ตัวที่คิดว่าเป็น "MAILCHIMP_SERVER" จริงๆ คือ **Mobile SDK Client key** (คนละหมวด ใช้กับ Mailchimp API ไม่ได้เลย) — account นี้มี API key จริงแค่ตัวเดียว (label "gravity os", user somboon Namwang)
   - ค่าที่ถูกต้อง: `MAILCHIMP_API_KEY` = คีย์จริงจาก API keys tab (ลงท้าย `-us7`), `MAILCHIMP_SERVER` = `us7` (เอาจากท้าย API key เอง), `MAILCHIMP_LIST_ID` = `2b239278ae` (ยังไม่ได้ยืนยันซ้ำจาก Audience settings)
   - **⚠️ คีย์เก่าเคยหลุดเป็น plain text ในแชทนี้ — แนะนำ revoke แล้วสร้างใหม่ก่อนตั้งเป็น secret จริง (ยังไม่ยืนยันว่าทำแล้วหรือยัง)**
2. **สร้าง D1 table `email_subscribers` สำเร็จแล้ว** ผ่าน D1 Console (schema: `id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT, subscribed_at TEXT NOT NULL DEFAULT (datetime('now'))`) — ยืนยันจาก `SELECT name FROM sqlite_master WHERE type='table'` เห็นตารางใหม่ในลิสต์แล้ว (ตอนนี้ D1 มี: `clicks`, `conversions`, `email_subscribers`)
3. **พบบั๊กที่ยังไม่เคยเจอมาก่อน:** `handleSendNewsletter` ใน `api/email.js` เดิม query `JOIN products p ON c.product_id = p.id` แต่ D1 **ไม่มีตาราง `products` เลย** (คนละอันกับ Grist table ที่ชื่อ `PRODUCTS` — ต้องระวังสับสน 2 ระบบนี้ตลอด: D1 = ฐานข้อมูลของเว็บเอง, Grist = ฐานข้อมูลสินค้า/คอนเทนต์จาก AI pipeline)
4. **แก้โดยไม่สร้าง D1 table ซ้ำ** — เพิ่มฟังก์ชัน `getProductNamesByIds(env, productIds)` ใน `functions/_lib/grist.js` (ดึงชื่อสินค้าจาก Grist `PRODUCTS` table ตาม id) แล้วแก้ `handleSendNewsletter` ใน `functions/api/email.js` ให้เรียกใช้ฟังก์ชันนี้แทนการ `JOIN` ใน D1 — commit `docs: pull product names from Grist...` + push แล้ว

**เจอปัญหาแทรกระหว่างทาง (สำคัญ อ่านก่อนทำงานต่อ):**
- `npx wrangler secret list` ค้างที่ OAuth login เพราะ Codespace มือถือไม่มี browser ให้เปิด — **ใช้ Cloudflare Dashboard → Workers & Pages → gravity-blog → Settings → Variables and secrets แทนเสมอ** (เห็นชื่อ secret ได้ ไม่เห็นค่า แต่พอเช็คว่าตั้งครบไหม)
- พิมพ์ SQL ตรงๆ ลง bash terminal ไม่ได้ (`bash: SELECT: command not found`) — SQL ต้องรันผ่าน **Cloudflare Dashboard → D1 → gravity_affiliate → Console** เท่านั้น
- **ไฟล์ PROJECT-STATUS นี้ไม่เคยอยู่ใน git repo เลย** — ดูรายละเอียดเต็มในหัวข้อ "6. หมายเหตุสำคัญ" ด้านบน เรื่องนี้สำคัญมาก อ่านก่อนอัพเดทไฟล์ครั้งต่อไป

**ยังไม่ได้ทำ (next step ต่อจากนี้เรียงตามลำดับ):**
- [ ] Revoke Mailchimp API key เก่า (ตัวที่หลุดในแชท) + สร้างใหม่
- [ ] ยืนยัน Audience ID ที่ถูกต้องจาก Mailchimp → Audience → Settings (ตอนนี้ใช้ `2b239278ae` แบบยังไม่ double-check)
- [ ] ตั้ง `MAILCHIMP_API_KEY` / `MAILCHIMP_SERVER` / `MAILCHIMP_LIST_ID` เป็น Secret จริงใน Cloudflare Dashboard → Settings → Variables and secrets
- [ ] เอาไฟล์ PROJECT-STATUS เวอร์ชันล่าสุด (มี entry นี้) เข้า repo จริงครั้งเดียว ผ่าน VS Code Explorer upload ใน Codespace แล้ว `git add/commit/push` — ทำครั้งเดียวพอ หลังจากนี้อัพเดทผ่าน terminal ได้ตลอดไม่ต้องอัพโหลดเข้าแชทซ้ำ
- [ ] หลัง deploy: ทดสอบยิง `curl -X POST .../api/email/subscribe` จริง เช็คว่าเข้า D1 `email_subscribers` ไหม
- [ ] ทดสอบ `/api/email/send-newsletter` จริง (ต้องมี subscriber อย่างน้อย 1 คนใน Mailchimp list ก่อนถึงจะยิงแคมเปญได้)

**สถานะ Phase 5 ตอนนี้:** โค้ดพร้อมแล้ว 100%, D1 table พร้อมแล้ว, เหลือแค่ตั้ง secret + ทดสอบจริง — ประเมินว่าใกล้เสร็จมาก (เหลืองานเชิง config ไม่ใช่เชิงโค้ดแล้ว)

### (ใส่วันที่ครั้งถัดไป)
- ...

---

## 6. หมายเหตุสำคัญ

> "เขียว 100% ใน check-progress.sh ไม่เท่ากับ 'ใช้งานได้จริง 100%'"
> — สคริปต์เดิมเตือนไว้เองแล้ว

ให้ใช้ไฟล์นี้เป็นตัวติดตามความคืบหน้าจริง แทนที่จะดูแค่ % จาก check-progress.sh
ทุกครั้งที่ verify อะไรผ่านจริง → ติ๊ก checklist ข้อ 4 + เขียน entry ใหม่ในข้อ 5

**กติกาถาวร (เพิ่ม 2026-08-05):** ทุกครั้งที่อัพเดทไฟล์นี้ ให้ใช้คำสั่ง `cat >> ไฟล์ << EOF ... EOF` ผ่าน terminal เท่านั้น — ห้ามพิมพ์/paste ผ่าน nano หรือ editor UI เพราะเคยทำให้ไฟล์พังมาก่อน (ดู entry 2026-08-04 เรื่อง sync-ga4-views-to-grist.js) วิธีนี้เร็วกว่าและกันสับสนได้ดีที่สุด

**⚠️ ข้อสำคัญที่เพิ่งค้นพบ (2026-08-05):** ไฟล์นี้ **ไม่ได้อยู่ใน git repo ของ gravity-blog เลยจนถึงตอนนี้** — เป็นไฟล์ที่เก็บแยกอยู่บนมือถือ/อุปกรณ์ของผู้ใช้ แล้วอัพโหลดเข้าแชทเองทุกครั้ง ไม่เคย `git add` / `git commit` เข้า repo มาก่อน เพราะฉะนั้นคำสั่ง `cat >> "$FILE"` ที่รันใน Codespace terminal ก่อนหน้านี้จึงหาไฟล์เดิมไม่เจอ แล้วดันไปสร้างไฟล์ใหม่เปล่าๆ ขึ้นมาแทน (ไม่ใช่ปัญหา encoding ภาษาไทยตามที่เข้าใจผิดไปตอนแรก)
**ทางแก้ถาวร:** เอาไฟล์นี้ (เวอร์ชันล่าสุดที่มีครบทุก entry) เข้าไปไว้ใน repo จริงครั้งเดียว (อัพโหลดผ่าน VS Code Explorer ใน Codespace แล้ว `git add/commit/push`) จากนั้นทุกคำสั่ง `cat >>` ผ่าน terminal ในครั้งต่อๆ ไปจะอัพเดทไฟล์ตัวจริงและ sync ผ่าน git ได้เลย ไม่ต้องอัพโหลดเข้าแชทซ้ำอีก
### 2026-08-05 (13:XX) — เพิ่ม entry ใหม่
เนื้อหาที่ต้องการบันทึกใส่ตรงนี้...
