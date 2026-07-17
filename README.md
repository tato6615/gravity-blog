# GRAVITY_OS Picks — เว็บบล็อกอ่านอย่างเดียว (Cloudflare Pages)

โปรเจกต์นี้แยกจาก `worker.js` เดิมโดยสิ้นเชิง — ไม่เขียนอะไรลง Grist เลย
มีหน้าที่เดียว: อ่านสินค้าที่ `pipeline_status` เป็น `enriched` หรือ
`published` แล้วเรนเดอร์เป็นหน้าเว็บให้คนอ่านและ Google index ได้

บทความจะ**ขึ้นเว็บอัตโนมัติทันทีที่ Generate Everything เสร็จ** (status
กลายเป็น `enriched`) — ไม่ต้องกดปุ่ม publish แยกต่างหาก ตามที่เลือกไว้

## โครงสร้างไฟล์

```
gravity-blog/
├── functions/
│   ├── index.js              GET /              รายการบทความ
│   ├── product/[slug].js     GET /product/:slug  หน้าบทความเดี่ยว
│   ├── sitemap.xml.js        GET /sitemap.xml
│   └── _lib/
│       ├── grist.js          อ่านข้อมูลจาก Grist (read-only)
│       └── layout.js         ดีไซน์/เทมเพลตหน้าเว็บ
└── robots.txt
```

## Deploy ครั้งแรก

ต้องมี Node.js + `wrangler` (ตัวเดียวกับที่ใช้ deploy worker.js อยู่แล้ว):

```bash
npm install -g wrangler   # ถ้ายังไม่มี
cd gravity-blog
wrangler pages project create gravity-os-picks
wrangler pages deploy .
```

ครั้งแรกจะได้ URL แบบ `https://gravity-os-picks.pages.dev`

## ตั้งค่า environment variables (สำคัญ — เว็บจะพังถ้าไม่ตั้ง)

ใช้ secret ชุดเดียวกับที่ worker.js ใช้อยู่แล้ว (ค่าเดียวกันเป๊ะ):

```bash
wrangler pages secret put GRIST_API_KEY --project-name gravity-os-picks
wrangler pages secret put GRIST_DOC_ID  --project-name gravity-os-picks
```

หรือตั้งผ่านหน้า Cloudflare Dashboard → Pages → gravity-os-picks →
Settings → Environment variables ก็ได้เหมือนกัน

## Deploy รอบถัดไป (ทุกครั้งที่แก้ดีไซน์/โค้ด)

```bash
wrangler pages deploy .
```

## ทดสอบว่าทำงานถูกต้อง

1. เปิด `/` — ถ้ายังไม่มีสินค้า status เป็น `enriched`/`published` จะเห็นข้อความ
   "ยังไม่มีบทความ" (ไม่ error)
2. รัน Generate Everything ให้สินค้าอย่างน้อย 1 ชิ้นจนครบทุก step ใน worker เดิม
3. รีเฟรชหน้า `/` — บทความควรขึ้นทันที (ไม่ต้องรอ cache, query สดทุกครั้ง)
4. เปิด `/product/<slug>` ตรงๆ เพื่อดูหน้าบทความเดี่ยว
5. เปิด `/sitemap.xml` เพื่อเช็คว่า URL ครบ

## ต่อโดเมนของตัวเองภายหลัง

ตอนนี้ใช้ `*.pages.dev` ฟรีไปก่อนตามที่เลือกไว้ — พอมีโดเมนแล้วไปที่
Cloudflare Dashboard → Pages → gravity-os-picks → Custom domains →
Set up a custom domain ได้เลย ไม่ต้องแก้โค้ดอะไรในนี้

## ข้อจำกัดที่ควรรู้ (จะแก้ในเฟสถัดไป)

- ปุ่ม "ดูราคา / ซื้อสินค้า" ลิงก์ไป `source_url` ตรงๆ — ยังไม่มีการนับคลิก
  (จะทำ short-link + click tracking ในเฟส Analytics ถัดไป)
- ยังไม่มีรูปสินค้าจริง เพราะ `AI_MEDIA` เก็บแค่ prompt ยังไม่ได้ generate รูป
- query Grist สดทุก request — ถ้าจำนวนบทความเยอะมาก (หลักพัน) ควรเพิ่ม cache
  ทีหลัง แต่ตอนเริ่มต้นไม่ต้องกังวล
