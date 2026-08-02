const GRIST_API_KEY = process.env.GRIST_API_KEY || 'PASTE_YOUR_API_KEY_HERE';
const GRIST_DOC_ID = process.env.GRIST_DOC_ID || 'm9vaW63yyG4hk7BsXfo5Tk';
const BASE_URL = `https://docs.getgrist.com/api/docs/${GRIST_DOC_ID}`;

const AUTO_FIX_MIN_SCORE = 5;
const BORDERLINE_MARGIN = 3;
const APPLY_FIX = process.argv.includes('--fix');

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

function normalize(str) {
  return (str || '').toString().toLowerCase()
    .replace(/[^a-z0-9ก-๙\s]/gi, ' ').split(/\s+/).filter(Boolean);
}

function overlapScore(wordsA, wordsB) {
  const setB = new Set(wordsB);
  let hits = 0;
  for (const w of wordsA) { if (w.length < 3) continue; if (setB.has(w)) hits++; }
  return hits;
}

function toId(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function bestMatch(contentWords, products) {
  let best = null;
  for (const p of products) {
    const score = overlapScore(contentWords, normalize(p.fields.product_name));
    if (!best || score > best.score) best = { id: p.id, name: p.fields.product_name, score };
  }
  return best;
}

async function main() {
  console.log('📥 กำลังดึงข้อมูลจาก Grist...\n');
  const products = await gristGet('PRODUCTS');
  const content = await gristGet('CONTENT');
  console.log(`✅ PRODUCTS: ${products.length} แถว`);
  console.log(`✅ CONTENT: ${content.length} แถว\n`);

  const productById = new Map(products.map(p => [p.id, p]));
  const okRows = [], autoFixRows = [], reviewRows = [];

  for (const row of content) {
    const currentId = toId(row.fields.product);
    const currentProduct = currentId !== null ? productById.get(currentId) : null;
    const currentValid = !!currentProduct;
    const contentWords = normalize(row.fields.slug);
    const suggestion = bestMatch(contentWords, products);
    const currentScore = currentValid ? overlapScore(contentWords, normalize(currentProduct.fields.product_name)) : -1;

    // tie หรือ current ดีกว่า/เท่ากับ suggestion = ไม่ต้องแก้
    if (currentValid && suggestion && suggestion.score <= currentScore) { okRows.push(row); continue; }

    const mismatch = {
      contentId: row.id, slug: row.fields.slug, currentId, currentValid,
      currentName: currentValid ? currentProduct.fields.product_name : '(ไม่พบ - ID นี้ไม่มีอยู่จริง)',
      currentScore,
      suggestedId: suggestion ? suggestion.id : null,
      suggestedName: suggestion ? suggestion.name : null,
      suggestedScore: suggestion ? suggestion.score : -1,
    };

    const meetsMinScore = mismatch.suggestedScore >= AUTO_FIX_MIN_SCORE;
    const scoreMargin = mismatch.suggestedScore - mismatch.currentScore;
    const safeToAutoFix = meetsMinScore && (!currentValid || scoreMargin >= BORDERLINE_MARGIN);

    if (safeToAutoFix) autoFixRows.push(mismatch); else reviewRows.push(mismatch);
  }

  console.log('='.repeat(90));
  console.log(`สรุป: ตรงกันแล้ว ${okRows.length} | แก้อัตโนมัติได้ ${autoFixRows.length} | ต้องเช็คมือ ${reviewRows.length}`);
  console.log('='.repeat(90));

  if (autoFixRows.length) {
    console.log(`\n✅ พร้อมแก้อัตโนมัติ (score ≥ ${AUTO_FIX_MIN_SCORE}, ไม่ใช่ borderline):\n`);
    for (const m of autoFixRows) {
      console.log(`CONTENT#${m.contentId}  slug="${m.slug}"`);
      console.log(`  ตอนนี้:   product=${m.currentId} (${m.currentName})  [score=${m.currentScore}]`);
      console.log(`  จะแก้เป็น: product=${m.suggestedId} (${m.suggestedName})  [score=${m.suggestedScore}]`);
      console.log('-'.repeat(90));
    }
  }

  if (reviewRows.length) {
    console.log(`\n⚠️  ต้องเช็คมือก่อน (score ต่ำกว่าเกณฑ์ หรือ borderline):\n`);
    for (const m of reviewRows) {
      console.log(`CONTENT#${m.contentId}  slug="${m.slug}"`);
      console.log(`  ตอนนี้:   product=${m.currentId} (${m.currentName})  [score=${m.currentScore}]`);
      console.log(`  แนะนำ:    product=${m.suggestedId} (${m.suggestedName})  [score=${m.suggestedScore}]`);
      console.log('-'.repeat(90));
    }
  }

  if (!APPLY_FIX) {
    console.log('\n💡 โหมดตรวจสอบเท่านั้น รันคำสั่งนี้เพื่อแก้เฉพาะแถวที่มั่นใจ:');
    console.log('   node fix-content-product-links.js --fix');
    return;
  }

  if (!autoFixRows.length) { console.log('\n✅ ไม่มีแถวไหนที่มั่นใจพอจะแก้อัตโนมัติ'); return; }

  console.log(`\n🔧 กำลังแก้ ${autoFixRows.length} แถว...`);
  const records = autoFixRows.map(m => ({ id: m.contentId, fields: { product: m.suggestedId } }));
  await gristPatch('CONTENT', records);
  console.log(`✅ แก้ไขสำเร็จ ${autoFixRows.length} แถว`);
  if (reviewRows.length) console.log(`⚠️  เหลืออีก ${reviewRows.length} แถวที่ยังต้องเช็คมือใน Grist`);
    process.exitCode = 2;
}

main().catch(err => { console.error('❌ ผิดพลาด:', err.message); process.exit(1); });
