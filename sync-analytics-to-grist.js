// sync-analytics-to-grist.js
// ดึงจำนวน clicks/conversions จริงจาก D1 แล้ว sync เข้า Grist table AI_ANALYTICS
//
// ใช้ wrangler CLI ที่ login ไว้แล้วในการอ่าน D1 (ไม่ต้องขอ Cloudflare API token เพิ่ม)
//
// โหมดการใช้งาน (เรียงตามลำดับที่ควรรัน):
//   node sync-analytics-to-grist.js --inspect   → ดูโครงสร้างจริงของตาราง (เช็ค field name ก่อนรันจริง)
//   node sync-analytics-to-grist.js             → dry-run แสดงว่าจะอัพเดทอะไรบ้าง ยังไม่เขียนจริง
//   node sync-analytics-to-grist.js --sync      → เขียนจริงเข้า Grist

import { execSync } from 'child_process';

const GRIST_API_KEY = process.env.GRIST_API_KEY || 'PASTE_YOUR_API_KEY_HERE';
const GRIST_DOC_ID = process.env.GRIST_DOC_ID || 'm9vaW63yyG4hk7BsXfo5Tk';
const BASE_URL = `https://docs.getgrist.com/api/docs/${GRIST_DOC_ID}`;
const D1_DB_NAME = process.env.D1_DB_NAME || 'gravity_affiliate';

const DO_INSPECT = process.argv.includes('--inspect');
const DO_SYNC = process.argv.includes('--sync');

const FIELD = {
  productRef: 'product',
  views: 'views',
  clicks: 'clicks',
  conversions: 'conversions',
  lastUpdated: 'last_updated',
};

function d1Query(sql) {
  const cmd = `npx wrangler d1 execute ${D1_DB_NAME} --remote --json --command "${sql.replace(/"/g, '\\"')}"`;
  const raw = execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 20 });
  const parsed = JSON.parse(raw);
  return parsed[0]?.results || [];
}

async function gristGet(tableId) {
  const res = await fetch(`${BASE_URL}/tables/${tableId}/records`, {
    headers: { Authorization: `Bearer ${GRIST_API_KEY}` }
  });
  if (!res.ok) throw new Error(`GET ${tableId} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.records;
}

async function gristPatch(tableId, records) {
  const res = await fetch(`${BASE_URL}/tables/${tableId}/records`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${GRIST_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records })
  });
  if (!res.ok) throw new Error(`PATCH ${tableId} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function extractRefId(val) {
  if (Array.isArray(val)) return val[1];
  return val;
}

async function main() {
  console.log('📥 ดึงข้อมูล click/conversion จาก D1...\n');
  const clickRows = d1Query('SELECT product_id, COUNT(*) as cnt FROM clicks GROUP BY product_id;');
  const convRows = d1Query('SELECT product_id, COUNT(*) as cnt FROM conversions GROUP BY product_id;');

  const clicksByProduct = new Map(clickRows.map(r => [String(r.product_id), r.cnt]));
  const convByProduct = new Map(convRows.map(r => [String(r.product_id), r.cnt]));

  console.log(`✅ D1 clicks: ${clickRows.length} product มีข้อมูล`);
  console.log(`✅ D1 conversions: ${convRows.length} product มีข้อมูล\n`);

  console.log('📥 ดึงข้อมูลจาก Grist AI_ANALYTICS...\n');
  const analyticsRows = await gristGet('AI_ANALYTICS');
  console.log(`✅ AI_ANALYTICS: ${analyticsRows.length} แถว\n`);

  if (DO_INSPECT) {
    console.log('🔍 ตัวอย่าง 3 แถวแรกของ AI_ANALYTICS (ดู field name จริง):\n');
    console.log(JSON.stringify(analyticsRows.slice(0, 3), null, 2));
    console.log('\n💡 เช็คว่าชื่อ field ในนี้ตรงกับที่ตั้งไว้ใน FIELD{} ด้านบนของสคริปต์ไหม ถ้าไม่ตรง แก้ตรงนั้นก่อนรันต่อ');
    return;
  }

  const updates = [];
  for (const row of analyticsRows) {
    const productId = extractRefId(row.fields[FIELD.productRef]);
    if (productId === null || productId === undefined) continue;

    const realClicks = clicksByProduct.get(String(productId)) || 0;
    const realConversions = convByProduct.get(String(productId)) || 0;
    const currentClicks = row.fields[FIELD.clicks] || 0;
    const currentConversions = row.fields[FIELD.conversions] || 0;

    if (realClicks !== currentClicks || realConversions !== currentConversions) {
      updates.push({
        id: row.id,
        productId,
        from: { clicks: currentClicks, conversions: currentConversions },
        to: { clicks: realClicks, conversions: realConversions },
      });
    }
  }

  if (!updates.length) {
    console.log('✅ ทุกแถวตรงกับ D1 อยู่แล้ว ไม่มีอะไรต้อง sync');
    return;
  }

  console.log(`🔄 พบ ${updates.length} แถวที่ตัวเลขไม่ตรงกับ D1:\n`);
  for (const u of updates) {
    console.log(`AI_ANALYTICS#${u.id}  product=${u.productId}`);
    console.log(`  clicks: ${u.from.clicks} → ${u.to.clicks}   conversions: ${u.from.conversions} → ${u.to.conversions}`);
    console.log('-'.repeat(70));
  }

  if (!DO_SYNC) {
    console.log('\n💡 นี่คือโหมดตรวจสอบเท่านั้น ยังไม่เขียนอะไรเข้า Grist');
    console.log('   รันคำสั่งนี้เพื่อ sync จริง: node sync-analytics-to-grist.js --sync');
    return;
  }

  console.log(`\n🔧 กำลังเขียน ${updates.length} แถวเข้า Grist...`);
  const records = updates.map(u => ({
    id: u.id,
    fields: {
      [FIELD.clicks]: u.to.clicks,
      [FIELD.conversions]: u.to.conversions,
      [FIELD.lastUpdated]: new Date().toISOString(),
    }
  }));
  await gristPatch('AI_ANALYTICS', records);
  console.log(`✅ Sync สำเร็จ ${updates.length} แถว`);
  console.log('\n⚠️ หมายเหตุ: สคริปต์นี้ยัง sync แค่ clicks/conversions จาก D1 เท่านั้น');
  console.log('   Views ยังไม่มีแหล่งข้อมูลจริง (ต้องต่อ GA4 API แยกต่างหากถ้าต้องการ)');
}

main().catch(err => {
  console.error('❌ ผิดพลาด:', err.message);
  process.exit(1);
});
