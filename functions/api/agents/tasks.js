/**
 * functions/api/agents/tasks.js — GRAVITY ARS STEP 1
 * ---------------------------------------------------------
 * GET  /api/agents/tasks?receiverAgent=&status=&limit=   — list tasks
 * POST /api/agents/tasks  { senderAgent, receiverAgent, messageType,
 *                           priority, payload }           — create a task
 *
 * This is the shared task/message bus described in the spec: agents (or,
 * in Step 1, the Admin/a human) communicate through this table instead of
 * hardcoded Agent-to-Agent calls. Step 1 only provides create + list +
 * inspect — actually claiming and executing a task (claimNextTask /
 * completeTask / failTask in _lib/agents/db.js) is wired up starting in
 * Step 2, once individual agents have real work to do.
 */

import { createTask, listTasks, getAgent } from '../../_lib/agents/db.js';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const receiverAgent = url.searchParams.get('receiverAgent') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const limit = url.searchParams.get('limit') || 50;
    const tasks = await listTasks(env, { receiverAgent, status, limit });
    return new Response(JSON.stringify({ ok: true, tasks }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    if (!body.receiverAgent) throw new Error('ต้องระบุ receiverAgent');

    const receiver = await getAgent(env, body.receiverAgent);
    if (!receiver) throw new Error(`ไม่รู้จัก agent "${body.receiverAgent}" — ต้องเป็นหนึ่งใน 13 agent ที่ลงทะเบียนไว้`);

    const task = await createTask(env, {
      senderAgent: body.senderAgent || 'control',
      receiverAgent: body.receiverAgent,
      messageType: body.messageType,
      priority: body.priority,
      payload: body.payload,
      maxRetries: body.maxRetries
    });
    return new Response(JSON.stringify({ ok: true, task }), { headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const id = params.id || new URL(request.url).pathname.split('/').pop();
    const body = await request.json();
    const status = body.status || 'cancelled';
    await env.DB.prepare(
      "UPDATE agent_tasks SET status=?, updated_at=datetime('now') WHERE id=?"
    ).bind(status, id).run();
    return new Response(JSON.stringify({ ok: true, id, status }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const url = new URL(request.url);
    const cancelNoProduct = url.searchParams.get('cancel_no_product');
    if (cancelNoProduct === '1') {
      const result = await env.DB.prepare(
        "UPDATE agent_tasks SET status='cancelled', updated_at=datetime('now') WHERE status='pending' AND payload NOT LIKE '%productId%'"
      ).run();
      return new Response(JSON.stringify({ ok: true, cancelled: result.meta?.changes || 0 }), {
        headers: { 'content-type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ ok: false, error: 'ระบุ action' }), {
      status: 400, headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { 'content-type': 'application/json' }
    });
  }
}
