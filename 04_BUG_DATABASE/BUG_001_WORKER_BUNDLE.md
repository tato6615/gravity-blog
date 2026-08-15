[BUG_001_WORKER_BUNDLE.md](https://github.com/user-attachments/files/31093642/BUG_001_WORKER_BUNDLE.md)
# BUG-001 — `_worker.bundle` บล็อก functions/ ทั้งหมด

**วันที่พบ:** 2026-08-12
**สถานะ:** ✅ แก้แล้ว (commit `d529e95`)

---

## อาการ

Deploy success แต่ Publish ผ่าน dashboard ยังใช้โค้ดเก่าอยู่ ผลลัพธ์ไม่เปลี่ยนแม้จะ push ใหม่หลายรอบ

## ต้นตอ

Cloudflare Pages มีกฎว่า `_worker.bundle` หรือ `_worker.js` ที่ root จะ **override `functions/` ทั้งหมด** แบบเงียบๆ ไม่มี warning

## วิธีแก้

```bash
git rm _worker.bundle
git commit -m "fix: remove _worker.bundle that was blocking functions/"
git push
```

## กฎที่ได้จากบั๊กนี้

ถ้า deploy success แต่ไม่เห็นผล → เช็ค `_worker.bundle` / `_worker.js` ที่ root ก่อนอย่างอื่นเสมอ
→ `08_DEVELOPMENT_RULES/RULES.md` (Debug section)
