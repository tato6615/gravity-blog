/**
 * functions/_lib/agents/control-agent.js — GRAVITY ARS STEP 1
 * ---------------------------------------------------------
 * The Control Agent's Step 1 responsibilities, kept deliberately small:
 *   1. reconcileRegistry() — make sure all 13 agents exist in D1 and
 *      their identity/capabilities are current (idempotent, safe to call
 *      on every status request).
 *   2. detectStale() — flag agents that claimed a task and went quiet
 *      (WORKING with no activity for a while) as a system-health signal.
 *
 * What it does NOT do yet (Step 2+): decide what task to run next based
 * on business logic, call any AI provider, or perform any revenue action.
 * That's the "entire revenue engine" the spec explicitly says Step 1
 * should not build.
 */

import { AGENT_REGISTRY } from './registry.js';
import { getCapabilities } from './capabilities.js';
import { registerAgent, listAgents } from './db.js';

export async function reconcileRegistry(env) {
  for (const identity of AGENT_REGISTRY) {
    await registerAgent(env, {
      id: identity.id,
      name: identity.name,
      role: identity.role,
      capabilities: getCapabilities(identity.id)
    });
  }
  return await listAgents(env);
}

const STALE_WORKING_MINUTES = 30;

// An agent that's been WORKING for longer than this without a fresh
// last_activity_at is presented to the Admin as an alert (system.
// staleAgents) — Step 1 only surfaces this; automatic recovery/retry of
// the underlying task is future work (see spec's "escalate only when the
// system cannot recover automatically").
export function detectStale(agents) {
  const cutoff = Date.now() - STALE_WORKING_MINUTES * 60 * 1000;
  return agents.filter(a => {
    if (a.status !== 'WORKING') return false;
    const last = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
    return last < cutoff;
  });
}
