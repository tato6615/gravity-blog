# DEVELOPMENT RULES — GRAVITY OS
**กฎเหล่านี้มาจากการเจอบั๊กจริง ทำตามทุกข้อ ไม่มีข้อยกเว้น**

---

## RULE 1 — แก้โค้ดผ่าน Terminal เท่านั้น
ใช้ `cat > file << 'EOF'` หรือ Python heredoc เสมอ
ห้ามแก้ผ่าน editor UI บน browser — เสี่ยง select ผิด พิมพ์ผิดบนมือถือ

```bash
# วิธีที่ถูก
cat > functions/index.js << 'EOF'
...code...
EOF
git add . && git commit -m "fix: ..." && git push

# วิธีผิด
# เปิด editor แล้ว click แก้เอง
```

---

## RULE 2 — ทุก Route Function ต้องมี try/catch

```javascript
// ✅ ถูก
export async function onRequestGet({ env, params }) {
  try {
    return await renderPage(env, params.slug);
  } catch (e) {
    console.error('route failed:', e.message);
    return new Response(`<html>...error page...</html>`, {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// ❌ ผิด — ถ้า renderPage() throw → HTTP 500 ดิบ
export async function onRequestGet({ env, params }) {
  return renderPage(env, params.slug);
}
```

**บั๊กที่เกิดถ้าไม่ทำ:** HTTP 500 ดิบ หรือ browser ดาวน์โหลดไฟล์แทน redirect
ดูรายละเอียด: `04_BUG_DATABASE/BUG_005_HTTP500_NO_TRYCATCH.md`

---

## RULE 3 — D1 Bound Parameters ≤ 90 ต่อ Query

```javascript
// ✅ ถูก — chunk ก่อน query
const D1_CHUNK_SIZE = 90;
for (const chunk of chunkArray(ids, D1_CHUNK_SIZE)) {
  const placeholders = chunk.map(() => '?').join(',');
  await db.prepare(`SELECT * FROM t WHERE id IN (${placeholders})`)
    .bind(...chunk).all();
}

// ❌ ผิด — ถ้า ids > 100 จะ throw เงียบๆ
await db.prepare(`SELECT * FROM t WHERE id IN (${ids.map(()=>'?').join(',')})`)
  .bind(...ids).all();
```

**บั๊กที่เกิดถ้าไม่ทำ:** D1 throw `too many SQL variables` — ถ้ามี catch เงียบๆ จะ fallback เป็นค่าว่างและ sort ผิดทั้งเว็บ
ดูรายละเอียด: `04_BUG_DATABASE/BUG_003_D1_SQL_VARIABLES.md`

---

## RULE 4 — Worker "af" แก้ผ่าน Dashboard Quick Edit เท่านั้น

- URL: `https://af.pakpiromjajaja.workers.dev`
- ไม่มี git repo — ไม่มี auto-deploy
- การแก้ repo `gravity-blog` ไม่มีผลกับ Worker "af" เลย
- ต้องเข้า Cloudflare Dashboard → Workers → af → Quick Edit → Deploy

---

## RULE 5 — Secret ใหม่ต้อง Deploy ใหม่

ตั้ง secret แล้วต้อง trigger deploy ใหม่ถึงจะมีผล:
```bash
echo -n "SECRET_VALUE" | wrangler pages secret put SECRET_NAME --project-name gravity-blog
# แล้วต้อง push commit ใหม่เพื่อ trigger deploy
git commit --allow-empty -m "chore: trigger deploy for new secret"
git push
```

---

## RULE 6 — Cache อยู่ที่ฟังก์ชันกลาง

```javascript
// ✅ ถูก — cache ใน grist.js ที่เดียว ทุก caller แชร์กัน
let _cache = null;
export async function getLiveArticles(env) {
  if (_cache) return _cache;
  _cache = await fetchFromGrist(env);
  return _cache;
}

// ❌ ผิด — cache ที่ caller แต่ละจุด ทำซ้ำซ้อน
// homepage.js: let cache = await getLiveArticles(); // ไม่ได้ cache จริง
```

---

## RULE 7 — URL Validation ก่อน redirect

```javascript
// ✅ ถูก — validate ก่อน Response.redirect()
const cleanedUrl = typeof buyUrl === 'string' ? buyUrl.trim() : buyUrl;
if (!cleanedUrl) return errorResponse(404);
try {
  const validatedUrl = new URL(cleanedUrl).href;
  return Response.redirect(validatedUrl, 302);
} catch (e) {
  return errorResponse(502); // URL ไม่ valid
}

// ❌ ผิด — Response.redirect() throw ถ้า URL ไม่ valid → browser ดาวน์โหลดไฟล์
return Response.redirect(buyUrl, 302);
```

---

## RULE 8 — Catch Block ต้อง Log เสมอ

```javascript
// ✅ ถูก
} catch (e) {
  console.error('context:', e.message);
  return fallback;
}

// ❌ อันตราย — ซ่อน error ทำ debug ยากมาก
} catch (e) {
  // fall back silently
  return fallback;
}
```

---

## RULE 9 — Debug Endpoint ต้องลบทิ้งหลังใช้

สร้างได้: `functions/api/debug-*.js`
แต่ต้องลบก่อน merge เสมอ — ห้ามค้างใน production

---

## RULE 10 — Secret ห้ามวางในแชทหรือ git

ถ้าหลุดแม้ครั้งเดียว → revoke + สร้างใหม่ทันที ไม่มีข้อยกเว้น
ดูสถานะ credential ทั้งหมด: `09_SECURITY/CREDENTIALS.md`
