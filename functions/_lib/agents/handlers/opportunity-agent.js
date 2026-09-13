/**
 * functions/_lib/agents/handlers/opportunity-agent.js — GRAVITY ARS STEP 2 (slice 8)
 * ---------------------------------------------------------------------------
 * Opportunity Agent's first real capability: reads Market Agent's latest
 * report (agent_memory: market_reports/latest) and DECIDES whether any
 * candidate is worth selecting — the one action Market Agent deliberately
 * does not take (it only reports, doesn't decide).
 *
 * MIN_SELECT_SCORE = 72 is not an invented number: it matches the actual
 * historical floor observed in the live `markets` table on 2026-09-13 —
 * every row a human has ever marked status='selected' so far has
 * score_total >= 72 (min 72, max 78, n=5), out of 94 total candidates
 * (score_total range 48-79). Using that as the bar keeps this agent's
 * first decisions consistent with what's already been treated as "good
 * enough" in this business, instead of guessing a new threshold (per spec
 * section 9, never invent).
 *
 * Rule (matches spec section 3 "no task without a clear business reason"
 * + section 15 "don't create content without proven demand"): only
 * selects a candidate if its score_total clears MIN_SELECT_SCORE, and
 * selects at most MAX_SELECTIONS_PER_RUN per run so one noisy scan can't
 * flood downstream agents that don't have handlers yet. Marks the row
 * status='selected' in `markets` — guarded by `AND status = 'candidate'`
 * in the UPDATE itself, so re-running never re-selects the same row even
 * if two ticks race. Creates an `agent_tasks` entry addressed to
 * `audience` — the spec's section-2 pipeline order is
 * MARKET → OPPORTUNITY → AUDIENCE → OFFER → ..., so a selected
 * opportunity goes to Audience Agent next, not straight to Offer Agent
 * (Audience Agent has a real handler as of Step 2 slice 9 — see
 * audience-agent.js — and forwards to `offer` itself once done).
 */

import { writeMemory, readMemory, createTask, nowIso } from '../db.js';

const MIN_SELECT_SCORE = 72;
const MAX_SELECTIONS_PER_RUN = 3;

export async function executeOpportunityReview(env, task) {
  if (!env.DB) throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งาน');

  const marketReport = await readMemory(env, 'market_reports', 'latest');

  if (!marketReport || marketReport.status !== 'CANDIDATES_FOUND') {
    const report = {
      generatedAt: nowIso(),
      status: 'NOTHING_TO_EVALUATE',
      note: marketReport
        ? `Market Agent รายงานล่าสุดว่า "${marketReport.status}" — ไม่มี candidate ให้ประเมินตอนนี้`
        : 'ยังไม่มีรายงานจาก Market Agent เลย ต้องรัน Market Agent ก่อนหน้านี้',
      minSelectScore: MIN_SELECT_SCORE,
      selected: []
    };
    await writeMemory(env, 'opportunity_reports', 'latest', report, 'opportunity');
    return report;
  }

  const eligible = marketReport.topCandidates.filter(c => (c.scoreTotal ?? 0) >= MIN_SELECT_SCORE);

  if (!eligible.length) {
    const report = {
      generatedAt: nowIso(),
      status: 'NO_CANDIDATE_MEETS_BAR',
      note: `มี ${marketReport.topCandidates.length} candidate ในรายงานของ Market Agent แต่ไม่มีตัวไหน score_total ถึงเกณฑ์ขั้นต่ำ ${MIN_SELECT_SCORE} (คะแนนสูงสุดที่มีคือ ${marketReport.topCandidates[0]?.scoreTotal ?? 'ไม่มีข้อมูล'}) — ไม่เลือกอะไรตอนนี้ ตามข้อ 15 ห้ามสร้างงานที่ไม่มีเหตุผลทางธุรกิจชัดเจน`,
      bestAvailableScore: marketReport.topCandidates[0]?.scoreTotal ?? null,
      minSelectScore: MIN_SELECT_SCORE,
      selected: []
    };
    await writeMemory(env, 'opportunity_reports', 'latest', report, 'opportunity');
    return report;
  }

  const toAttempt = eligible.slice(0, MAX_SELECTIONS_PER_RUN);
  const selected = [];
  const skipped = [];

  for (const candidate of toAttempt) {
    const current = await env.DB.prepare(`SELECT status FROM markets WHERE id = ?`).bind(candidate.id).first();
    if (!current) {
      skipped.push({ marketId: candidate.id, reason: 'ไม่พบแถวนี้ใน markets แล้ว (ถูกลบ/แก้ระหว่างทาง)' });
      continue;
    }
    if (current.status !== 'candidate') {
      skipped.push({ marketId: candidate.id, reason: `ถูกเปลี่ยนสถานะเป็น '${current.status}' ไปแล้วก่อนหน้านี้ (เลือกซ้ำไม่ได้ตามที่ตั้งใจ)` });
      continue;
    }

    const updateResult = await env.DB.prepare(
      `UPDATE markets SET status = 'selected' WHERE id = ? AND status = 'candidate'`
    ).bind(candidate.id).run();

    if (!updateResult.meta.changes) {
      skipped.push({ marketId: candidate.id, reason: 'อีก process หนึ่งเปลี่ยนสถานะไปพร้อมกัน (race condition) — ข้ามให้ปลอดภัยไว้ก่อน' });
      continue;
    }

    const createdTask = await createTask(env, {
      senderAgent: 'opportunity',
      receiverAgent: 'audience',
      messageType: 'opportunity_selected',
      priority: 8,
      payload: {
        marketId: candidate.id,
        marketName: candidate.name,
        category: candidate.category,
        country: candidate.country,
        scoreTotal: candidate.scoreTotal,
        contentAngles: candidate.contentAngles,
        aiReasoning: candidate.aiReasoning
      }
    });

    selected.push({
      marketId: candidate.id,
      marketName: candidate.name,
      scoreTotal: candidate.scoreTotal,
      taskId: createdTask.id
    });
  }

  const report = {
    generatedAt: nowIso(),
    status: selected.length ? 'SELECTED' : 'ALREADY_PROCESSED',
    note: selected.length
      ? `เลือก ${selected.length} market/opportunity ที่ score_total >= ${MIN_SELECT_SCORE} มาร์คเป็น 'selected' ใน D1 แล้ว และสร้าง task ส่งต่อให้ Audience Agent แล้ว (ตามลำดับ pipeline MARKET → OPPORTUNITY → AUDIENCE → OFFER)`
      : 'candidate ที่ผ่านเกณฑ์ทั้งหมดถูกเลือกไปแล้วในรอบก่อนหน้า (หรือมี race condition) ไม่มีอะไรใหม่ให้เลือกในรอบนี้',
    minSelectScore: MIN_SELECT_SCORE,
    selected,
    skipped
  };

  await writeMemory(env, 'opportunity_reports', 'latest', report, 'opportunity');
  return report;
}
