[INDEX.md](https://github.com/user-attachments/files/31093661/INDEX.md)
# BUG DATABASE — INDEX
**บั๊กทั้งหมดที่เคยเจอ เรียงตามวันที่**

---

| ID | ชื่อบั๊ก | วันที่ | สถานะ | ไฟล์ |
|---|---|---|---|---|
| BUG-001 | `_worker.bundle` บล็อก functions/ ทั้งหมด | 2026-08-12 | ✅ แก้แล้ว | `BUG_001_WORKER_BUNDLE.md` |
| BUG-002 | Grist API 429 — หน้าเว็บล่มทั้งหมด | 2026-08-12 | ✅ แก้แล้ว | `BUG_002_GRIST_429.md` |
| BUG-003 | D1 "too many SQL variables" → sort ผิดทั้งเว็บ | 2026-08-13 | ✅ แก้แล้ว | `BUG_003_D1_SQL_VARIABLES.md` |
| BUG-004 | `/go/[id]` redirect → browser ดาวน์โหลดไฟล์แทน | 2026-08-14 | ✅ แก้แล้ว | `BUG_004_GO_REDIRECT.md` |
| BUG-005 | HTTP 500 ดิบ — route function ไม่มี try/catch | 2026-08-14 | ✅ แก้แล้ว | `BUG_005_HTTP500_NO_TRYCATCH.md` |

---

## Pattern ที่เจอซ้ำ — ระวังเป็นพิเศษ

1. **ไม่มี try/catch ใน route function** → BUG-004, BUG-005
2. **Grist API call มากเกินโควตา** → BUG-002
3. **D1 query ไม่ chunk** → BUG-003
4. **Catch block เงียบๆ ซ่อน error** → BUG-003
