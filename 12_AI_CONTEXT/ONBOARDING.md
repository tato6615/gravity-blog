# AI ONBOARDING — GRAVITY OS
**อ่านไฟล์นี้ก่อนทุกอย่าง ใช้เวลา 5 นาที ประหยัดเวลาได้หลายชั่วโมง**

---

## โปรเจกต์นี้คืออะไร

เว็บบล็อก affiliate สินค้า (Cloudflare Pages + Functions) ดึงข้อมูลจาก Grist และ D1 ผู้ใช้เข้าเว็บ อ่านรีวิว คลิกลิงก์สินค้า → redirect ไป Amazon/eBay → ระบบ log click ลง D1 → sync ไป GA4

**URL:** `https://gravity-blog.pages.dev`
**Repo:** `https://github.com/tato6615/gravity-blog`
**Branch:** `main` → auto-deploy ไป Cloudflare Pages

---

## ระบบมี 2 ส่วนแยกกันสนิท

### 1. gravity-blog (repo นี้)
- Cloudflare Pages + Functions
- แก้โค้ด → `git push` → auto-deploy
- ไฟล์อยู่ใน `functions/`

### 2. Worker "af" (`af.pakpiromjajaja.workers.dev`)
- Cloudflare Worker แยกต่างหาก — Product pipeline (import/scrape/publish)
- **ไม่มี git** — แก้ผ่าน Cloudflare Dashboard Quick Edit เท่านั้น
- **ห้ามสับสนกัน** — แก้ repo นี้ไม่มีผลกับ Worker "af" เลย

---

## Data Sources

```
Grist (ข้อมูลสินค้า/บทความ)
  └── PRODUCTS table → หน้าบทความ, redirect URL
  └── CONTENT table  → เนื้อหาบทความ
  └── AI_ANALYTICS   → ข้อมูล analytics จาก GA4

D1 (gravity_affiliate) — Cloudflare database
  └── clicks          → log การคลิก affiliate link
  └── conversions     → conversion tracking
  └── email_subscribers → newsletter subscribers
  └── community_platforms → platform list สำหรับ Community Hub
```

---

## ไฟล์สำคัญที่สุด — รู้จัก 10 ไฟล์นี้ก็เข้าใจระบบ 80%

| ไฟล์ | ทำอะไร |
|---|---|
| `functions/index.js` | Homepage TH — entry point หลัก |
| `functions/go/[id].js` | Redirect affiliate link + log click |
| `functions/product/[slug].js` | หน้าบทความ TH |
| `functions/en/product/[slug].js` | หน้าบทความ EN |
| `functions/_lib/grist.js` | Grist API wrapper — ทุก call ผ่านที่นี่ |
| `functions/_lib/homepage.js` | Logic หน้าหลัก + search + community |
| `functions/_lib/article.js` | Render หน้าบทความ |
| `functions/community.js` | หน้า /community |
| `functions/api/system-health.js` | Health check 14 จุด |
| `admin.html` | Dashboard — publish, analytics, health |

---

## กฎที่ห้ามลืม (อ่านก่อนแก้โค้ดทุกครั้ง)

1. **แก้โค้ดผ่าน Terminal เท่านั้น** — ห้ามแก้ผ่าน editor UI บน browser (เสี่ยงผิดพลาดบนมือถือ)
2. **ทุก route function ต้องมี try/catch** — ไม่งั้น error = HTTP 500 ดิบ
3. **D1 limit 100 bound parameters/query** — `WHERE x IN (...)` ต้อง chunk ≤90
4. **Worker "af" แก้ผ่าน Dashboard Quick Edit เท่านั้น** — ไม่มี git
5. **Secret ใหม่ต้อง deploy ใหม่ถึงมีผล**
6. **Cache อยู่ที่ฟังก์ชันกลาง** — ไม่ใช่ที่ caller

ดูกฎทั้งหมดใน `08_DEVELOPMENT_RULES/RULES.md`

---

## สิ่งที่ต้องทำก่อนแก้โค้ดใดๆ

```bash
# 1. เช็ค health ก่อนเสมอ
curl -o /dev/null -w "%{http_code}\n" https://gravity-blog.pages.dev/

# 2. ดู commit ล่าสุด
git log --oneline -5

# 3. เช็ค branch
git status
```

---

## ถ้าเจอ Error ให้ดูที่นี่ก่อน

| Error | ดูไฟล์ |
|---|---|
| HTTP 500 | `04_BUG_DATABASE/BUG_005_HTTP500_NO_TRYCATCH.md` |
| Grist 429 | `04_BUG_DATABASE/BUG_002_GRIST_429.md` |
| redirect พัง/ดาวน์โหลดไฟล์ | `04_BUG_DATABASE/BUG_004_GO_REDIRECT.md` |
| deploy success แต่ไม่เห็นผล | `04_BUG_DATABASE/BUG_001_WORKER_BUNDLE.md` |
| sort ผิด / badge ไม่ขึ้น | `04_BUG_DATABASE/BUG_003_D1_SQL_VARIABLES.md` |
