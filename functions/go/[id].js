/**
 * db.js — D1 compatibility shim for grist.js (Worker "af")
 * ---------------------------------------------------------
 * DRAFT — ยังไม่ได้ทดสอบจริงบน D1 ต้อง review ก่อน deploy
 *
 * เป้าหมาย: export ฟังก์ชันชื่อ/signature เดียวกับ grist.js เดิม เท่าที่
 * import.js, pipeline.js, publish.js, distribute.js, admin.js เรียกใช้จริง
 * (เช็ค import statement ครบทั้ง 5 ไฟล์แล้ว — ไม่ export อะไรเกินความจำเป็น
 * ที่ไม่มีใครเรียก เช่น TABLE_DEFS, findProductsTableId, handleSchema ฯลฯ
 * ของเดิมไม่ได้ถูก import ที่ไหนเลยใน 5 ไฟล์นี้ จึงตัดออกจาก db.js —
 * ถ้ามีไฟล์อื่น (เช่น worker.js/index.js) เรียกฟังก์ชันพวกนี้อยู่ ต้องแจ้ง
 * เพิ่ม ยังไม่ได้ implement ในไฟล์นี้)
 *
 * ⚠️ ASSUMPTION ที่ต้อง confirm ก่อน deploy จริง (ดู comment แต่ละจุดด้วย):
 * 1. ✅ ปิดแล้ว (2026-09-05) — เช็ค SELECT sql FROM sqlite_master WHERE
 *    name='content' แบบเต็มแล้ว ตรงกับ TABLE_GRIST_COLUMNS.CONTENT ด้านล่าง
 *    เป๊ะทุกคอลัมน์ ไม่ต้องแก้อะไรเพิ่ม
 * 2. AI_PUBLISH ↔ publish_log เป็นคนละ data shape กันโดยสิ้นเชิง (wide vs
 *    log) — pivot logic ด้านล่างเป็นการออกแบบใหม่ทั้งหมด ไม่ใช่แค่ shim
 *    ต้องทดสอบเคส publish.js (สร้างแถวแรก) และ distribute.js (patch
 *    ทีละแพลตฟอร์ม) แยกกันให้ครบก่อน deploy จริง
 *    ⚠️ อัปเดต 2026-09-05: ALTER TABLE 3 คำสั่งรันผ่านแล้ว
 *    (products.published_at, products.channels, publish_log.post_id)
 *    — writeAiPublishFields() แก้ให้ใช้ 3 คอลัมน์นี้จริงแล้ว (ไม่ทิ้งข้อมูล/
 *    ไม่ยัด post_id ลง note อีกต่อไป) แต่ยัง**ไม่ได้ทดสอบจริง** บน D1 —
 *    ต้องทดสอบทั้งเคส publish.js (สร้างแถวแรก, เขียน published_at/channels
 *    เข้า products) และ distribute.js (patch ทีละแพลตฟอร์ม, เขียน post_id
 *    เข้า publish_log) ก่อน deploy จริง
 * 3. image_source / is_screenshot ถูกจัดเป็น "tracking column" เพิ่มจาก
 *    TRACKING_COLUMNS เดิม (เพราะเป็น metadata การจัดการรูป ไม่ใช่ product
 *    fact ที่ควรโผล่ใน AI prompt ผ่าน productContext()) — ถ้าไม่ต้องการ
 *    แบบนี้ บอกได้ จะเอาออก
 * 4. category_th ไม่ถือเป็น tracking column (เป็น product fact จริงที่ AI
 *    เขียน) — ยังคงโผล่ใน productContext() ตามปกติ
 * 5. ⚠️ เพิ่มใหม่ (2026-09-08): MARKETS เป็นตารางเดี่ยว ไม่มี FK ขาเข้าจาก
 *    products (ตรงข้ามกับ CONTENT/SOCIAL ที่มี product_id) จึงไม่ต้อง alias
 *    ใดๆ — ต้องรัน CREATE TABLE markets ใน D1 เองก่อน (ดู market-discovery.js
 *    migration notes) เพราะ ensureSchema() ของไฟล์นี้ไม่ auto-create ตาราง
 *    ให้เหมือน Grist เดิม
 * 6. ⚠️ เพิ่มใหม่ (2026-09-08): handleDemandCheck อยู่ใน admin.js ไม่ได้
 *    อยู่ใน db.js — ไฟล์นี้ไม่มีการเปลี่ยนแปลงจาก demand-check feature
 *    (admin.js ใช้ฟังก์ชัน fetchTableRecords / gristFetch จาก db.js ตามปกติ
 *    ผ่าน import ที่มีอยู่แล้ว)
 *
 * 🔧 GRAVITY FIX (2026-09-09): Error 1102 (Worker exceeded resource limits)
 *    บน /api/status — สาเหตุคือ fetchTableRecords() เดิมทำ
 *    `SELECT * FROM table` แบบไม่มี WHERE เลย แล้วค่อยกรองหา productId
 *    เดียวทีหลังด้วย .find() ใน JS ทำให้ทุกครั้งที่เช็คสถานะสินค้า 1 ชิ้น
 *    ต้องดึงข้อมูลทั้งตาราง (AI_ANALYSIS/CONTENT/SOCIAL/ฯลฯ) เข้ามาทั้งก้อน
 *    ก่อน — พอข้อมูลเยอะขึ้นก็ชน CPU/memory limit ของ Worker
 *    แก้โดย:
 *      1. เพิ่ม fetchRecordsByProduct(env, gristTableId, productId) — query
 *         แบบมี `WHERE product(_id) = ?` ตรงๆ ใน D1 เลย ดึงมาแค่ไม่กี่แถว
 *      2. แก้ fetchRecord() ให้ query ด้วย `WHERE id = ?` ตรงๆ แทนการดึง
 *         ทั้งตารางมา .find() เหมือนเดิม
 *    fetchTableRecords() ของเดิมยังคงอยู่เหมือนเดิมทุกประการ (ยังจำเป็น
 *    สำหรับ handleCheckOrphans / handleCleanOrphans / handleMigrateImages
 *    ที่ต้อง scan ทั้งตารางจริงๆ) — เปลี่ยนแค่จุดที่รู้ productId อยู่แล้ว
 *    ให้ไป query แบบ filtered แทน ดู admin.js -> handleStatus
 *
 * 🔧 GRAVITY FIX (2026-09-10): เพิ่ม incrementAnalyticsCounter() — แก้ race
 *    condition ใน analytics.js (handleTrackClick/View/Conversion) ที่เดิม
 *    ใช้ pattern "fetchTableRecords ทั้งตาราง -> find -> INSERT หรือ
 *    UPDATE" ซึ่งไม่ atomic เลย ถ้ามี request เข้าพร้อมกัน (บอทยิงรัว/user
 *    ดับเบิลคลิก) ทั้งคู่จะเห็นสภาพตารางเดียวกันตอน SELECT แล้วต่างคนต่าง
 *    INSERT แถวใหม่แยกกัน (เพราะ ai_analytics ไม่มี UNIQUE constraint บน
 *    product มาก่อน) เกิดแถวซ้ำ ตัวเลขที่ dashboard แสดงเลยกลายเป็นผลรวม
 *    ของแถวซ้ำ ไม่ใช่ค่าจริง (เคสจริงที่เจอ: Product 104 = 193 คลิก)
 *    แก้โดยใช้ SQLite UPSERT (INSERT ... ON CONFLICT DO UPDATE) ซึ่ง
 *    atomic ในตัวของมันเอง — ⚠️ ต้องรัน migration
 *    001_dedupe_ai_analytics.sql ก่อน (เพิ่ม UNIQUE INDEX บน
 *    ai_analytics.product) ไม่งั้น ON CONFLICT จะไม่มี constraint ให้ชน
 *    เลยไม่มีผลอะไร — analytics.js ควรเปลี่ยนไปเรียกฟังก์ชันนี้แทนการทำ
 *    fetchTableRecords + gristCreateRecords/gristUpdateRecords แบบเดิม
 */

// =======================================================================
// BASIC HELPERS (เหมือนเดิมทุกตัว ไม่มี Grist logic ปนอยู่)
// =======================================================================

export function json200(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export function nowIso() { return new Date().toISOString(); }

export function humanLabel(colId) {
  return colId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function requireDb(env) {
  if (!env.DB) {
    throw new Error('ยังไม่ได้ผูก D1 binding (env.DB) บน Worker "af" นี้ — ไปตั้งใน Worker settings → Bindings ก่อน');
  }
}

// =======================================================================
// TRACKING_COLUMNS — เหมือนเดิม + เพิ่ม 2 คอลัมน์ที่มาทีหลัง (ดู ASSUMPTION 3)
// =======================================================================

export const TRACKING_COLUMNS = [
  { id: 'pipeline_status' },
  { id: 'pipeline_step' },
  { id: 'pipeline_error' },
  { id: 'source_url' },
  { id: 'updated_at' },
  { id: 'image_rehost_status' },
  { id: 'gallery_image_urls' },
  { id: 'legacy_sync_step' },
  { id: 'legacy_sync_data' },
  { id: 'image_source' },   // ⚠️ เพิ่มใหม่ — ดู ASSUMPTION 3
  { id: 'is_screenshot' }   // ⚠️ เพิ่มใหม่ — ดู ASSUMPTION 3
];

// =======================================================================
// FIELD MAPS — Grist-style field name (สิ่งที่โค้ดปลายทางเห็นใน .fields)
// ↔ D1 column name จริง ตารางไหนไม่มี alias แปลว่าชื่อตรงกันเป๊ะอยู่แล้ว
// =======================================================================

// ตารางที่ map ตรงๆ แบบ table เดียว ไม่มี pivot (products ไม่มี FK ขาเข้า
// จึงไม่ต้อง alias 'product'/'product_id')
const SIMPLE_TABLES = {
  // Grist table id -> { d1Table, aliases: { gristKey: d1Column } }
  PRODUCTS: {
    d1Table: 'products',
    aliases: {} // ชื่อคอลัมน์ตรงกันหมดตาม schema dump จริง
  },
  AI_ANALYSIS: {
    d1Table: 'ai_analysis',
    aliases: { product: 'product_id', summary: 'product_summary' } // ⚠️ summary<->product_summary ต่างชื่อจริง (เห็นจาก schema dump)
  },
  KEYWORDS: {
    d1Table: 'keywords',
    aliases: {} // ⚠️ 2026-09-05: ยืนยันจาก schema dump จริง — คอลัมน์ชื่อ "product" เฉยๆ (ไม่ใช่ product_id แบบ content/social/ai_analysis เพราะสร้างคนละช่วงเวลากัน) ไม่ต้อง alias
  },
  CONTENT: {
    d1Table: 'content',
    aliases: { product: 'product_id' } // ดู ASSUMPTION 1 เรื่องคอลัมน์ที่ยังไม่ confirm เต็ม
  },
  SOCIAL: {
    d1Table: 'social',
    aliases: { product: 'product_id' }
  },
  AI_MEDIA: {
    d1Table: 'ai_media',
    aliases: {} // ⚠️ 2026-09-05: ยืนยันจาก schema dump จริง — คอลัมน์ชื่อ "product" เฉยๆ เหมือน KEYWORDS ไม่ต้อง alias
  },
  AI_ANALYTICS: {
    d1Table: 'ai_analytics',
    aliases: {} // ⚠️ 2026-09-05: ยืนยันจาก schema dump จริง — คอลัมน์ชื่อ "product" เฉยๆ เหมือน KEYWORDS/AI_MEDIA ไม่ต้อง alias
  },
  MARKETS: {
    d1Table: 'markets',
    aliases: {} // ⚠️ เพิ่มใหม่ (2026-09-08) — ชื่อคอลัมน์ตรงกันหมด ไม่มี Ref ไปตาราง PRODUCTS (ดู ASSUMPTION 5)
  }
  // AI_PUBLISH ตั้งใจไม่ใส่ในนี้ — จัดการแยกทั้งหมดด้านล่าง (pivot)
};

// ทุก Grist-style key ของแต่ละตาราง (ใช้สร้าง column list ให้
// buildTableColumns/buildTableColumnsLite และใช้ทำ reverse-alias ตอน insert/update)
const TABLE_GRIST_COLUMNS = {
  PRODUCTS: [
    { colId: 'product_name', type: 'Text' },
    { colId: 'brand', type: 'Text' },
    { colId: 'category', type: 'Text' },
    { colId: 'affiliate_link', type: 'Text' },
    { colId: 'price', type: 'Text' },
    { colId: 'image_url', type: 'Text' },
    { colId: 'rating', type: 'Numeric' },
    { colId: 'status', type: 'Text' },
    { colId: 'pipeline_status', type: 'Choice', choices: ['imported', 'enriching', 'enriched', 'error', 'published'] },
    { colId: 'pipeline_step', type: 'Int' },
    { colId: 'pipeline_error', type: 'Text' },
    { colId: 'source_url', type: 'Text' },
    { colId: 'updated_at', type: 'Text' },
    { colId: 'legacy_sync_step', type: 'Int' },
    { colId: 'legacy_sync_data', type: 'Text' },
    { colId: 'image_rehost_status', type: 'Text' },
    { colId: 'gallery_image_urls', type: 'Text' },
    { colId: 'image_source', type: 'Text' },
    { colId: 'is_screenshot', type: 'Bool' },
    { colId: 'category_th', type: 'Text' }
  ],
  AI_ANALYSIS: [
    { colId: 'product', type: 'Ref:PRODUCTS' },
    { colId: 'language', type: 'Choice', choices: ['th', 'en'] },
    { colId: 'summary', type: 'Text' },
    { colId: 'brand', type: 'Text' },
    { colId: 'category', type: 'Text' },
    { colId: 'specifications', type: 'Text' },
    { colId: 'features', type: 'Text' },
    { colId: 'pros', type: 'Text' },
    { colId: 'cons', type: 'Text' },
    { colId: 'target_audience', type: 'Text' },
    { colId: 'estimated_commission', type: 'Text' },
    { colId: 'generated_at', type: 'Text' }
  ],
  KEYWORDS: [
    { colId: 'product', type: 'Ref:PRODUCTS' },
    { colId: 'primary_keyword', type: 'Text' },
    { colId: 'supporting_keywords', type: 'Text' },
    { colId: 'keywords', type: 'Text' },
    { colId: 'search_intent', type: 'Text' },
    { colId: 'long_tail', type: 'Text' },
    { colId: 'comparison_keywords', type: 'Text' },
    { colId: 'problem_keywords', type: 'Text' },
    { colId: 'best_keywords', type: 'Text' },
    { colId: 'review_keywords', type: 'Text' },
    { colId: 'price_keywords', type: 'Text' },
    { colId: 'alternative_keywords', type: 'Text' },
    { colId: 'faq_keywords', type: 'Text' },
    { colId: 'generated_at', type: 'Text' }
  ],
  CONTENT: [
    { colId: 'product', type: 'Ref:PRODUCTS' },
    { colId: 'language', type: 'Choice', choices: ['th', 'en'] },
    { colId: 'buy_link', type: 'Text' },
    { colId: 'slug', type: 'Text' },
    { colId: 'seo_title', type: 'Text' },
    { colId: 'meta_description', type: 'Text' },
    { colId: 'primary_keyword', type: 'Text' },
    { colId: 'tags', type: 'Text' },
    { colId: 'faq', type: 'Text' },
    { colId: 'blog_draft', type: 'Text' },
    { colId: 'comparison', type: 'Text' },
    { colId: 'alternatives', type: 'Text' },
    { colId: 'review', type: 'Text' },
    { colId: 'buying_guide', type: 'Text' },
    { colId: 'blog_outline', type: 'Text' },
    { colId: 'generated_at', type: 'Text' },
    { colId: 'quality_score', type: 'Numeric' },
    { colId: 'quality_tier', type: 'Text' },
    { colId: 'quality_warnings', type: 'Text' }
  ],
  SOCIAL: [
    { colId: 'product', type: 'Ref:PRODUCTS' },
    { colId: 'language', type: 'Choice', choices: ['th', 'en'] },
    { colId: 'buy_link', type: 'Text' },
    { colId: 'facebook_post', type: 'Text' },
    { colId: 'threads_post', type: 'Text' },
    { colId: 'x_post', type: 'Text' },
    { colId: 'pinterest_post', type: 'Text' },
    { colId: 'telegram_post', type: 'Text' },
    { colId: 'discord_post', type: 'Text' },
    { colId: 'mastodon_post', type: 'Text' },
    { colId: 'tumblr_post', type: 'Text' },
    { colId: 'cta', type: 'Text' },
    { colId: 'youtube_script', type: 'Text' },
    { colId: 'shorts_script', type: 'Text' },
    { colId: 'affiliate_cta', type: 'Text' },
    { colId: 'generated_at', type: 'Text' }
  ],
  AI_MEDIA: [
    { colId: 'product', type: 'Ref:PRODUCTS' },
    { colId: 'image_prompt', type: 'Text' },
    { colId: 'thumbnail_prompt', type: 'Text' },
    { colId: 'generated_at', type: 'Text' }
  ],
  AI_ANALYTICS: [
    { colId: 'product', type: 'Ref:PRODUCTS' },
    { colId: 'views', type: 'Int' },
    { colId: 'clicks', type: 'Int' },
    { colId: 'conversions', type: 'Int' },
    { colId: 'last_updated', type: 'Text' }
  ],
  // MARKETS: ⚠️ เพิ่มใหม่ (2026-09-08) — ตาราง Market Discovery ดู ASSUMPTION 5
  MARKETS: [
    { colId: 'name', type: 'Text' },
    { colId: 'parent_market_id', type: 'Int' },
    { colId: 'level', type: 'Choice', choices: ['market', 'sub_market'] },
    { colId: 'country', type: 'Text' },
    { colId: 'category', type: 'Text' },
    { colId: 'score_demand', type: 'Int' },
    { colId: 'score_product_depth', type: 'Int' },
    { colId: 'score_money', type: 'Int' },
    { colId: 'score_commission', type: 'Int' },
    { colId: 'score_repeat', type: 'Int' },
    { colId: 'score_problem_intensity', type: 'Int' },
    { colId: 'score_competition', type: 'Int' },
    { colId: 'score_content_potential', type: 'Int' },
    { colId: 'score_gravity_fit', type: 'Int' },
    { colId: 'score_total', type: 'Int' },
    { colId: 'content_angles', type: 'Text' },
    { colId: 'ai_reasoning', type: 'Text' },
    { colId: 'status', type: 'Choice', choices: ['candidate', 'selected', 'archived'] },
    { colId: 'search_run_id', type: 'Text' },
    { colId: 'created_at', type: 'Text' }
  ],
  // AI_PUBLISH: column list เป็น "virtual" — ประกอบขึ้นจาก publish_log
  // ต่อแพลตฟอร์ม ไม่ได้ map ตรงกับ D1 table ไหนตารางเดียว ดู pivot ด้านล่าง
  AI_PUBLISH: [
    { colId: 'status', type: 'Choice', choices: ['draft', 'published'] },
    { colId: 'published_at', type: 'Text' },
    { colId: 'channels', type: 'Text' },
    { colId: 'fb_status', type: 'Choice', choices: ['pending', 'posted', 'error'] },
    { colId: 'fb_post_id', type: 'Text' }, { colId: 'fb_post_url', type: 'Text' },
    { colId: 'fb_posted_at', type: 'Text' }, { colId: 'fb_error', type: 'Text' },
    { colId: 'threads_status', type: 'Choice', choices: ['pending', 'posted', 'error'] },
    { colId: 'threads_post_id', type: 'Text' }, { colId: 'threads_post_url', type: 'Text' },
    { colId: 'threads_posted_at', type: 'Text' }, { colId: 'threads_error', type: 'Text' },
    { colId: 'tg_status', type: 'Choice', choices: ['pending', 'posted', 'error'] },
    { colId: 'tg_post_id', type: 'Text' }, { colId: 'tg_posted_at', type: 'Text' }, { colId: 'tg_error', type: 'Text' },
    { colId: 'discord_status', type: 'Choice', choices: ['pending', 'posted', 'error'] },
    { colId: 'discord_posted_at', type: 'Text' }, { colId: 'discord_error', type: 'Text' },
    { colId: 'mastodon_status', type: 'Choice', choices: ['pending', 'posted', 'error'] },
    { colId: 'mastodon_post_id', type: 'Text' }, { colId: 'mastodon_post_url', type: 'Text' },
    { colId: 'mastodon_posted_at', type: 'Text' }, { colId: 'mastodon_error', type: 'Text' },
    { colId: 'tumblr_status', type: 'Choice', choices: ['pending', 'posted', 'error'] },
    { colId: 'tumblr_post_id', type: 'Text' }, { colId: 'tumblr_post_url', type: 'Text' },
    { colId: 'tumblr_posted_at', type: 'Text' }, { colId: 'tumblr_error', type: 'Text' },
    { colId: 'x_status', type: 'Choice', choices: ['pending', 'posted', 'error'] },
    { colId: 'x_post_id', type: 'Text' }, { colId: 'x_post_url', type: 'Text' },
    { colId: 'x_posted_at', type: 'Text' }, { colId: 'x_error', type: 'Text' },
    { colId: 'pinterest_status', type: 'Choice', choices: ['pending', 'posted', 'error'] },
    { colId: 'pinterest_pin_id', type: 'Text' }, { colId: 'pinterest_pin_url', type: 'Text' },
    { colId: 'pinterest_posted_at', type: 'Text' }, { colId: 'pinterest_error', type: 'Text' },
    { colId: 'web_status', type: 'Choice', choices: ['pending', 'posted', 'error'] },
    { colId: 'web_url', type: 'Text' }, { colId: 'web_posted_at', type: 'Text' }, { colId: 'web_error', type: 'Text' },
    { colId: 'youtube_status', type: 'Choice', choices: ['pending', 'posted', 'error'] },
    { colId: 'youtube_post_id', type: 'Text' }, { colId: 'youtube_post_url', type: 'Text' },
    { colId: 'youtube_posted_at', type: 'Text' }, { colId: 'youtube_error', type: 'Text' }
  ]
};

// map คำนำหน้าฟิลด์ AI_PUBLISH -> ชื่อ channel ใน publish_log.channel
// (derive จาก distribute.js/publish.js ที่ใช้ prefix พวกนี้จริง)
const AI_PUBLISH_PREFIX_TO_CHANNEL = {
  fb: 'facebook',
  threads: 'threads',
  tg: 'telegram',
  discord: 'discord',
  mastodon: 'mastodon',
  tumblr: 'tumblr',
  x: 'x',
  pinterest: 'pinterest',
  web: 'website',
  youtube: 'youtube'
};

// =======================================================================
// ROW <-> FIELDS conversion (generic, ใช้กับตารางใน SIMPLE_TABLES)
// =======================================================================

function rowToFields(gristTableId, row) {
  const { aliases } = SIMPLE_TABLES[gristTableId];
  const reverseAlias = {};
  for (const [gristKey, d1Col] of Object.entries(aliases)) reverseAlias[d1Col] = gristKey;

  const fields = {};
  for (const [d1Col, value] of Object.entries(row)) {
    if (d1Col === 'id') continue;
    const gristKey = reverseAlias[d1Col] || d1Col;
    fields[gristKey] = value;
  }
  return fields;
}

function fieldsToRow(gristTableId, fields) {
  const { aliases } = SIMPLE_TABLES[gristTableId];
  const row = {};
  for (const [gristKey, value] of Object.entries(fields)) {
    const d1Col = aliases[gristKey] || gristKey;
    row[d1Col] = value;
  }
  return row;
}

// =======================================================================
// AI_PUBLISH <-> publish_log PIVOT — ดู ASSUMPTION 2 ในหัวไฟล์
// =======================================================================

// อ่าน: รวมทุกแถว publish_log ของ product เดียว + คอลัมน์ product-level
// (published_at/channels ที่เพิ่งเพิ่มใน products) ให้กลายเป็น "1 fields
// object" แบบ wide เหมือน AI_PUBLISH เดิม — ใช้แถวล่าสุดต่อ channel
async function buildAiPublishFieldsForProduct(env, productId) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM publish_log WHERE product_id = ? ORDER BY id ASC`
  ).bind(productId).all();

  const latestByChannel = {};
  for (const row of results) {
    latestByChannel[row.channel] = row; // เดินตามลำดับ id ASC ตัวท้ายสุดจะทับตัวก่อนหน้าเสมอ = ล่าสุด
  }

  // product-level fields (status/published_at/channels) ตอนนี้เก็บใน
  // products table เอง (คอลัมน์ published_at/channels เพิ่มใหม่) —
  // "status" ระดับสินค้าไม่มีคอลัมน์แยก แต่ derive จาก pipeline_status
  // ('published' ตรงกับความหมายเดียวกัน) แทนการเพิ่มคอลัมน์ซ้ำซ้อน
  const productRow = await env.DB.prepare(
    `SELECT published_at, channels, pipeline_status FROM products WHERE id = ?`
  ).bind(productId).first();

  const fields = {
    product: productId,
    status: productRow && productRow.pipeline_status === 'published' ? 'published' : 'draft',
    published_at: productRow ? productRow.published_at : null,
    channels: productRow ? productRow.channels : null
  };

  for (const [prefix, channel] of Object.entries(AI_PUBLISH_PREFIX_TO_CHANNEL)) {
    const row = latestByChannel[channel];
    if (!row) continue;
    if (prefix === 'web') {
      fields.web_status = row.status;
      fields.web_url = row.live_url;
      fields.web_posted_at = row.published_at;
      fields.web_error = row.status === 'error' ? row.note : '';
    } else if (prefix === 'discord' || prefix === 'tg') {
      fields[`${prefix}_status`] = row.status;
      fields[`${prefix}_posted_at`] = row.published_at;
      fields[`${prefix}_error`] = row.status === 'error' ? row.note : '';
    } else {
      fields[`${prefix}_status`] = row.status;
      fields[`${prefix}_post_id`] = row.post_id; // ✅ คอลัมน์แยกแล้ว (ALTER TABLE เพิ่มแล้ว)
      fields[`${prefix}_post_url`] = row.live_url;
      fields[`${prefix}_posted_at`] = row.published_at;
      fields[`${prefix}_error`] = row.status === 'error' ? row.note : '';
    }
  }
  return fields;
}

// เขียน: รับ fields object แบบ wide (จาก upsertLinkedRecord ใน pipeline.js
// หรือ statusFields ใน distribute.js) แล้วแตกเป็นแถว publish_log แยกตาม
// channel ที่ปรากฏใน fields จริง (เดา channel จาก key prefix ที่ตรงกับ
// AI_PUBLISH_PREFIX_TO_CHANNEL) — insert แถวใหม่เสมอ (log แบบ append,
// ไม่ update ทับของเดิม) ยกเว้น key ที่เป็น "product-level" ล้วนๆ (status,
// published_at, channels — จากตอน publish.js สร้างแถวแรก) จะไม่ insert
// เป็น publish_log (ไม่มี channel ชัดเจนให้ผูก) — เก็บไว้ที่ products
// table แทนไม่ได้เพราะไม่มีคอลัมน์รองรับ ⚠️ ต้องตัดสินใจว่าจะทิ้งข้อมูลนี้
// (แค่ log ว่า publish สำเร็จ ไม่มีที่เก็บ status/published_at/channels
// ระดับสินค้าใน D1 เลยตอนนี้) หรือเพิ่มคอลัมน์ใน products
async function writeAiPublishFields(env, productId, fields) {
  const rowsToInsert = [];
  const detectedPrefixes = new Set();

  for (const key of Object.keys(fields)) {
    for (const prefix of Object.keys(AI_PUBLISH_PREFIX_TO_CHANNEL)) {
      if (key === `${prefix}_status` || key === `${prefix}_error` ||
          key === `${prefix}_post_id` || key === `${prefix}_post_url` ||
          key === `${prefix}_posted_at` || key === `${prefix}_url`) {
        detectedPrefixes.add(prefix);
      }
    }
  }

  if (detectedPrefixes.size === 0) {
    // เข้าเงื่อนไข "product-level only" (สร้างแถวแรกจาก publish.js) —
    // ✅ ALTER TABLE เพิ่ม products.published_at / products.channels แล้ว
    // (ยืนยันรันผ่านจริง 2026-09-05) เขียนตรงเข้า products แทนการทิ้งข้อมูล
    const cols = [];
    const vals = [];
    if ('published_at' in fields) { cols.push('published_at'); vals.push(fields.published_at ?? null); }
    if ('channels' in fields) { cols.push('channels'); vals.push(fields.channels ?? null); }
    // 'status' ไม่มีคอลัมน์แยกใน products ตามที่ออกแบบไว้ (derive จาก
    // pipeline_status แทน — ดู buildAiPublishFieldsForProduct) จึงไม่เขียนที่นี่
    if (cols.length === 0) return;
    const setClause = cols.map(c => `${c} = ?`).join(', ');
    await env.DB.prepare(`UPDATE products SET ${setClause} WHERE id = ?`)
      .bind(...vals, productId).run();
    return;
  }

  for (const prefix of detectedPrefixes) {
    const channel = AI_PUBLISH_PREFIX_TO_CHANNEL[prefix];
    const status = fields[`${prefix}_status`] || 'pending';
    const liveUrl = fields[`${prefix}_post_url`] || fields[`${prefix}_url`] || fields.web_url || null;
    const publishedAt = fields[`${prefix}_posted_at`] || null;
    const error = fields[`${prefix}_error`] || '';
    const postId = fields[`${prefix}_post_id`] || null;
    // ✅ publish_log.post_id เป็นคอลัมน์จริงแล้ว (ALTER TABLE เพิ่มแล้ว,
    // ยืนยันรันผ่าน 2026-09-05) — เก็บ postId ที่นี่โดยตรง note เก็บแค่
    // error message เท่านั้น (ไม่ต้อง fallback เก็บ postId ใน note อีกต่อไป)
    const note = error || '';

    rowsToInsert.push({ product_id: productId, channel, status, live_url: liveUrl, published_at: publishedAt, post_id: postId, note });
  }

  for (const row of rowsToInsert) {
    await env.DB.prepare(
      `INSERT INTO publish_log (product_id, channel, status, live_url, published_at, post_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(row.product_id, row.channel, row.status, row.live_url, row.published_at, row.post_id, row.note).run();
  }
}

// =======================================================================
// PUBLIC API — ต้องมีฟังก์ชันครบตามที่ 5 ไฟล์ import จริง
// =======================================================================

export async function ensureSchema(env) {
  requireDb(env);
  // D1 schema สร้างไว้หมดแล้วตั้งแต่เฟส 1 migrate — ไม่มี auto-create/
  // auto-alter เหมือน Grist เดิม (ensureSchema เดิมสร้างตาราง/คอลัมน์ที่
  // ขาดอัตโนมัติ) ถ้า TABLE_GRIST_COLUMNS ด้านบนถูกแก้ให้มีคอลัมน์ใหม่ใน
  // อนาคต ต้องไปสร้างคอลัมน์จริงใน D1 เองก่อนเสมอ (ALTER TABLE) — ฟังก์ชัน
  // นี้แค่ตรวจว่า products table มีอยู่จริง แล้วคืนชื่อ D1 table เป็น
  // "productsTableId" (แทนที่จะเป็น Grist table id แบบสุ่ม เช่น "Table1")
  const check = await env.DB.prepare(`SELECT 1 FROM products LIMIT 1`).first().catch(() => null);
  if (check === undefined) {
    throw new Error('ตาราง products ใน D1 ไม่มีอยู่จริง หรือ query ไม่สำเร็จ — เช็ค D1 binding/schema ก่อน');
  }
  return 'PRODUCTS'; // ใช้เป็น key คงที่ตลอดทั้งระบบ แทน dynamic table id ของ Grist
}

function resolveD1TableName(gristTableId) {
  if (gristTableId === 'PRODUCTS') return 'products';
  const entry = SIMPLE_TABLES[gristTableId];
  if (entry) return entry.d1Table;
  return null; // AI_PUBLISH ไม่มี d1Table เดี่ยว — caller ต้อง handle แยก
}

export async function fetchTableRecords(env, gristTableId) {
  requireDb(env);

  if (gristTableId === 'AI_PUBLISH') {
    // ไม่มี "1 query ดึงทั้งตาราง" ที่สมเหตุสมผลสำหรับ AI_PUBLISH แบบ pivot
    // — ต้องรู้ productId ก่อนถึงจะ pivot ได้ทีละสินค้า ฟังก์ชันนี้ (ตาม
    // การใช้งานจริงใน publish.js: `fetchTableRecords(env, 'AI_ANALYTICS')`
    // ไม่เคยถูกเรียกกับ 'AI_PUBLISH' เลยจริงๆ — เช็คทั้ง 5 ไฟล์แล้วไม่มีจุด
    // ไหนเรียก fetchTableRecords(env, 'AI_PUBLISH') ตรงๆ (มีแต่ fetchRecord
    // ทางอ้อมผ่าน upsertLinkedRecord ซึ่งก็เรียก fetchTableRecords('AI_PUBLISH')
    // จริง! ดู pipeline.js: `const existing = await fetchTableRecords(env, tableId)`
    // เมื่อ tableId==='AI_PUBLISH' จาก publish.js's upsertLinkedRecord call)
    // → ต้องคืน "1 แถวเสมือนต่อสินค้า" โดยดึงทุก product_id ที่มีอยู่ใน
    // publish_log มา group แล้ว pivot ทีละตัว
    const { results: productIds } = await env.DB.prepare(
      `SELECT DISTINCT product_id FROM publish_log`
    ).all();
    const out = [];
    for (const { product_id } of productIds) {
      const fields = await buildAiPublishFieldsForProduct(env, product_id);
      out.push({ id: product_id, fields }); // ⚠️ ใช้ product_id เป็น "id" ของ pseudo-row เพราะ AI_PUBLISH เดิมมี 1 แถว/สินค้า
    }
    return out;
  }

  const d1Table = resolveD1TableName(gristTableId);
  if (!d1Table) throw new Error(`fetchTableRecords: ไม่รู้จักตาราง "${gristTableId}"`);

  // เรียงจากใหม่ไปเก่า (id DESC) — สำคัญกับตาราง append-only อย่าง
  // content/social/ai_analysis ที่ยังมีแถวซ้ำเก่าจากตอน migrate เฟส 1
  // (บางแถว slug/เนื้อหาไม่ตรงกับสินค้าเดียวกัน) เพราะ pipeline.js's
  // upsertLinkedRecord() ใช้ existing.find(...) หาแถวแรกที่ product+
  // language ตรงกันแล้ว PATCH ทับ — ถ้าไม่ ORDER BY จะได้แถวเก่าสุดมา
  // ก่อนเสมอ (ตามลำดับ insert จริง) แทนที่จะเป็นแถวล่าสุดที่ถูกต้อง
  //
  // ⚠️ หมายเหตุ (2026-09-09): ฟังก์ชันนี้ยังคง SELECT ทั้งตาราง โดยตั้งใจ
  // ปล่อยไว้แบบนี้เพราะยังจำเป็นสำหรับ caller ที่ต้อง scan ทุกแถวจริงๆ
  // (handleCheckOrphans / handleCleanOrphans / handleMigrateImages ใน
  // admin.js, upsertLinkedRecord ใน pipeline.js) — ถ้ารู้ productId อยู่แล้ว
  // ให้ใช้ fetchRecordsByProduct() ด้านล่างแทน อย่าลืมด้วยว่านี่คือจุดที่
  // เคยทำให้ /api/status ชน Worker resource limit (error 1102) ตอนที่ถูก
  // เรียกวนลูปทีละ productId — ดู admin.js -> handleStatus (แก้แล้ว)
  //
  // ⚠️ หมายเหตุ (2026-09-10): analytics.js เลิกเรียกฟังก์ชันนี้กับ
  // 'AI_ANALYTICS' แล้ว — เปลี่ยนไปใช้ incrementAnalyticsCounter() ด้านล่าง
  // แทน (atomic, ไม่ scan ทั้งตาราง, ไม่เกิด race condition) ฟังก์ชันนี้
  // ยังคงถูกเรียกกับ 'AI_ANALYTICS' ได้จากที่อื่นถ้าจำเป็นต้อง scan จริงๆ
  // (เช่น export ข้อมูลทั้งหมดไปดู) แต่ไม่ควรใช้เพื่อ increment ตัวนับอีก
  const { results } = await env.DB.prepare(`SELECT * FROM ${d1Table} ORDER BY id DESC`).all();
  return results.map(row => ({ id: row.id, fields: rowToFields(gristTableId, row) }));
}

// 🔧 GRAVITY FIX (2026-09-09): ใหม่ — query แบบ filtered ตรงๆ ใน D1 ด้วย
// `WHERE product(_id) = ?` แทนการดึงทั้งตารางมาแล้วกรองใน JS ทีหลัง
// ใช้แทน fetchTableRecords() ทุกจุดที่รู้ productId อยู่แล้วตั้งแต่ต้น
// (เช่น handleStatus ใน admin.js) เพื่อไม่ให้ชน CPU/memory limit ของ
// Worker เวลาตารางมีข้อมูลเยอะ — คืนค่าที่หน้าตาเหมือน fetchTableRecords()
// เป๊ะ (array ของ { id, fields }) แค่กรองมาแล้วจาก D1 เลย
export async function fetchRecordsByProduct(env, gristTableId, productId) {
  requireDb(env);
  const pid = Number(productId);
  if (!pid) throw new Error('fetchRecordsByProduct: productId ไม่ถูกต้อง');

  if (gristTableId === 'AI_PUBLISH') {
    const fields = await buildAiPublishFieldsForProduct(env, pid);
    return [{ id: pid, fields }];
  }

  const entry = SIMPLE_TABLES[gristTableId];
  if (!entry) throw new Error(`fetchRecordsByProduct: ไม่รู้จักตาราง "${gristTableId}"`);

  // หาชื่อคอลัมน์ FK จริงใน D1: ถ้ามี alias ('product' -> 'product_id') ใช้
  // ชื่อ D1 จริงตาม alias นั้น ถ้าไม่มี alias แปลว่าคอลัมน์ชื่อ 'product'
  // เฉยๆ ตรงตาม TABLE_GRIST_COLUMNS (เช่น KEYWORDS/AI_MEDIA/AI_ANALYTICS)
  const d1Col = entry.aliases.product || 'product';

  const { results } = await env.DB.prepare(
    `SELECT * FROM ${entry.d1Table} WHERE ${d1Col} = ? ORDER BY id DESC`
  ).bind(pid).all();

  return results.map(row => ({ id: row.id, fields: rowToFields(gristTableId, row) }));
}

export async function fetchRecord(env, gristTableId, recordId) {
  // 🔧 GRAVITY FIX (2026-09-09): เดิมฟังก์ชันนี้ reuse fetchTableRecords()
  // (ดึงทั้งตาราง) แล้วค่อย .find() หาแถวเดียว — เปลี่ยนเป็น query ตรงจุด
  // ด้วย `WHERE id = ?` แทน ผลลัพธ์ที่คืนกลับหน้าตาเหมือนเดิมทุกประการ
  // (null ถ้าไม่เจอ, { id, fields } ถ้าเจอ) แค่ไม่ต้องดึงทั้งตารางอีกแล้ว
  requireDb(env);
  const id = Number(recordId);
  if (!id) return null;

  if (gristTableId === 'AI_PUBLISH') {
    const fields = await buildAiPublishFieldsForProduct(env, id);
    return { id, fields };
  }

  const d1Table = resolveD1TableName(gristTableId);
  if (!d1Table) throw new Error(`fetchRecord: ไม่รู้จักตาราง "${gristTableId}"`);

  const row = await env.DB.prepare(`SELECT * FROM ${d1Table} WHERE id = ?`).bind(id).first();
  if (!row) return null;
  return { id: row.id, fields: rowToFields(gristTableId, row) };
}

// 🔧 GRAVITY FIX (2026-09-10): atomic upsert เฉพาะสำหรับ AI_ANALYTICS
// (views/clicks/conversions) — แก้ race condition ที่การอ่าน-แล้ว-เขียน
// แบบเดิมใน analytics.js เปิดช่องให้เกิดแถวซ้ำเวลามี request พร้อมกัน
// ใช้ SQLite "INSERT ... ON CONFLICT(product) DO UPDATE" ซึ่ง atomic
// ในตัวเอง ไม่มีช่องให้เกิด race ระหว่าง read กับ write อีก
//
// ⚠️ ก่อนใช้ฟังก์ชันนี้ ต้องรัน migration
// 001_dedupe_ai_analytics.sql ก่อน (เพิ่ม UNIQUE INDEX บน
// ai_analytics.product) — ถ้ายังไม่มี index นี้ ON CONFLICT จะไม่มี
// constraint ให้ชนเลย แล้วจะกลาย INSERT ซ้ำเหมือนเดิมทุกครั้งแทน
//
// field: 'views' | 'clicks' | 'conversions' — เพิ่มค่านั้น +1 ให้ product
// คืนค่า: ตัวเลขล่าสุดของ field นั้นหลังอัปเดต (เพื่อคง response shape
// เดิมที่ handleTrackClick/View เคย return เช่น { ok:true, clicks: N })
export async function incrementAnalyticsCounter(env, productId, field) {
  requireDb(env);
  const pid = Number(productId);
  if (!pid || Number.isNaN(pid)) {
    throw new Error('incrementAnalyticsCounter: productId ไม่ถูกต้อง');
  }
  if (!['views', 'clicks', 'conversions'].includes(field)) {
    throw new Error(`incrementAnalyticsCounter: field "${field}" ไม่ถูกต้อง (ต้องเป็น views/clicks/conversions)`);
  }
  const ts = nowIso();

  // ai_analytics ไม่มี alias (คอลัมน์ชื่อ "product" ตรงๆ ไม่ใช่ product_id)
  // — ดู SIMPLE_TABLES.AI_ANALYTICS ด้านบน
  await env.DB.prepare(`
    INSERT INTO ai_analytics (product, views, clicks, conversions, last_updated)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(product) DO UPDATE SET
      ${field} = ${field} + 1,
      last_updated = excluded.last_updated
  `).bind(
    pid,
    field === 'views' ? 1 : 0,
    field === 'clicks' ? 1 : 0,
    field === 'conversions' ? 1 : 0,
    ts
  ).run();

  const row = await env.DB.prepare(
    `SELECT ${field} FROM ai_analytics WHERE product = ?`
  ).bind(pid).first();

  return row ? row[field] : null;
}

export async function gristDeleteRecords(env, gristTableId, rowIds) {
  requireDb(env);
  if (!rowIds || rowIds.length === 0) return;

  if (gristTableId === 'AI_PUBLISH') {
    // rowIds ในโลก AI_PUBLISH คือ productId (ดู fetchTableRecords ด้านบน)
    for (const productId of rowIds) {
      await env.DB.prepare(`DELETE FROM publish_log WHERE product_id = ?`).bind(productId).run();
    }
    return;
  }

  const d1Table = resolveD1TableName(gristTableId);
  if (!d1Table) throw new Error(`gristDeleteRecords: ไม่รู้จักตาราง "${gristTableId}"`);

  const placeholders = rowIds.map(() => '?').join(',');
  await env.DB.prepare(`DELETE FROM ${d1Table} WHERE id IN (${placeholders})`).bind(...rowIds).run();
}

// buildTableColumns / buildTableColumnsLite: เหมือนกันทุกประการสำหรับ
// D1 backend นี้ — เหตุผลดู comment หัวไฟล์ (ref option resolution ไม่มี
// ผลต่อ sanitizeAgainstColumns ที่นี่ และ PRODUCTS เองไม่มี Ref column)
function buildColumnsInternal(gristTableId) {
  const cols = TABLE_GRIST_COLUMNS[gristTableId];
  if (!cols) throw new Error(`buildTableColumns: ไม่รู้จักตาราง "${gristTableId}"`);
  return cols.map(c => {
    const col = { colId: c.colId, label: humanLabel(c.colId), type: c.type };
    if (c.type && c.type.startsWith('Ref:')) col.refInfo = { targetTable: c.type.split(':')[1], options: [] };
    if (c.choices) col.choices = c.choices;
    return col;
  });
}

export async function buildTableColumns(env, gristTableId) {
  return buildColumnsInternal(gristTableId);
}

export async function buildTableColumnsLite(env, gristTableId) {
  return buildColumnsInternal(gristTableId);
}

// gristFetch — router แทนที่ generic REST call เดิม รองรับเฉพาะ
// pattern ที่ 5 ไฟล์นี้เรียกจริง: POST/PATCH `/tables/{tableId}/records`
// path/method อื่นที่ไม่รู้จัก -> throw ทันที (ห้าม fallback เงียบๆ)
export async function gristFetch(env, path, init = {}) {
  requireDb(env);
  const method = (init.method || 'GET').toUpperCase();
  const match = path.match(/^\/tables\/([^/]+)\/records$/);
  if (!match) {
    throw new Error(`db.js gristFetch: ไม่รู้จัก path "${path}" (method ${method}) — ต้องเพิ่ม case นี้ใน gristFetch router ก่อนใช้งาน`);
  }
  const gristTableId = match[1];
  const body = init.body ? JSON.parse(init.body) : {};
  const records = body.records || [];

  if (method === 'POST') {
    return await handleInsert(env, gristTableId, records);
  }
  if (method === 'PATCH') {
    return await handleUpdate(env, gristTableId, records);
  }
  throw new Error(`db.js gristFetch: method "${method}" ไม่รองรับสำหรับ ${path}`);
}

async function handleInsert(env, gristTableId, records) {
  if (gristTableId === 'AI_PUBLISH') {
    // import.js ไม่เคย insert ใหม่ AI_PUBLISH ตรงๆ — มาจาก
    // upsertLinkedRecord ตอนไม่เจอ existingRow เท่านั้น (publish.js ตอน
    // สร้างแถวแรก) — fields.product คือ productId เสมอในเคสนี้
    const results = [];
    for (const rec of records) {
      const productId = Number(rec.fields.product);
      await writeAiPublishFields(env, productId, rec.fields);
      results.push({ id: productId });
    }
    return { records: results };
  }

  const d1Table = resolveD1TableName(gristTableId);
  if (!d1Table) throw new Error(`handleInsert: ไม่รู้จักตาราง "${gristTableId}"`);

  const results = [];
  for (const rec of records) {
    const row = fieldsToRow(gristTableId, rec.fields);
    const cols = Object.keys(row);
    const placeholders = cols.map(() => '?').join(',');
    const res = await env.DB.prepare(
      `INSERT INTO ${d1Table} (${cols.join(',')}) VALUES (${placeholders})`
    ).bind(...cols.map(c => row[c])).run();
    results.push({ id: res.meta.last_row_id });
  }
  return { records: results };
}

async function handleUpdate(env, gristTableId, records) {
  if (gristTableId === 'AI_PUBLISH') {
    const results = [];
    for (const rec of records) {
      // rec.id คือ productId ในโลก AI_PUBLISH (ดู fetchTableRecords)
      const productId = Number(rec.id);
      await writeAiPublishFields(env, productId, rec.fields);
      results.push({ id: productId });
    }
    return { records: results };
  }

  if (gristTableId === 'PRODUCTS') {
    // updateProductPipeline ใน pipeline.js เรียกผ่านทางนี้บ่อยมาก (ทุก
    // step ของ pipeline) — update ตรงๆ ทีละ record ตาม id
    const results = [];
    for (const rec of records) {
      const row = fieldsToRow('PRODUCTS', rec.fields);
      const cols = Object.keys(row);
      if (cols.length === 0) { results.push({ id: rec.id }); continue; }
      const setClause = cols.map(c => `${c} = ?`).join(', ');
      await env.DB.prepare(`UPDATE products SET ${setClause} WHERE id = ?`)
        .bind(...cols.map(c => row[c]), rec.id).run();
      results.push({ id: rec.id });
    }
    return { records: results };
  }

  const d1Table = resolveD1TableName(gristTableId);
  if (!d1Table) throw new Error(`handleUpdate: ไม่รู้จักตาราง "${gristTableId}"`);

  const results = [];
  for (const rec of records) {
    const row = fieldsToRow(gristTableId, rec.fields);
    const cols = Object.keys(row);
    if (cols.length === 0) { results.push({ id: rec.id }); continue; }
    const setClause = cols.map(c => `${c} = ?`).join(', ');
    await env.DB.prepare(`UPDATE ${d1Table} SET ${setClause} WHERE id = ?`)
      .bind(...cols.map(c => row[c]), rec.id).run();
    results.push({ id: rec.id });
  }
  return { records: results };
}

export async function gristUpdateRecords(env, gristTableId, records) {
  if (!records || records.length === 0) return;
  return gristFetch(env, `/tables/${gristTableId}/records`, {
    method: 'PATCH',
    body: JSON.stringify({ records })
  });
}

export async function gristCreateRecords(env, gristTableId, recordsFields) {
  if (!recordsFields || recordsFields.length === 0) return { records: [] };
  return gristFetch(env, `/tables/${gristTableId}/records`, {
    method: 'POST',
    body: JSON.stringify({ records: recordsFields.map(fields => ({ fields })) })
  });
}
