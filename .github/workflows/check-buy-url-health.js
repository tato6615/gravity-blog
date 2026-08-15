// เช็คว่า buy_url ของสินค้าแต่ละตัวใน PRODUCTS ยังเปิดได้จริงไหม
// (คนละอย่างกับ fix-content-product-links.js ซึ่งเช็คแค่ "ID ตรงกันไหม"
//  ไฟล์นี้เช็คของจริง — ยิง request ไปหาปลายทางแล้วดู status code)
//
// โหมด default = แค่รายงานผล ไม่แก้/ลบอะไรทั้งสิ้น
// ผลลัพธ์แบ่งเป็น 3 กลุ่ม: OK / น่าสงสัย (ต้องเช็คมือ) / ตายชัดเจน

const GRIST_API_KEY = process.env.GRIST_API_KEY || 'PASTE_YOUR_API_KEY_HERE';
const GRIST_DOC_ID = process.env.GRIST_DOC_ID || 'm9vaW63yyG4hk7BsXfo5Tk';
const BASE_URL = `https://docs.getgrist.com/api/docs/${GRIST_DOC_ID}`;

const TIMEOUT_MS = 10000;       // รอ response สูงสุด 10 วิ/ลิงก์
const CONCURRENCY = 5;          // ยิงพร้อมกันกี่ลิงก์ (กันโดน rate limit ปลายทาง)
const RETRY_ON_TIMEOUT = 1;     // ลอง retry กี่ครั้งถ้า timeout (เผื่อปลายทางแค่ช้า ไม่ได้ตายจริง)

async function gristGet(tableId) {
  const res = await fetch(`${BASE_URL}/tables/${tableId}/records`, {
    headers: { Authorization: `Bearer ${GRIST_API_KEY}` }
  });
  if (!res.ok) throw new Error(`GET ${tableId} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.records;
}

function isValidUrl(str) {
  try {
    const cleaned = (str || '').toString().trim();
    if (!cleaned) return { valid: false, reason: 'ว่างเปล่า' };
    const u = new URL(cleaned);
    if (!/^https?:$/.test(u.protocol)) return { valid: false, reason: `protocol แปลก: ${u.protocol}` };
    return { valid: true, url: u.href };
  } catch (e) {
    return { valid: false, reason: 'รูปแบบ URL ผิด (อาจขาด https:// หรือมีช่องว่าง/ขึ้นบรรทัดใหม่ปน)' };
  }
}

async function checkUrl(url, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // ใช้ GET ไม่ใช่ HEAD เพราะร้านค้าอีคอมเมิร์ซหลายเจ้า (Amazon ฯลฯ)
    // ไม่รองรับ HEAD อย่างถูกต้อง (ตอบ 405 ทั้งที่หน้าเปิดได้จริง)
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GravityLinkChecker/1.0; +https://gravity-blog.pages.dev)'
      }
    });
    clearTimeout(timer);
    return { status: res.status, finalUrl: res.url, ok: res.status >= 200 && res.status < 400 };
  } catch (e) {
    clearTimeout(timer);
    const isTimeout = e.name === 'AbortError';
    if (isTimeout && attempt < RETRY_ON_TIMEOUT) {
      return checkUrl(url, attempt + 1);
    }
    return { status: null, ok: false, error: isTimeout ? 'timeout' : e.message };
  }
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

async function main() {
  console.log('📥 กำลังดึงข้อมูลสินค้าจาก Grist...\n');
  const products = await gristGet('PRODUCTS');
  console.log(`✅ PRODUCTS: ${products.length} แถว\n`);
  console.log(`🔎 กำลังเช็คลิงก์ทั้งหมด (พร้อมกันครั้งละ ${CONCURRENCY} ลิงก์ อาจใช้เวลาสักครู่)...\n`);

  const rows = products.map(p => ({
    id: p.id,
    name: p.fields.product_name || '(ไม่มีชื่อ)',
    rawUrl: p.fields.buy_url,
  }));

  const results = await runWithConcurrency(rows, CONCURRENCY, async (row) => {
    const check = isValidUrl(row.rawUrl);
    if (!check.valid) {
      return { ...row, category: 'invalid_format', reason: check.reason };
    }
    const result = await checkUrl(check.url);
    if (result.ok) {
      return { ...row, category: 'ok', status: result.status, finalUrl: result.finalUrl };
    }
    // แยก "ตายชัดเจน" (404/410/DNS ไม่เจอ) กับ "น่าสงสัย" (403/429/timeout — 
    // อาจเป็นเพราะร้านค้าบล็อกบอท ไม่ได้แปลว่าลิงก์พังจริง ต้องเช็คด้วยมือ/เบราว์เซอร์จริง)
    const suspiciousCodes = [403, 429, 503];
    const isSuspicious = result.error === 'timeout' || suspiciousCodes.includes(result.status);
    return {
      ...row,
      category: isSuspicious ? 'suspicious' : 'broken',
      status: result.status,
      reason: result.error || `HTTP ${result.status}`,
    };
  });

  const ok = results.filter(r => r.category === 'ok');
  const suspicious = results.filter(r => r.category === 'suspicious');
  const broken = results.filter(r => r.category === 'broken');
  const invalidFormat = results.filter(r => r.category === 'invalid_format');

  console.log('='.repeat(90));
  console.log(`สรุป: ✅ ใช้งานได้ ${ok.length} | ⚠️  น่าสงสัย ${suspicious.length} | 🚨 ตายชัดเจน ${broken.length} | 🧩 รูปแบบผิด ${invalidFormat.length}`);
  console.log('='.repeat(90));

  if (broken.length) {
    console.log(`\n🚨 ลิงก์ตายชัดเจน (แก้ก่อนเลย เสียรายได้ตรงๆ):\n`);
    for (const r of broken) {
      console.log(`PRODUCT#${r.id}  "${r.name}"`);
      console.log(`  URL: ${r.rawUrl}`);
      console.log(`  ปัญหา: ${r.reason}`);
      console.log('-'.repeat(90));
    }
  }

  if (invalidFormat.length) {
    console.log(`\n🧩 รูปแบบ URL ผิด (ยังไม่ได้ยิงเช็คด้วยซ้ำ เพราะฟอร์แมตพังตั้งแต่ต้น — เหมือนเคส product 152):\n`);
    for (const r of invalidFormat) {
      console.log(`PRODUCT#${r.id}  "${r.name}"`);
      console.log(`  URL: ${JSON.stringify(r.rawUrl)}`);
      console.log(`  ปัญหา: ${r.reason}`);
      console.log('-'.repeat(90));
    }
  }

  if (suspicious.length) {
    console.log(`\n⚠️  น่าสงสัย (403/429/503/timeout — อาจแค่บล็อกบอท ไม่ได้พังจริง ควรเปิดเช็คด้วยเบราว์เซอร์จริงอีกที):\n`);
    for (const r of suspicious) {
      console.log(`PRODUCT#${r.id}  "${r.name}"  →  ${r.reason}`);
      console.log(`  URL: ${r.rawUrl}`);
    }
  }

  console.log(`\n✅ ลิงก์ปกติ ${ok.length} ตัว ไม่ต้องทำอะไร`);
  console.log('\n💡 สคริปต์นี้แค่ "รายงาน" เท่านั้น ไม่ได้แก้/ลบข้อมูลใดๆ ใน Grist ให้อัตโนมัติ');
  console.log('   ต้องไปแก้ buy_url ที่ตายเองใน Grist โดยตรง (หรือบอกผมให้ช่วยเขียนสคริปต์แก้เฉพาะจุดต่อ)');

  if (broken.length || invalidFormat.length) process.exitCode = 2;
}

main().catch(err => { console.error('❌ ผิดพลาด:', err.message); process.exit(1); });
