[BUG_004_GO_REDIRECT.md](https://github.com/user-attachments/files/31093656/BUG_004_GO_REDIRECT.md)
# BUG-004 — `/go/[id]` Redirect → Browser ดาวน์โหลดไฟล์แทน

**วันที่พบ:** 2026-08-14
**สถานะ:** ✅ แก้แล้ว (commit `f1e5a90`)
**ไฟล์:** `functions/go/[id].js`

---

## อาการ

คลิกปุ่ม "Read the full review" สินค้า product id 152 แล้ว Safari บนมือถือ ดาวน์โหลดไฟล์ชื่อ **`152.txt`** แทนที่จะ redirect ไป Amazon

## ต้นตอ

`Response.redirect(buyUrl, 302)` ไม่มี try/catch และไม่มี URL validation
- `buyUrl` จาก Grist มี whitespace ติดมา หรือขาด `https://`
- `Response.redirect()` ของ Cloudflare Workers throw `TypeError` ทันทีถ้า URL ไม่ valid
- Error หลุดแบบ unhandled → Cloudflare ตอบกลับเป็น `text/plain`
- Safari ตีความ path `/go/152` (ไม่มีนามสกุลไฟล์) ว่าเป็นไฟล์ → ดาวน์โหลดเป็น `152.txt`

## วิธีแก้ (3 จุด)

```javascript
// 1. trim() ก่อนเช็ค
const cleanedUrl = typeof buyUrl === 'string' ? buyUrl.trim() : buyUrl;
if (!cleanedUrl) return errorResponse(404);

// 2. validate URL ก่อน redirect
let validatedUrl;
try {
  validatedUrl = new URL(cleanedUrl).href;
} catch (e) {
  return errorResponse(502, 'URL ไม่ valid');
}

// 3. ห่อ redirect ด้วย try/catch
try {
  return Response.redirect(validatedUrl, 302);
} catch (e) {
  return errorResponse(502, 'redirect ล้มเหลว');
}
```

## ผลทดสอบหลังแก้

```
curl -v https://gravity-blog.pages.dev/go/152
→ HTTP/2 302
→ location: https://amzn.to/4wZnoRp  ✅
```

## กฎที่ได้จากบั๊กนี้

→ `08_DEVELOPMENT_RULES/RULES.md` RULE 2 และ RULE 7
