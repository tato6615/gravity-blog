[WORKER_AF.md](https://github.com/user-attachments/files/31093561/WORKER_AF.md)

# SYSTEM — Worker "af"
**ระบบแยกต่างหาก — ไม่เกี่ยวกับ repo gravity-blog เลย**

---

## ข้อมูลพื้นฐาน

- **URL:** `https://af.pakpiromjajaja.workers.dev`
- **Platform:** Cloudflare Worker
- **Deploy:** ผ่าน Cloudflare Dashboard Quick Edit เท่านั้น — ไม่มี git
- **หน้าที่:** Product pipeline — import URL → scrape → generate content → publish

---

## โครงสร้างไฟล์ (Dashboard)

```
worker-af/
├── index.js           Entry point, routing
├── pipeline.js        Pipeline orchestration (8 steps/product)
├── import.js          Import URL → Grist
├── scraping.js        Web scraping (ใช้ resolveAdapter)
├── sanitize.js        Sanitize data against Grist columns
├── grist.js           Grist API wrapper (แยกจาก gravity-blog)
└── sources/           Source Adapter Pattern (สร้าง 2026-08-14)
    ├── index.js       resolveAdapter(url) → adapter
    ├── amazon.js      Amazon adapter (needsBrowserRender: true)
    ├── ebay.js        eBay adapter (needsBrowserRender: true)
    ├── generic.js     Fallback adapter (needsBrowserRender: false)
    └── base-adapter.js  Contract/shape reference
```

---

## Source Adapter Pattern

ทุก adapter ต้อง return schema เดียวกัน:
```javascript
{
  id: 'amazon',                    // identifier
  hostPatterns: /amazon\.|amzn/i,  // regex (ไม่ anchor — ใช้กับ URL และ hostname)
  needsBrowserRender: true,        // ต้องใช้ browser rendering ไหม
  normalizeImageUrl(url) { ... }   // optional — แก้ URL รูปภาพ
}
```

`resolveAdapter(urlOrHostname)` → ค้นจาก REGISTRY → fallback เป็น genericAdapter เสมอ

---

## Pipeline Steps (8 steps/สินค้า)

1. analysis
2. keywords
3. content_th
4. content_en
5. social_th
6. social_en
7. media
8. analysis_en

---

## สถานะ

| Feature | สถานะ |
|---|---|
| Amazon adapter | ✅ deploy แล้ว |
| eBay adapter | ✅ deploy แล้ว |
| Generic fallback adapter | ✅ deploy แล้ว |
| Root `/` | ✅ 200 ปกติ |
| ทดสอบกับ URL สินค้า Amazon จริง | ⏳ ยังไม่ทดสอบ |
| ทดสอบกับ URL สินค้า eBay จริง | ⏳ ยังไม่ทดสอบ |
| ทดสอบกับ URL จากเว็บอื่น (Shopee/Lazada) | ⏳ ยังไม่ทดสอบ |

---

## ข้อควรระวัง

- Grist 429 จาก Worker "af": ~15 calls/step × 8 steps = ~120 calls/สินค้า แก้แล้วเหลือ ~11 calls/step ด้วย `buildTableColumnsLite` — แต่ถ้า import หลายสินค้าพร้อมกันยังอาจชน quota ได้
- ดู `04_BUG_DATABASE/BUG_002_GRIST_429.md` ถ้าเจอ 429 อีก
