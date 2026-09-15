/**
 * functions/_lib/agents/handlers/market-agent.js — GRAVITY ARS STEP 2 (slice 7)
 * ---------------------------------------------------------------------------
 * Market Agent's first real capability: read Worker af's `market-discovery.js`
 * output (the `markets` table — 9-dimension scored candidates, confirmed
 * live schema 2026-09-13) and report what candidate markets exist, ranked
 * by score_total.
 *
 * Deliberately read-only: does NOT change any market's `status` and does
 * NOT invent a score of its own. Per registry.js this agent's role is
 * "discover_markets / detect_demand / detect_trends / identify_problems /
 * identify_opportunities" — scoring already happened upstream (Worker af),
 * deciding what to DO with a score is Opportunity Agent's job
 * (opportunity-agent.js), kept separate on purpose (same reasoning
 * growth-agent.js gives for not merging with experiment-agent.js).
 *
 * If there are no unprocessed candidates, says so plainly instead of
 * fabricating demand data to report on (never invent, per spec section 9).
 */

import { writeMemory, nowIso } from '../db.js';

const MAX_CANDIDATES_IN_REPORT = 10;

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
    const report = {
      generatedAt: nowIso(),
      status: 'NO_CANDIDATES',
      note:
        'ไม่มี market candidate เหลืออยู่เลย (status=candidate ว่างเปล่า) — ' +
        "Worker af's market-discovery.js อาจยังไม่เคยรันรอบใหม่ หรือทุกอันถูกคัดเลือก/archive ไปหมดแล้ว " +
        'ไม่มีข้อมูลใหม่ให้รายงานตอนนี้',
      candidateCount: 0,
      topCandidates: []
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