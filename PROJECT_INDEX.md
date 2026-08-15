[Uploading PROJECT_INDEX.md…]()
# GRAVITY OS — PROJECT INDEX
**Single Source of Truth. Do not duplicate. Do not rename folders.**

Last Updated: 2026-08-14
Status: Production — System healthy ✅ (14/14 checks passing)

---

## QUICK NAVIGATION

| ต้องการอะไร | ไปที่ |
|---|---|
| เข้าใจโปรเจกต์ครั้งแรก | `12_AI_CONTEXT/ONBOARDING.md` |
| โครงสร้างไฟล์ทั้งหมด | `01_ARCHITECTURE/FILE_STRUCTURE.md` |
| บั๊กที่เจอและวิธีแก้ | `04_BUG_DATABASE/` |
| งานที่ต้องทำต่อ | `05_ROADMAP/BACKLOG.md` |
| กฎที่ห้ามลืม | `08_DEVELOPMENT_RULES/RULES.md` |
| Environment Variables | `14_API/ENV_VARS.md` |
| Security — ด่วน | `09_SECURITY/CREDENTIALS.md` |
| วิธี deploy | `03_PLAYBOOKS/DEPLOY.md` |

---

## FOLDER MAP

```
GRAVITY_OS/
├── PROJECT_INDEX.md          ← ไฟล์นี้ — เริ่มที่นี่เสมอ
│
├── 00_VISION/
│   └── VISION.md             ← เป้าหมาย, ทิศทาง, business model
│
├── 01_ARCHITECTURE/
│   ├── OVERVIEW.md           ← ภาพรวมระบบทั้งหมด
│   ├── FILE_STRUCTURE.md     ← โครงสร้างไฟล์จริงใน repo
│   └── DATA_FLOW.md          ← ข้อมูลไหลยังไง (Grist → Pages → D1)
│
├── 02_SYSTEMS/
│   ├── TRACKING.md           ← Click tracking, D1, /go/[id]
│   ├── PUBLISHING.md         ← Multi-platform publish (6 channels)
│   ├── ANALYTICS.md          ← GA4, /api/stats, sync workflows
│   ├── COMMUNITY_HUB.md      ← Community Hub — 6 platforms
│   ├── EMAIL.md              ← Newsletter (Resend)
│   ├── WORKER_AF.md          ← Worker "af" — Product pipeline
│   └── SYSTEM_HEALTH.md      ← Health dashboard — 14 checks
│
├── 03_PLAYBOOKS/
│   ├── DEPLOY.md             ← วิธี deploy ทุกประเภท
│   ├── DEBUG.md              ← วิธี debug step-by-step
│   └── ADD_NEW_PRODUCT.md    ← วิธีเพิ่มสินค้าใหม่เข้าระบบ
│
├── 04_BUG_DATABASE/
│   ├── INDEX.md              ← รายการบั๊กทั้งหมด
│   ├── BUG_001_WORKER_BUNDLE.md
│   ├── BUG_002_GRIST_429.md
│   ├── BUG_003_D1_SQL_VARIABLES.md
│   ├── BUG_004_GO_REDIRECT.md
│   └── BUG_005_HTTP500_NO_TRYCATCH.md
│
├── 05_ROADMAP/
│   ├── BACKLOG.md            ← งานที่ต้องทำ (เรียงตามความสำคัญ)
│   └── DONE.md               ← งานที่เสร็จแล้ว (archive)
│
├── 08_DEVELOPMENT_RULES/
│   └── RULES.md              ← กฎถาวรทั้งหมด — อ่านก่อนแก้โค้ดทุกครั้ง
│
├── 09_SECURITY/
│   └── CREDENTIALS.md        ← สถานะ credential ทั้งหมด (ไม่มีค่าจริง)
│
├── 12_AI_CONTEXT/
│   ├── ONBOARDING.md         ← AI ใหม่อ่านนี่ก่อน — เข้าใจโปรเจกต์ใน 5 นาที
│   └── CODEBASE_MAP.md       ← แผนที่โค้ด — ไฟล์ไหนทำอะไร
│
├── 14_API/
│   └── ENV_VARS.md           ← Environment variables ทั้งหมด
│
└── 15_INTEGRATIONS/
    └── THIRD_PARTY.md        ← Grist, GA4, Cloudflare, Resend, social APIs
```

---

## SYSTEM STATUS (2026-08-14 21:11)

| ระบบ | สถานะ | หมายเหตุ |
|---|---|---|
| Homepage TH `/` | ✅ 200 | |
| Homepage EN `/en` | ✅ 200 | |
| Community Hub `/community` | ✅ 200 | |
| Redirect `/go/:id` | ✅ 302 | แก้บั๊กแล้ว 14 ส.ค. |
| Grist API | ✅ 200 | หาย 429 แล้ว |
| D1 Database | ✅ | |
| GA4 | ✅ | |
| Telegram/Discord/Mastodon/Facebook/Threads | ✅ | |
| Tumblr | ⏳ | ยังไม่เสร็จ |
| Google Service Account Key | 🔴 | **ต้อง rotate ด่วน** |

---

*Architecture defined in GRAVITY OS FOUNDATION. Do not restructure.*
