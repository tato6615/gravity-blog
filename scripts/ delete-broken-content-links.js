// ลบ CONTENT rows ที่ product ID ไม่มีอยู่จริงใน PRODUCTS (ลิงก์พังจริง)
// โหมด default = dry-run (แค่แสดงว่าจะลบอะไร ไม่ลบจริง)
// รันด้วย --delete เพื่อลบจริง

const GRIST_API_KEY = process.env.GRIST_API_KEY || 'PASTE_YOUR_API_KEY_HERE';
const GRIST_DOC_ID = process.env.GRIST_DOC_ID || 'm9vaW63yyG4hk7BsXfo5Tk';
const BASE_URL = `https://docs.getgrist.com/api/docs/${GRIST_DOC_ID}`;
const CONFIRM_DELETE = process.argv.includes('--delete');

async function gristGet(tableId) {
  const res = await fetch(`${BASE_URL}/tables/${tableId}/records`, {
    headers: { Authorization: `Bearer ${GRIST_API_KEY}` }
  });
  if (!res.ok) throw new Error(`GET ${tableId} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.records;
}

async function gristDelete(tableId, recordIds) {
  const res = await fetch(`${BASE_URL}/tables/${tableId}/records/delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GRIST_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(recordIds)
  });
  if (!res.ok) throw new Error(`DELETE ${tableId} failed: ${res.status} ${await res.text()}`);
  return res.status === 200 ? await res.text() : null;
}

function toId(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

async function main() {
  console.log('📥 กำลังดึงข้อมูลจาก Grist...\n');
  const products = await gristGet('PRODUCTS');
  const content = await gristGet('CONTENT');
  console.log(`✅ PRODUCTS: ${products.length} แถว`);
  console.log(`✅ CONTENT: ${content.length} แถว\n`);

  const productById = new Map(products.map(p => [p.id, p]));
  const brokenRows = [];

  for (const row of content) {
    const currentId = toId(row.fields.product);
    const currentValid = currentId !== null && productById.has(currentId);
    if (!currentValid) {
      brokenRows.push({ contentId: row.id, slug: row.fields.slug, currentId });
    }
  }

  if (!brokenRows.length) {
    console.log('✅ ไม่มีแถวที่ลิงก์พัง — ไม่มีอะไรต้องลบ');
    return;
  }

  console.log(`🚨 พบ ${brokenRows.length} แถวที่ product ID ไม่มีอยู่จริง:\n`);
  for (const r of brokenRows) {
    console.log(`  CONTENT#${r.contentId}  slug="${r.slug}"  product=${r.currentId ?? '(ว่าง)'}`);
  }

  if (!CONFIRM_DELETE) {
    console.log('\n💡 นี่คือโหมดตรวจสอบเท่านั้น ยังไม่ลบอะไร');
    console.log('   รันคำสั่งนี้เพื่อลบจริง: node delete-broken-content-links.js --delete');
    return;
  }

  const ids = brokenRows.map(r => r.contentId);
  console.log(`\n🗑️  กำลังลบ ${ids.length} แถว: [${ids.join(', ')}]...`);
  await gristDelete('CONTENT', ids);
  console.log(`✅ ลบสำเร็จ ${ids.length} แถว`);
}

main().catch(err => { console.error('❌ ผิดพลาด:', err.message); process.exit(1); });
