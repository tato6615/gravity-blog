# BUG-005 — HTTP 500 ดิบ — Route Functions ไม่มี try/catch

**วันที่พบ:** 2026-08-14
**สถานะ:** ✅ แก้แล้ว (commit `eca094f`)
**ไฟล์ที่แก้:** 5 ไฟล์

---

## อาการ

เข้าหน้าต่างๆ ของเว็บแล้วเจอ HTTP 500 ดิบจาก Cloudflare ไม่มีหน้า error ที่อ่านได้

## ไฟล์ที่ได้รับผลกระทบ

| ไฟล์ | Route | แก้แล้ว |
|---|---|---|
| `functions/product/[slug].js` | `/product/:slug` (TH) | ✅ |
| `functions/en/product/[slug].js` | `/en/product/:slug` | ✅ commit `2bf09ab` |
| `functions/index.js` | `/` homepage TH | ✅ commit `eca094f` |
| `functions/en/index.js` | `/en` homepage EN | ✅ commit `eca094f` |
| `functions/community.js` | `/community` | ✅ commit `eca094f` |

## ต้นตอ

Route function เรียก async function โดยไม่มี try/catch:
```javascript
// ❌ โค้ดเดิม
export async function onRequestGet({ env, params }) {
  return renderArticlePage(env, params.slug, 'en');
}
// ถ้า renderArticlePage() throw → unhandled → HTTP 500 ดิบ
```

## วิธีแก้ (Pattern มาตรฐาน)

```javascript
// ✅ โค้ดใหม่
export async function onRequestGet({ env, params }) {
  try {
    return await renderArticlePage(env, params.slug, 'en');
  } catch (e) {
    console.error('route failed:', e.message);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>เกิดข้อผิดพลาด</title>
      <body style="font-family:sans-serif;padding:40px;text-align:center;">
        <p>โหลดหน้าบทความไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
        <p><a href="/">← กลับหน้าแรก</a></p>
      </body>`,
      { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
```

## ผลทดสอบหลังแก้ (2026-08-14 21:11)

```
/ → 200 ✅
/en → 200 ✅
/community → 200 ✅
/go/152 → 302 ✅
```

## ไฟล์ที่ยังไม่มี try/catch (ความเสี่ยงต่ำ — ทำทีหลังได้)

- `functions/_lib/publishers/telegram.js` — library ไม่ใช่ route
- `functions/api/send-tumblr.js` — ยังไม่เสร็จ
- `functions/api/telegram-webhook.js` — เครื่องมือ debug
- `functions/api/debug-tumblr-env.js` — **ควรลบทิ้ง**

## กฎที่ได้จากบั๊กนี้

→ `08_DEVELOPMENT_RULES/RULES.md` RULE 2
