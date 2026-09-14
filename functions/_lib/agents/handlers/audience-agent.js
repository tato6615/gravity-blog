/**
 * functions/_lib/agents/handlers/audience-agent.js — GRAVITY ARS STEP 2 (slice 9)
 * ---------------------------------------------------------------------------
 * Audience Agent's first real capability: claims pending `agent_tasks` rows
 * addressed to `audience` (created by Opportunity Agent when it selects a
 * market) and analyzes intent/pain-points/objections for that market's
 * category — but ONLY from data that already exists in this business
 * (ai_analysis.target_audience/pros/cons, keywords.search_intent/
 * problem_keywords/faq_keywords for existing products in the same
 * category). Never invents an audience profile from general knowledge —
 * per spec section 9, evidence has to come from this system's own data.
 *
 * If no existing product shares the category yet (a genuinely new
 * category), says so plainly and passes the market's own
 * content_angles/ai_reasoning through unchanged as the only signal
 * available, flagged LOW_CONFIDENCE — it does not fabricate pain points
 * to fill the gap.
 *
 * Uses claimNextTask() (compare-and-swap, see db.js) rather than
 * listTasks()+manual update, so two overlapping ticks can never process
 * the same task twice.
 */

import { claimNextTask, completeTask, failTask, createTask, writeMemory, nowIso } from '../db.js';

const MAX_TASKS_PER_RUN = 5;
const MAX_SAMPLE_PRODUCTS = 20;

function uniqueNonEmpty(values) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    if (!v) continue;
    const t = String(v).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// Intent funnel classification (spec section 7: Awareness → Interest →
// Research → Comparison → Consideration → Action → Purchase). Deliberately
// NOT a single invented score — per spec section 9 ("never invent"), this
// counts which `keywords` columns actually have data for the sampled
// products and reports the distribution as evidence. Mapping is a direct
// reading of what each column already means in `13_DATA/SCHEMA.md`, not a
// new classifier: problem_keywords = someone just realized they have a
// problem (Awareness); faq_keywords = still learning basics (Interest);
// best_keywords/review_keywords = actively researching options (Research);
// comparison_keywords/alternative_keywords = weighing named options
// (Comparison/Consideration); price_keywords = checking cost before buying
// (Action); search_intent = the keyword tool's own transactional/
// commercial/informational label, used to distinguish Consideration from
// Purchase where price_keywords data alone can't tell the two apart.
const INTENT_STAGE_COLUMNS = {
  awareness: ['problem_keywords'],
  interest: ['faq_keywords'],
  research: ['best_keywords', 'review_keywords'],
  comparison: ['comparison_keywords', 'alternative_keywords'],
  consideration: ['comparison_keywords', 'alternative_keywords'],
  action: ['price_keywords'],
  purchase: [] // derived from search_intent === 'transactional' below, not a keyword column
};

function classifyIntentSignals(sample) {
  const stageCounts = { awareness: 0, interest: 0, research: 0, comparison: 0, consideration: 0, action: 0, purchase: 0 };
  const searchIntentLabels = {};

  for (const row of sample) {
    for (const [stage, cols] of Object.entries(INTENT_STAGE_COLUMNS)) {
      if (cols.some(col => row[col] && String(row[col]).trim())) stageCounts[stage] += 1;
    }
    const label = row.search_intent && String(row.search_intent).trim().toLowerCase();
    if (label) {
      searchIntentLabels[label] = (searchIntentLabels[label] || 0) + 1;
      if (label === 'transactional') stageCounts.purchase += 1;
    }
  }

  const totalWithAnySignal = sample.length;
  const distribution = Object.fromEntries(
    Object.entries(stageCounts).map(([stage, count]) => [
      stage,
      { productCount: count, coverage: totalWithAnySignal ? Math.round((count / totalWithAnySignal) * 100) : 0 }
    ])
  );

  const dominantStage = Object.entries(stageCounts).reduce(
    (best, [stage, count]) => (count > best.count ? { stage, count } : best),
    { stage: null, count: 0 }
  );

  return {
    sampleSize: totalWithAnySignal,
    distribution,
    dominantStage: dominantStage.count > 0 ? dominantStage.stage : null,
    searchIntentLabels,
    note: dominantStage.count > 0
      ? `จากสินค้า ${totalWithAnySignal} รายการ พบ evidence ของ funnel stage "${dominantStage.stage}" มากที่สุด (${dominantStage.count} รายการ) — นับจากคอลัมน์ keywords ที่มีข้อมูลจริงเท่านั้น ไม่ได้ให้คะแนน/เดา`
      : 'ไม่มี evidence คอลัมน์ intent-related ใด ๆ เลยในสินค้ากลุ่มนี้ (ทุกคอลัมน์ว่างหมด) — ไม่สามารถระบุ funnel stage ได้'
  };
}

async function analyzeOneMarket(env, task) {
  let payload;
  try {
    payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {});
  } catch {
    payload = {};
  }
  const { marketId, marketName, category, country, contentAngles, aiReasoning } = payload;

  const { results: sample } = await env.DB.prepare(`
    SELECT p.id, p.product_name,
           a.target_audience, a.pros, a.cons,
           k.search_intent, k.problem_keywords, k.faq_keywords,
           k.best_keywords, k.review_keywords, k.comparison_keywords,
           k.alternative_keywords, k.price_keywords
    FROM products p
    LEFT JOIN ai_analysis a ON a.product_id = p.id AND a.language = 'th'
    LEFT JOIN keywords k ON k.product = p.id
    WHERE (p.category = ? OR p.category_th = ?)
      AND (a.target_audience IS NOT NULL OR k.search_intent IS NOT NULL OR k.problem_keywords IS NOT NULL)
    ORDER BY p.id DESC
    LIMIT ?
  `).bind(category || '', category || '', MAX_SAMPLE_PRODUCTS).all();

  let profile;
  if (!sample.length) {
    profile = {
      marketId, marketName, category, country,
      confidence: 'LOW_CONFIDENCE',
      note: `ไม่มีสินค้าเดิมในหมวด "${category || '(ไม่ระบุ)'}" ที่มีข้อมูล audience (ai_analysis/keywords) เลย — เป็นหมวดใหม่จริงๆ ใช้แค่ content_angles/ai_reasoning จาก Market Agent เป็นสัญญาณเดียวที่มี ไม่แต่งข้อมูล pain point เพิ่มเอง`,
      sampleSize: 0,
      targetAudienceSignals: [],
      painPointSignals: [],
      searchIntentSignals: [],
      intent: classifyIntentSignals([]),
      fallbackFromMarket: { contentAngles: contentAngles || null, aiReasoning: aiReasoning || null }
    };
  } else {
    const targetAudienceSignals = uniqueNonEmpty(sample.map(r => r.target_audience)).slice(0, 10);
    const painPointSignals = uniqueNonEmpty([
      ...sample.map(r => r.problem_keywords),
      ...sample.map(r => r.cons)
    ]).slice(0, 15);
    const searchIntentSignals = uniqueNonEmpty([
      ...sample.map(r => r.search_intent),
      ...sample.map(r => r.faq_keywords)
    ]).slice(0, 15);

    profile = {
      marketId, marketName, category, country,
      confidence: sample.length >= 5 ? 'MEDIUM_CONFIDENCE' : 'LOW_CONFIDENCE',
      note: `วิเคราะห์จากสินค้าเดิม ${sample.length} รายการในหมวด "${category}" (ai_analysis.target_audience + keywords.search_intent/problem_keywords/faq_keywords ที่มีอยู่จริง ไม่ได้เดาเพิ่ม)`,
      sampleSize: sample.length,
      sampleProductIds: sample.map(r => r.id),
      targetAudienceSignals,
      painPointSignals,
      searchIntentSignals,
      intent: classifyIntentSignals(sample)
    };
  }

  await writeMemory(env, 'audience_reports', `market_${marketId}`, profile, 'audience');

  const createdTask = await createTask(env, {
    senderAgent: 'audience',
    receiverAgent: 'offer',
    messageType: 'audience_profile_ready',
    priority: 8,
    payload: { ...payload, audienceProfile: profile }
  });

  return { ...profile, nextTaskId: createdTask.id };
}

export async function executeAudienceAnalysis(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const processed = [];
  const failed = [];

  for (let i = 0; i < MAX_TASKS_PER_RUN; i++) {
    const claimed = await claimNextTask(env, 'audience');
    if (!claimed) break;

    try {
      const result = await analyzeOneMarket(env, claimed);
      await completeTask(env, claimed.id, result);
      processed.push(result);
    } catch (err) {
      const msg = err.message || String(err);
      await failTask(env, claimed.id, msg);
      failed.push({ taskId: claimed.id, error: msg });
    }
  }

  const report = {
    generatedAt: nowIso(),
    status: processed.length ? 'ANALYZED' : (failed.length ? 'ERRORS' : 'NO_PENDING_TASKS'),
    note: processed.length
      ? `วิเคราะห์ audience ให้ ${processed.length} market opportunity ที่ Opportunity Agent เลือกไว้ ส่ง task ต่อให้ Offer Agent แล้วทุกรายการ`
      : (failed.length ? `พยายามวิเคราะห์แล้วแต่ล้มเหลว ${failed.length} รายการ` : 'ไม่มี task ค้างอยู่ในคิวสำหรับ audience ตอนนี้ (Opportunity Agent อาจยังไม่เคยเลือกอะไรเลย หรือ Audience Agent ประมวลผลไปหมดแล้ว)'),
    processed,
    failed
  };

  await writeMemory(env, 'audience_reports', 'latest', report, 'audience');
  return report;
}
