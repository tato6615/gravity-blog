# BUG-002 — Grist API 429 "Exceeded daily limit"

**วันที่พบ:** 2026-08-12 (หน้าเว็บล่ม) + 2026-08-14 (pipeline ล่ม)
**สถานะ:** ✅ แก้แล้ว

---

## อาการ

- หน้าเว็บทั้งหมดล่ม แสดง "Exceeded daily limit for document"
- Pipeline `Generate Everything` ค้างที่ 9/50 fields

## ต้นตอ — 2 จุด

**จุดที่ 1 (เว็บ):** ไม่มี cache เลย — ทุก request = 4 Grist calls
**จุดที่ 2 (pipeline):** `buildTableColumns()` ถูกเรียกทุก step → resolve ref dropdown ของ PRODUCTS ทุกครั้ง = 2 calls ที่ไม่จำเป็น/step × 8 steps = 16 extra calls/สินค้า

## วิธีแก้

**เว็บ (commit `8ba1d8c`, `cda04cb`):**
```javascript
// functions/_lib/homepage.js — cache 5 นาที
// functions/_lib/grist.js — cache ใน getLiveArticles()
let _cache = null;
export async function getLiveArticles(env) {
  if (_cache) return _cache;
  _cache = await fetchFromGrist(env);
  return _cache;
}
```

**Pipeline:** เปลี่ยนจาก `buildTableColumns` → `buildTableColumnsLite` ใน pipeline.js (ไม่ resolve ref dropdown options ที่ไม่ได้ใช้)

## ยืนยันผล

Grist API check: `HTTP Status: 200` ✅ (ไม่ 429 แล้ว)

## กฎที่ได้จากบั๊กนี้

Cache อยู่ที่ฟังก์ชันกลาง → `08_DEVELOPMENT_RULES/RULES.md` RULE 6
