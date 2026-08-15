# BUG-003 — D1 "too many SQL variables" → Sort ผิดทั้งเว็บ

**วันที่พบ:** 2026-08-13
**สถานะ:** ✅ แก้แล้ว (commit `f642b0a`)
**ไฟล์:** `functions/_lib/homepage.js`

---

## อาการ

สินค้าใหม่ (Harloon, id 138) ไม่ขึ้นบนสุดของ "Newest arrivals" — อยู่อันดับ 69 แทน
badge "🆕 ใหม่" ไม่ขึ้นเลยทั้งเว็บ

## ต้นตอ

`getOrCreateFirstSeenMap()` ยัด product_id ทั้งหมด (114 ตัว) ใน query เดียว:
```sql
SELECT product_id FROM product_first_seen WHERE product_id IN (?,?,?,...) -- 114 ตัว
```
D1 จำกัด bound parameters ที่ **100 ตัวต่อ query** → throw:
```
D1_ERROR: too many SQL variables at offset 278: SQLITE_ERROR
```
catch block เงียบๆ → `firstSeenMap = {}` ว่าง → ทุกสินค้าใช้ `-Infinity` เป็นวันที่ → sort ผิดทั้งเว็บ

## วิธีแก้

```javascript
const D1_CHUNK_SIZE = 90; // เผื่อ margin จากเพดาน 100

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// วน loop query ทีละ chunk
for (const chunk of chunkArray(productIds, D1_CHUNK_SIZE)) {
  const placeholders = chunk.map(() => '?').join(',');
  const rows = await env.DB.prepare(
    `SELECT product_id, first_seen_at FROM product_first_seen WHERE product_id IN (${placeholders})`
  ).bind(...chunk).all();
  // merge results...
}
```

## ผลหลังแก้

Harloon ขึ้นจาก rank 69 → **rank 4 (บนสุดของ Newest arrivals)** ✅

## กฎที่ได้จากบั๊กนี้

→ `08_DEVELOPMENT_RULES/RULES.md` RULE 3 และ RULE 8
