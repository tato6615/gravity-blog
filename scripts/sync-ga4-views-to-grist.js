// sync-ga4-views-to-grist.js
// ดึงยอด Page Views จาก GA4 (Google Analytics Data API) แล้ว sync เข้า Grist table AI_ANALYTICS
//
// วิธี map: GA4 pagePath (/product/{slug} หรือ /en/product/{slug})
//           → หา slug ใน CONTENT table → ได้ product id (CONTENT.product เป็น plain text)
//           → รวม views ของทุก slug (th+en) ที่ product id เดียวกัน
//           → เทียบ/อัพเดท AI_ANALYTICS.views ของแถวที่ product ตรงกัน
//
// โหมดการใช้งาน:
//   node sync-ga4-views-to-grist.js --inspect   → ดู pagePath/views ดิบจาก GA4 + การ map ก่อนรันจริง
//   node sync-ga4-views-to-grist.js             → dry-run แสดงว่าจะอัพเดทอะไรบ้าง ยังไม่เขียนจริง
//   node sync-ga4-views-to-grist.js --sync      → เขียนจริงเข้า Grist

import { createSign } from 'crypto';

const GRIST_API_KEY = process.env.GRIST_API_KEY || 'PASTE_YOUR_API_KEY_HERE';
const GRIST_DOC_ID = process.env.GRIST_DOC_ID || 'm9vaW63yyG4hk7BsXfo5Tk';
const BASE_URL = `https://docs.getgrist.com/api/docs/${GRIST_DOC_ID}`;

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '547077822';
const GA4_SERVICE_ACCOUNT_KEY = process.env.GA4_SERVICE_ACCOUNT_KEY; // เนื้อหาไฟล์ JSON ทั้งไฟล์ (string)

const DO_INSPECT = process.argv.includes('--inspect');
const DO_SYNC = process.argv.includes('--sync');

const FIELD = {
  productRef: 'product',
  views: 'views',
  lastUpdated: 'last_updated',
};

// ---------- Google Service Account auth (สร้าง JWT เอง ไม่ใช้ library เพิ่ม) ----------
function base64url(buf) {
  const b64 = Buffer.isBuffer(buf) ? buf.toString('base64') : Buffer.from(buf).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  if (!GA4_SERVICE_ACCOUNT_KEY) {
    throw new Error('ไม่พบ GA4_SERVICE_ACCOUNT_KEY ใน environment (ต้องเป็นเนื้อหา JSON ทั้งไฟล์)');
  }
  const key = JSON.parse(GA4_SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(key.private_key);
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`ขอ access token ไม่สำเร็จ: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// ---------- GA4 Data API ----------
async function fetchGA4Views(accessToken) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dateRanges: [{ startDate: '2020-01-01', endDate: 'today' }], // สะสมทั้งหมด (all-time)
        limit: 100000,
      }),
    }
  );
  if (!res.ok) throw new Error(`GA4 runReport ไม่สำเร็จ: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.rows || [];
}

// แปลง pagePath → slug (รองรับทั้ง /product/xxx และ /en/product/xxx)
function extractSlug(pagePath) {
  const m = pagePath.match(/^\/(?:en\/)?product\/([^/?]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

// ---------- Grist ----------
async function gristGet(tableId) {
  const res = await fetch(`${BASE_URL}/tables/${tableId}/records`, {
    headers: { Authorization: `Bearer ${GRIST_API_KEY}` },
  });
  if (!res.ok) throw new Error(`GET ${tableId} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.records;
}

async function gristPatch(tableId, records) {
  const res = await fetch(`${BASE_URL}/tables/${tableId}/records`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${GRIST_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  });
  if (!res.ok) throw new Error(`PATCH ${tableId} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function extractRefId(val) {
  if (Array.isArray(val)) return val[1];
  return val;
}

async function main() {
  console.log('🔑 ขอ access token จาก Google Service Account...\n');
  const accessToken = await getAccessToken();

  console.log('📥 ดึงข้อมูล pageviews จาก GA4...\n');
  const ga4Rows = await fetchGA4Views(accessToken);
  console.log(`✅ GA4 คืนมา ${ga4Rows.length} pagePath\n`);

  // slug → views (รวมถ้ามีซ้ำ)
  const viewsBySlug = new Map();
  for (const row of ga4Rows) {
    const pagePath = row.dimensionValues[0].value;
    const views = parseInt(row.metricValues[0].value, 10) || 0;
    const slug = extractSlug(pagePath);
    if (!slug) continue; // ไม่ใช่หน้า product ข้ามไป
    viewsBySlug.set(slug, (viewsBySlug.get(slug) || 0) + views);
  }

  if (DO_INSPECT) {
    console.log('🔍 slug → views ที่ map ได้จาก GA4:\n');
    console.log(JSON.stringify(Object.fromEntries(viewsBySlug), null, 2));
  }

  console.log('📥 ดึง CONTENT table จาก Grist (หา slug → product id)...\n');
  const contentRows = await gristGet('CONTENT');
  console.log(`✅ CONTENT: ${contentRows.length} แถว\n`);

  // product id → รวม views จากทุก slug (th+en) ของ product นั้น
  const viewsByProduct = new Map();
  for (const c of contentRows) {
    const slug = c.fields.slug;
    const productId = c.fields.product; // plain text เช่น "1"
    if (!slug || !productId) continue;
    const v = viewsBySlug.get(slug) || 0;
    viewsByProduct.set(String(productId), (viewsByProduct.get(String(productId)) || 0) + v);
  }

  if (DO_INSPECT) {
    console.log('\n🔍 product id → views รวม (หลัง map ผ่าน CONTENT):\n');
    console.log(JSON.stringify(Object.fromEntries(viewsByProduct), null, 2));
    console.log('\n💡 เช็คตัวเลขข้างบนดูว่าดูสมเหตุสมผลไหม ก่อนรันจริง');
    return;
  }

  console.log('📥 ดึงข้อมูลจาก Grist AI_ANALYTICS...\n');
  const analyticsRows = await gristGet('AI_ANALYTICS');
  console.log(`✅ AI_ANALYTICS: ${analyticsRows.length} แถว\n`);

  const updates = [];
  for (const row of analyticsRows) {
    const productId = extractRefId(row.fields[FIELD.productRef]);
    if (productId === null || productId === undefined) continue;

    const realViews = viewsByProduct.get(String(productId)) || 0;
    const currentViews = row.fields[FIELD.views] || 0;

    if (realViews !== currentViews) {
      updates.push({
        id: row.id,
        productId,
        from: currentViews,
        to: realViews,
      });
    }
  }

  if (!updates.length) {
    console.log('✅ ทุกแถวตรงกับ GA4 อยู่แล้ว ไม่มีอะไรต้อง sync');
    return;
  }

  console.log(`🔄 พบ ${updates.length} แถวที่ตัวเลข views ไม่ตรงกับ GA4:\n`);
  for (const u of updates) {
    console.log(`AI_ANALYTICS#${u.id}  product=${u.productId}  views: ${u.from} → ${u.to}`);
  }

  if (!DO_SYNC) {
    console.log('\n💡 นี่คือโหมดตรวจสอบเท่านั้น ยังไม่เขียนอะไรเข้า Grist');
    console.log('   รันคำสั่งนี้เพื่อ sync จริง: node sync-ga4-views-to-grist.js --sync');
    return;
  }

  console.log(`\n🔧 กำลังเขียน ${updates.length} แถวเข้า Grist...`);
  const records = updates.map(u => ({
    id: u.id,
    fields: {
      [FIELD.views]: u.to,
      [FIELD.lastUpdated]: new Date().toISOString(),
    },
  }));
  await gristPatch('AI_ANALYTICS', records);
  console.log(`✅ Sync สำเร็จ ${updates.length} แถว`);
}

main().catch(err => {
  console.error('❌ ผิดพลาด:', err.message);
  process.exit(1);
});
