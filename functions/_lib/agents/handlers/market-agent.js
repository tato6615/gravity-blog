/**
 * functions/_lib/agents/handlers/market-agent.js — GRAVITY ARS STEP 2 (slice 7)
 * ---------------------------------------------------------------------------
 * Market Agent's first real capability: read Worker af's `market-discovery.js`
 * output (the `markets` table — 9-dimension scored candidates, confirmed
 * live schema 2026-09-13) and report what candidate markets exist, ranked
 * by score_total.
 *
 * Deliberately read-only re: markets: does NOT change any market's `status`
 * and does NOT invent a score of its own. Per registry.js this agent's role
 * is "discover_markets / detect_demand / detect_trends / identify_problems /
 * identify_opportunities" — scoring already happened upstream (Worker af),
 * deciding what to DO with a score is Opportunity Agent's job
 * (opportunity-agent.js), kept separate on purpose (same reasoning
 * growth-agent.js gives for not merging with experiment-agent.js).
 *
 * If there are no unprocessed candidates, says so plainly instead of
 * fabricating demand data to report on (never invent, per spec section 9).
 *
 * --- AGENT-003: Self-refill when Worker "af" stalls --------------------
 * Market Agent depends on Worker af to keep feeding new products in. If af
 * stops, the `markets` candidate queue silently runs dry with no clear
 * signal. When there are zero candidates, we check af's own health
 * endpoint; if af reports itself stale (or is unreachable at all — treated
 * as worse than stale), we fall back to re-queuing already-enriched
 * products that haven't finished distribution to every platform yet, so
 * the pipeline doesn't sit fully idle waiting on af to come back.
 * -------------------------------------------------------------------------
 */

import { writeMemory, nowIso, createTask } from '../db.js';

const MAX_CANDIDATES_IN_REPORT = 10;
const WORKER_AF_HEALTH_URL = 'https://af.pakpiromjajaja.workers.dev/api/agent-health';
const FALLBACK_BATCH_SIZE = 5;

async function checkWorkerAfHealth() {
  try {
    const res = await fetch(WORKER_AF_HEALTH_URL);
    return await res.json();
  } catch (err) {
    // เข้าไม่ถึง Worker af เลย = แย่กว่า stale อีก, ถือว่า stale
    return { stale: true, error: err.message || String(err) };
  }
}

async function requeueUndistributedProducts(env) {
  const { results = [] } = await env.DB.prepare(`
    SELECT id, name, channels
    FROM products
    WHERE pipeline_status = 'enriched'
      AND (channels IS NULL OR channels NOT LIKE '%facebook%')
    ORDER BY updated_at ASC
    LIMIT ?
  `).bind(FALLBACK_BATCH_SIZE).all();

  const tasks = [];
  for (const p of results) {
    try {
      const task = await createTask(env, {
        senderAgent: 'market',
        receiverAgent: 'distribution',
        messageType: 'distribution',
        payload: { productId: p.id, reason: 'worker_af_stale_fallback' }
      });
      tasks.push({ productId: p.id, taskId: task.id, ok: true });
    } catch (err) {
      // อย่าให้ 1 task ที่ fail ทำให้ทั้ง batch ล้ม — เก็บ error ไว้รายงาน แล้วไปต่อ
      tasks.push({ productId: p.id, ok: false, error: err.message || String(err) });
    }
  }
  return tasks;
}

export async function executeMarketScan(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const { results: candidates } = await env.DB.prepare(`
    SELECT id, name, parent_market_id, level, country, category,
           score_demand, score_product_depth, score_money, score_commission,
           score_repeat, score_problem_intensity, score_competition,
           score_content_potential, score_gravity_fit, score_total,
           content_angles, ai_reasoning, status, search_run_id, created_at
    FROM markets
    WHERE status = 'candidate'
    ORDER BY score_total DESC
  `).all();

  if (!candidates.length) {
    const health = await checkWorkerAfHealth();
    let fallback = null;

    if (health.stale) {
      const tasks = await requeueUndistributedProducts(env);
      fallback = { triggered: true, workerAfHealth: health, requeuedTasks: tasks };
    } else {
      fallback = { triggered: false, workerAfHealth: health };
    }

    const report = {
      generatedAt: nowIso(),
      status: 'NO_CANDIDATES',
      note:
        'ไม่มี market candidate เหลืออยู่เลย (status=candidate ว่างเปล่า) — ' +
        "Worker af's market-discovery.js อาจยังไม่เคยรันรอบใหม่ หรือทุกอันถูกคัดเลือก/archive ไปหมดแล้ว " +
        'ไม่มีข้อมูลใหม่ให้รายงานตอนนี้',
      candidateCount: 0,
      topCandidates: [],
      fallback
    };

    await writeMemory(env, 'market_reports', 'latest', report, 'market');
    return report;
  }

  const topCandidates = candidates.slice(0, MAX_CANDIDATES_IN_REPORT).map((c) => ({
    id: c.id,
    name: c.name,
    parentMarketId: c.parent_market_id,
    level: c.level,
    country: c.country,
    category: c.category,
    scoreTotal: c.score_total,
    scores: {
      demand: c.score_demand,
      productDepth: c.score_product_depth,
      money: c.score_money,
      commission: c.score_commission,
      repeat: c.score_repeat,
      problemIntensity: c.score_problem_intensity,
      competition: c.score_competition,
      contentPotential: c.score_content_potential,
      gravityFit: c.score_gravity_fit
    },
    contentAngles: c.content_angles,
    aiReasoning: c.ai_reasoning,
    searchRunId: c.search_run_id,
    createdAt: c.created_at
  }));

  const highestScore = candidates[0].score_total;
  const lowestScore = candidates[candidates.length - 1].score_total;

  const report = {
    generatedAt: nowIso(),
    status: 'CANDIDATES_FOUND',
    note:
      `พบ ${candidates.length} market candidate ที่ยังไม่ถูกคัดเลือก/archive — ` +
      `เรียงตาม score_total มากไปน้อย (คะแนนสูงสุด ${highestScore}, ต่ำสุด ${lowestScore}) ` +
      'ส่งต่อให้ Opportunity Agent ประเมินว่าควรเลือกตัวไหน',
    candidateCount: candidates.length,
    topCandidates
  };

  await writeMemory(env, 'market_reports', 'latest', report, 'market');
  return report;
}