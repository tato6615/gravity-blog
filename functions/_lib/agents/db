/**
 * functions/_lib/agents/db.js — GRAVITY ARS STEP 1 (Multi-Agent Foundation)
 * ---------------------------------------------------------------------------
 * Low-level D1 access for the 4 tables added in Step 1, all on the SAME
 * `gravity_affiliate` D1 database this Pages project already binds as
 * `env.DB` (see functions/_lib/d1-products.js for the existing pattern).
 * Nothing here touches products/content/markets/etc — purely additive.
 *
 * Tables (created directly in D1, not auto-created by this file — same
 * "must already exist" convention Worker af's db.js uses for `markets`):
 *   agents        — identity + live status per agent
 *   agent_tasks   — the shared task/message bus
 *   agent_memory  — shared key/value memory, namespaced
 *   agent_logs    — append-only activity/error log per agent
 *
 * Every function assumes `env.DB` exists. Callers should wrap in try/catch
 * (Pages Functions convention in this repo — see functions/api/*.js).
 */

function requireDb(env) {
  if (!env.DB) {
    throw new Error('D1 binding (env.DB) ไม่พร้อมใช้งานบน Pages Function นี้');
  }
}

export function nowIso() {
  return new Date().toISOString();
}

// =======================================================================
// AGENTS — identity + live status
// =======================================================================

export async function listAgents(env) {
  requireDb(env);
  const { results } = await env.DB.prepare(
    `SELECT * FROM agents ORDER BY id ASC`
  ).all();
  return results;
}

export async function getAgent(env, agentId) {
  requireDb(env);
  return await env.DB.prepare(`SELECT * FROM agents WHERE id = ?`).bind(agentId).first();
}

// Registers an agent if it doesn't exist yet, or updates its identity
// fields (name/role/capabilities) if it does — status/counters are left
// untouched on an existing row so re-registering never resets live state.
export async function registerAgent(env, { id, name, role, capabilities, modelProvider, modelName }) {
  requireDb(env);
  const ts = nowIso();
  const existing = await getAgent(env, id);
  if (existing) {
    await env.DB.prepare(
      `UPDATE agents SET name = ?, role = ?, capabilities = ?, model_provider = ?, model_name = ?, updated_at = ? WHERE id = ?`
    ).bind(name, role || null, JSON.stringify(capabilities || []), modelProvider || null, modelName || null, ts, id).run();
    return await getAgent(env, id);
  }
  await env.DB.prepare(
    `INSERT INTO agents (id, name, role, capabilities, status, model_provider, model_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'IDLE', ?, ?, ?, ?)`
  ).bind(id, name, role || null, JSON.stringify(capabilities || []), modelProvider || null, modelName || null, ts, ts).run();
  return await getAgent(env, id);
}

const VALID_STATUSES = new Set(['IDLE', 'WORKING', 'WAITING', 'SUCCESS', 'FAILED', 'BLOCKED', 'DISABLED']);

// Updates an agent's live status + bookkeeping fields. `outcome` is
// optional: 'success' | 'failure' bumps the matching counter.
export async function updateAgentStatus(env, agentId, { status, currentTaskId, lastResult, lastError, outcome } = {}) {
  requireDb(env);
  if (status && !VALID_STATUSES.has(status)) {
    throw new Error(`updateAgentStatus: สถานะ "${status}" ไม่ถูกต้อง`);
  }
  const ts = nowIso();
  const sets = ['last_activity_at = ?', 'updated_at = ?'];
  const vals = [ts, ts];
  if (status !== undefined) { sets.push('status = ?'); vals.push(status); }
  if (currentTaskId !== undefined) { sets.push('current_task_id = ?'); vals.push(currentTaskId); }
  if (lastResult !== undefined) { sets.push('last_result = ?'); vals.push(typeof lastResult === 'string' ? lastResult : JSON.stringify(lastResult)); }
  if (lastError !== undefined) { sets.push('last_error = ?'); vals.push(lastError); }
  sets.push('execution_count = execution_count + 1');
  if (outcome === 'success') sets.push('success_count = success_count + 1');
  if (outcome === 'failure') sets.push('failure_count = failure_count + 1');

  await env.DB.prepare(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, agentId).run();
  return await getAgent(env, agentId);
}

// =======================================================================
// AGENT_TASKS — the shared task / message bus
// =======================================================================

export async function createTask(env, { senderAgent, receiverAgent, messageType, priority = 5, payload, maxRetries = 3 }) {
  requireDb(env);
  if (!receiverAgent) throw new Error('createTask: ต้องระบุ receiverAgent');
  const id = crypto.randomUUID();
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO agent_tasks (id, sender_agent, receiver_agent, message_type, priority, payload, status, retry_count, max_retries, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`
  ).bind(id, senderAgent || 'control', receiverAgent, messageType || 'task', priority, JSON.stringify(payload ?? {}), maxRetries, ts, ts).run();
  return await getTask(env, id);
}

export async function getTask(env, taskId) {
  requireDb(env);
  return await env.DB.prepare(`SELECT * FROM agent_tasks WHERE id = ?`).bind(taskId).first();
}

export async function listTasks(env, { receiverAgent, status, limit = 50 } = {}) {
  requireDb(env);
  const clauses = [];
  const vals = [];
  if (receiverAgent) { clauses.push('receiver_agent = ?'); vals.push(receiverAgent); }
  if (status) { clauses.push('status = ?'); vals.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT * FROM agent_tasks ${where} ORDER BY priority DESC, created_at DESC LIMIT ?`
  ).bind(...vals, Math.max(1, Math.min(200, Number(limit) || 50))).all();
  return results;
}

// Atomically claims the single highest-priority pending task for an agent
// (or any agent, if receiverAgent is omitted) and marks it in_progress —
// this is the "assign work" half of the Control Agent's job. Returns null
// if there's nothing pending.
export async function claimNextTask(env, receiverAgent) {
  requireDb(env);
  const ts = nowIso();
  const where = receiverAgent
    ? `WHERE status = 'pending' AND receiver_agent = ?`
    : `WHERE status = 'pending'`;
  const binds = receiverAgent ? [receiverAgent] : [];
  const next = await env.DB.prepare(
    `SELECT id FROM agent_tasks ${where} ORDER BY priority DESC, created_at ASC LIMIT 1`
  ).bind(...binds).first();
  if (!next) return null;

  // Optimistic claim: only succeeds if still pending (guards against a
  // second concurrent caller claiming the same row between SELECT and
  // UPDATE — D1/SQLite has no SELECT ... FOR UPDATE, so this compare-and
  // -swap on status is the practical equivalent).
  const res = await env.DB.prepare(
    `UPDATE agent_tasks SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'`
  ).bind(ts, ts, next.id).run();
  if (!res.meta.changes) return null;
  return await getTask(env, next.id);
}

export async function completeTask(env, taskId, result) {
  requireDb(env);
  const ts = nowIso();
  await env.DB.prepare(
    `UPDATE agent_tasks SET status = 'success', result = ?, completed_at = ?, updated_at = ? WHERE id = ?`
  ).bind(typeof result === 'string' ? result : JSON.stringify(result ?? {}), ts, ts, taskId).run();
  return await getTask(env, taskId);
}

// Marks a task failed. If it still has retries left, resets it to
// 'pending' (with retry_count bumped) instead of leaving it 'failed', so
// the Control Agent's retry loop can pick it back up automatically —
// implements the spec's "retry when appropriate" rule.
export async function failTask(env, taskId, error) {
  requireDb(env);
  const ts = nowIso();
  const task = await getTask(env, taskId);
  if (!task) return null;
  const nextRetryCount = (task.retry_count || 0) + 1;
  const willRetry = nextRetryCount <= (task.max_retries ?? 3);
  await env.DB.prepare(
    `UPDATE agent_tasks SET status = ?, error = ?, retry_count = ?, updated_at = ? WHERE id = ?`
  ).bind(willRetry ? 'pending' : 'failed', String(error || ''), nextRetryCount, ts, taskId).run();
  return await getTask(env, taskId);
}

// =======================================================================
// AGENT_MEMORY — shared, persistent, namespaced key/value store
// =======================================================================

export async function writeMemory(env, namespace, key, value, createdByAgent) {
  requireDb(env);
  const ts = nowIso();
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  await env.DB.prepare(
    `INSERT INTO agent_memory (namespace, key, value, created_by_agent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(namespace, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(namespace, key, json, createdByAgent || null, ts, ts).run();
}

export async function readMemory(env, namespace, key) {
  requireDb(env);
  const row = await env.DB.prepare(
    `SELECT value FROM agent_memory WHERE namespace = ? AND key = ?`
  ).bind(namespace, key).first();
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export async function listMemory(env, namespace, limit = 50) {
  requireDb(env);
  const { results } = await env.DB.prepare(
    `SELECT key, value, created_by_agent, created_at, updated_at FROM agent_memory WHERE namespace = ? ORDER BY updated_at DESC LIMIT ?`
  ).bind(namespace, Math.max(1, Math.min(200, Number(limit) || 50))).all();
  return results;
}

// =======================================================================
// AGENT_LOGS — append-only activity / error log
// =======================================================================

export async function writeLog(env, agentId, level, message, detail, taskId) {
  requireDb(env);
  await env.DB.prepare(
    `INSERT INTO agent_logs (agent_id, task_id, level, message, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(agentId, taskId || null, level || 'info', message, detail ? JSON.stringify(detail) : null, nowIso()).run();
}

export async function listRecentLogs(env, { agentId, level, limit = 50 } = {}) {
  requireDb(env);
  const clauses = [];
  const vals = [];
  if (agentId) { clauses.push('agent_id = ?'); vals.push(agentId); }
  if (level) { clauses.push('level = ?'); vals.push(level); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT * FROM agent_logs ${where} ORDER BY id DESC LIMIT ?`
  ).bind(...vals, Math.max(1, Math.min(200, Number(limit) || 50))).all();
  return results;
}
