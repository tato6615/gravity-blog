/**
 * grist.js — Grist REST API plumbing + schema management
 * --------------------------------------------------------
 * Everything that talks to docs.getgrist.com: low-level fetch wrapper,
 * table/column discovery, and the auto-create-tables-if-missing logic
 * (ensureSchema / TABLE_DEFS). Nothing in here knows about AI, scraping,
 * or the pipeline — it only knows how to read/write Grist tables.
 */

export const GRIST_DOC_ID = 'm9vaW63yyG4hk7BsXfo5Tk';
export const GRIST_BASE = 'https://docs.getgrist.com/api/docs';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export function json200(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS }
  });
}

export function nowIso() { return new Date().toISOString(); }

export function humanLabel(colId) {
  return colId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function requireGristConfigured(env) {
  if (!env.GRIST_API_KEY) {
    throw new Error('ยังไม่ได้ตั้งค่า GRIST_API_KEY บน Worker (ดู secret ใน Cloudflare)');
  }
}

export async function gristFetch(env, path, init = {}) {
  let res;
  try {
    res = await fetch(`${GRIST_BASE}/${GRIST_DOC_ID}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${env.GRIST_API_KEY}`,
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    });
  } catch (e) {
    throw new Error(`เชื่อมต่อ Grist ไม่สำเร็จ @ ${path}: ${e.message}`);
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`Grist ${res.status} @ ${path}: ${json.error || text || res.statusText}`);
  return json;
}

// Grist's REST API deletes by posting a plain array of row ids (not wrapped
// in {records: ...} like create/update) to /data/delete.
export async function gristDeleteRecords(env, tableId, rowIds) {
  if (!rowIds || rowIds.length === 0) return;
  await gristFetch(env, `/tables/${tableId}/data/delete`, {
    method: 'POST',
    body: JSON.stringify(rowIds)
  });
}

export async function fetchTableRecords(env, tableId) {
  const res = await gristFetch(env, `/tables/${tableId}/records`);
  return res.records || [];
}

export async function fetchRecord(env, tableId, recordId) {
  const records = await fetchTableRecords(env, tableId);
  return records.find(r => r.id === Number(recordId)) || null;
}

export async function buildTableColumns(env, tableId) {
  const colsRes = await gristFetch(env, `/tables/${tableId}/columns`);
  const rawCols = (colsRes.columns || []).filter(
    c => c.id !== 'manualSort' && c.id !== 'id' && !c.fields.isFormula
  );
  const columns = [];
  for (const c of rawCols) {
    const type = c.fields.type || 'Text';
    const label = c.fields.label || humanLabel(c.id);
    const col = { colId: c.id, label, type };
    if (type.startsWith('Ref:')) {
      const targetTable = type.split(':')[1];
      col.refInfo = { targetTable, options: [] };
      try {
        const refCols = await gristFetch(env, `/tables/${targetTable}/columns`);
        const refColList = (refCols.columns || []).filter(
          rc => rc.id !== 'manualSort' && rc.id !== 'id' && !rc.fields.isFormula
        );
        const isTextType = rc => {
          const t = rc.fields.type || 'Text';
          return t === 'Text' || t.startsWith('Text:');
        };
        const nameLike = refColList.find(rc =>
          /name|title|label/i.test(rc.id) || /name|title|label/i.test(rc.fields.label || '')
        );
        const firstText = refColList.find(isTextType);
        const labelColId = (nameLike || firstText || refColList[0] || {}).id;
        const refRecords = await gristFetch(env, `/tables/${targetTable}/records`);
        col.refInfo.options = (refRecords.records || []).map(r => ({
          value: r.id,
          label: labelColId ? (r.fields[labelColId] ?? `#${r.id}`) : `#${r.id}`
        }));
      } catch (e) { /* leave empty, caller falls back gracefully */ }
    } else if (type === 'Choice' && c.fields.widgetOptions) {
      try {
        const wo = JSON.parse(c.fields.widgetOptions);
        if (wo.choices) col.choices = wo.choices;
      } catch (e) {}
    }
    columns.push(col);
  }
  return columns;
}

export async function findProductsTableId(env) {
  const tablesRes = await gristFetch(env, '/tables');
  const tables = tablesRes.tables || [];
  const productsTable = tables.find(t => /PRODUCT/i.test(t.id));
  if (!productsTable) throw new Error('หาตาราง 03_PRODUCTS ไม่เจอในเอกสารนี้ — สร้างตารางสินค้าไว้ก่อน (ชื่อมีคำว่า PRODUCT)');
  return productsTable.id;
}

// =======================================================================
// SCHEMA — auto-create the pipeline's downstream tables plus the
// tracking columns 03_PRODUCTS needs. Idempotent: safe to call on every
// request (it's a couple of cheap reads once everything already exists).
// =======================================================================

export const TRACKING_COLUMNS = [
  { id: 'pipeline_status', type: "Choice", widgetOptions: { choices: ['imported', 'enriching', 'enriched', 'error', 'published'] }, label: 'Pipeline Status' },
  { id: 'pipeline_step', type: 'Int', label: 'Pipeline Step' },
  { id: 'pipeline_error', type: 'Text', label: 'Pipeline Error' },
  { id: 'source_url', type: 'Text', label: 'Source Url' },
  { id: 'updated_at', type: 'Text', label: 'Updated At' },
  { id: 'image_rehost_status', type: 'Text', label: 'Image Rehost Status' },
  { id: 'gallery_image_urls', type: 'Text', label: 'Gallery Image URLs' },
  { id: 'legacy_sync_step', type: 'Int', label: 'Legacy Sync Step' },
  { id: 'legacy_sync_data', type: 'Text', label: 'Legacy Sync Data' }
];

export const TABLE_DEFS = {
  'AI_ANALYSIS': {
    label: 'AI Analysis',
    columns: [
      { id: 'product', ref: true, label: 'Product' },
      { id: 'language', type: 'Choice', widgetOptions: { choices: ['th', 'en'] }, label: 'Language' },
      { id: 'summary', type: 'Text', label: 'Product Summary' },
      { id: 'brand', type: 'Text', label: 'Brand' },
      { id: 'category', type: 'Text', label: 'Category' },
      { id: 'specifications', type: 'Text', label: 'Specifications' },
      { id: 'features', type: 'Text', label: 'Features' },
      { id: 'pros', type: 'Text', label: 'Pros' },
      { id: 'cons', type: 'Text', label: 'Cons' },
      { id: 'target_audience', type: 'Text', label: 'Target Audience' },
      { id: 'estimated_commission', type: 'Text', label: 'Estimated Commission' },
      { id: 'generated_at', type: 'Text', label: 'Generated At' }
    ]
  },
  'KEYWORDS': {
    label: 'Keywords',
    columns: [
      { id: 'product', ref: true, label: 'Product' },
      { id: 'primary_keyword', type: 'Text', label: 'Primary Keyword' },
      { id: 'supporting_keywords', type: 'Text', label: 'Supporting Keywords' },
      { id: 'keywords', type: 'Text', label: 'Keywords (100-300)' },
      { id: 'search_intent', type: 'Text', label: 'Search Intent' },
      { id: 'long_tail', type: 'Text', label: 'Long Tail' },
      { id: 'comparison_keywords', type: 'Text', label: 'Comparison Keywords' },
      { id: 'problem_keywords', type: 'Text', label: 'Problem Keywords' },
      { id: 'best_keywords', type: 'Text', label: 'Best Keywords' },
      { id: 'review_keywords', type: 'Text', label: 'Review Keywords' },
      { id: 'price_keywords', type: 'Text', label: 'Price Keywords' },
      { id: 'alternative_keywords', type: 'Text', label: 'Alternative Keywords' },
      { id: 'faq_keywords', type: 'Text', label: 'FAQ Keywords' },
      { id: 'generated_at', type: 'Text', label: 'Generated At' }
    ]
  },
  'CONTENT': {
    label: 'Content',
    columns: [
      { id: 'product', ref: true, label: 'Product' },
      { id: 'language', type: 'Choice', widgetOptions: { choices: ['th', 'en'] }, label: 'Language' },
      { id: 'buy_link', type: 'Text', label: 'Buy Link' },
      { id: 'slug', type: 'Text', label: 'Slug' },
      { id: 'seo_title', type: 'Text', label: 'SEO Title' },
      { id: 'meta_description', type: 'Text', label: 'Meta Description' },
      { id: 'primary_keyword', type: 'Text', label: 'Primary Keyword' },
      { id: 'tags', type: 'Text', label: 'Tags' },
      { id: 'faq', type: 'Text', label: 'FAQ' },
      { id: 'blog_draft', type: 'Text', label: 'Blog Draft' },
      { id: 'comparison', type: 'Text', label: 'Comparison' },
      { id: 'alternatives', type: 'Text', label: 'Alternatives' },
      { id: 'review', type: 'Text', label: 'Review' },
      { id: 'buying_guide', type: 'Text', label: 'Buying Guide' },
      { id: 'blog_outline', type: 'Text', label: 'Blog Outline' },
      { id: 'generated_at', type: 'Text', label: 'Generated At' }
    ]
  },
  'SOCIAL': {
    label: 'Social',
    columns: [
      { id: 'product', ref: true, label: 'Product' },
      { id: 'language', type: 'Choice', widgetOptions: { choices: ['th', 'en'] }, label: 'Language' },
      { id: 'buy_link', type: 'Text', label: 'Buy Link' },
      { id: 'facebook_post', type: 'Text', label: 'Facebook Post' },
      { id: 'threads_post', type: 'Text', label: 'Threads Post' },
      { id: 'x_post', type: 'Text', label: 'X Post' },
      { id: 'pinterest_post', type: 'Text', label: 'Pinterest Post' },
      { id: 'cta', type: 'Text', label: 'CTA' },
      { id: 'youtube_script', type: 'Text', label: 'YouTube Script' },
      { id: 'shorts_script', type: 'Text', label: 'Shorts Script' },
      { id: 'affiliate_cta', type: 'Text', label: 'Affiliate CTA' },
      { id: 'generated_at', type: 'Text', label: 'Generated At' }
    ]
  },
  'AI_MEDIA': {
    label: 'AI Media',
    columns: [
      { id: 'product', ref: true, label: 'Product' },
      { id: 'image_prompt', type: 'Text', label: 'Image Prompt' },
      { id: 'thumbnail_prompt', type: 'Text', label: 'Thumbnail Prompt' },
      { id: 'generated_at', type: 'Text', label: 'Generated At' }
    ]
  },
  'AI_PUBLISH': {
    label: 'AI Publish',
    columns: [
      { id: 'product', ref: true, label: 'Product' },
      { id: 'status', type: 'Choice', widgetOptions: { choices: ['draft', 'published'] }, label: 'Status' },
      { id: 'published_at', type: 'Text', label: 'Published At' },
      { id: 'channels', type: 'Text', label: 'Channels' },
      { id: 'fb_status', type: 'Choice', widgetOptions: { choices: ['pending', 'posted', 'error'] }, label: 'FB Status' },
      { id: 'fb_post_id', type: 'Text', label: 'FB Post ID' },
      { id: 'fb_post_url', type: 'Text', label: 'FB Post URL' },
      { id: 'fb_posted_at', type: 'Text', label: 'FB Posted At' },
      { id: 'fb_error', type: 'Text', label: 'FB Error' },
      { id: 'ig_status', type: 'Choice', widgetOptions: { choices: ['pending', 'posted', 'error'] }, label: 'IG Status' },
      { id: 'ig_post_id', type: 'Text', label: 'IG Post ID' },
      { id: 'ig_post_url', type: 'Text', label: 'IG Post URL' },
      { id: 'ig_posted_at', type: 'Text', label: 'IG Posted At' },
      { id: 'ig_error', type: 'Text', label: 'IG Error' },
      { id: 'threads_status', type: 'Choice', widgetOptions: { choices: ['pending', 'posted', 'error'] }, label: 'Threads Status' },
      { id: 'threads_post_id', type: 'Text', label: 'Threads Post ID' },
      { id: 'threads_post_url', type: 'Text', label: 'Threads Post URL' },
      { id: 'threads_posted_at', type: 'Text', label: 'Threads Posted At' },
      { id: 'threads_error', type: 'Text', label: 'Threads Error' },
      { id: 'x_status', type: 'Choice', widgetOptions: { choices: ['pending', 'posted', 'error'] }, label: 'X Status' },
      { id: 'x_post_id', type: 'Text', label: 'X Post ID' },
      { id: 'x_post_url', type: 'Text', label: 'X Post URL' },
      { id: 'x_posted_at', type: 'Text', label: 'X Posted At' },
      { id: 'x_error', type: 'Text', label: 'X Error' },
      { id: 'pinterest_status', type: 'Choice', widgetOptions: { choices: ['pending', 'posted', 'error'] }, label: 'Pinterest Status' },
      { id: 'pinterest_pin_id', type: 'Text', label: 'Pinterest Pin ID' },
      { id: 'pinterest_pin_url', type: 'Text', label: 'Pinterest Pin URL' },
      { id: 'pinterest_posted_at', type: 'Text', label: 'Pinterest Posted At' },
      { id: 'pinterest_error', type: 'Text', label: 'Pinterest Error' },
      { id: 'web_status', type: 'Choice', widgetOptions: { choices: ['pending', 'posted', 'error'] }, label: 'Website Status' },
      { id: 'web_url', type: 'Text', label: 'Website URL' },
      { id: 'web_posted_at', type: 'Text', label: 'Website Posted At' },
      { id: 'web_error', type: 'Text', label: 'Website Error' }
    ]
  },
  'AI_ANALYTICS': {
    label: 'AI Analytics',
    columns: [
      { id: 'product', ref: true, label: 'Product' },
      { id: 'views', type: 'Int', label: 'Views' },
      { id: 'clicks', type: 'Int', label: 'Clicks' },
      { id: 'conversions', type: 'Int', label: 'Conversions' },
      { id: 'last_updated', type: 'Text', label: 'Last Updated' }
    ]
  }
};

export const WORKER_OWNED_TABLE_IDS = new Set(['AI_ANALYSIS', 'KEYWORDS', 'CONTENT', 'SOCIAL', 'AI_MEDIA', 'AI_PUBLISH', 'AI_ANALYTICS']);

export function findRealTableId(tables, regex) {
  const match = (tables || []).find(t => !/^AI_/i.test(t.id) && !WORKER_OWNED_TABLE_IDS.has(t.id) && regex.test(t.id));
  return match ? match.id : null;
}

function colFieldsFor(def, productsTableId) {
  const type = def.ref ? `Ref:${productsTableId}` : def.type;
  const fields = { label: def.label, type };
  if (def.widgetOptions) fields.widgetOptions = JSON.stringify(def.widgetOptions);
  return fields;
}

async function ensureColumns(env, tableId, existingColIds, defs, productsTableId) {
  const missing = defs.filter(d => !existingColIds.has(d.id));
  if (missing.length === 0) return;
  await gristFetch(env, `/tables/${tableId}/columns`, {
    method: 'POST',
    body: JSON.stringify({
      columns: missing.map(d => ({ id: d.id, fields: colFieldsFor(d, productsTableId) }))
    })
  });
}

// 🔧 NOTE FOR FUTURE EDITS: this used to be a bare module-level variable
// (`let _schemaCache = null`). When the file was split into modules, a
// bare exported `let` can't be reassigned from another file (ES module
// live-bindings only allow the *declaring* module to write to it safely
// in all bundlers/runtimes we target) — so it's wrapped in a mutable
// object instead. Always mutate `.key`, never replace the object itself.
const schemaCacheState = { key: null };

export async function ensureSchema(env) {
  requireGristConfigured(env);
  const productsTableId = await findProductsTableId(env);
  const cacheKey = `${GRIST_DOC_ID}:${productsTableId}`;
  if (schemaCacheState.key === cacheKey) return productsTableId;

  const tablesRes = await gristFetch(env, '/tables');
  const existingTableIds = new Set((tablesRes.tables || []).map(t => t.id));

  try {
    const prodCols = await gristFetch(env, `/tables/${productsTableId}/columns`);
    const prodColIds = new Set((prodCols.columns || []).map(c => c.id));
    await ensureColumns(env, productsTableId, prodColIds, TRACKING_COLUMNS, productsTableId);
  } catch (e) {
    throw new Error(`ตั้งค่า tracking columns บน ${productsTableId} ไม่สำเร็จ: ${e.message}`);
  }

  for (const [tableId, def] of Object.entries(TABLE_DEFS)) {
    try {
      if (!existingTableIds.has(tableId)) {
        await gristFetch(env, '/tables', {
          method: 'POST',
          body: JSON.stringify({
            tables: [{
              id: tableId,
              columns: def.columns.map(d => ({ id: d.id, fields: colFieldsFor(d, productsTableId) }))
            }]
          })
        });
      } else {
        const colsRes = await gristFetch(env, `/tables/${tableId}/columns`);
        const colIds = new Set((colsRes.columns || []).map(c => c.id));
        await ensureColumns(env, tableId, colIds, def.columns, productsTableId);
      }
    } catch (e) {
      throw new Error(`สร้าง/อัปเดตตาราง ${tableId} ไม่สำเร็จ: ${e.message}`);
    }
  }

  schemaCacheState.key = cacheKey;
  return productsTableId;
}

async function buildTableColumnsLite(env, tableId) {
  const colsRes = await gristFetch(env, `/tables/${tableId}/columns`);
  const rawCols = (colsRes.columns || []).filter(
    c => c.id !== 'manualSort' && c.id !== 'id' && !c.fields.isFormula
  );
  return rawCols.map(c => {
    const type = c.fields.type || 'Text';
    const col = { colId: c.id, label: c.fields.label || humanLabel(c.id), type };
    if (type.startsWith('Ref:')) {
      col.refInfo = { targetTable: type.split(':')[1] };
    } else if (type === 'Choice' && c.fields.widgetOptions) {
      try {
        const wo = JSON.parse(c.fields.widgetOptions);
        if (wo.choices) col.choices = wo.choices;
      } catch (e) {}
    }
    return col;
  });
}

export async function buildAllTablesSchema(env) {
  await ensureSchema(env);
  const tablesRes = await gristFetch(env, '/tables');
  const tables = (tablesRes.tables || []).filter(t => !/^_grist_/i.test(t.id));
  const out = [];
  for (const t of tables) {
    try {
      const columns = await buildTableColumnsLite(env, t.id);
      if (columns.length === 0) continue;
      out.push({ tableId: t.id, label: humanLabel(t.id.replace(/^\d+_/, '')), columns });
    } catch (e) { }
  }
  return out;
}

export async function handleSchema(env) {
  try {
    return json200({ tables: await buildAllTablesSchema(env) });
  } catch (err) {
    return json200({ error: err.message }, 500);
  }
}
