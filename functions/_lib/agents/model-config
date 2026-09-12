/**
 * functions/_lib/agents/model-config.js — GRAVITY ARS STEP 1
 * ---------------------------------------------------------
 * Model/provider selection kept separate from agent logic and agent
 * identity, so swapping a model or provider never means touching an
 * agent's code — only its row in `agents` (model_provider/model_name)
 * or this default table.
 *
 * Step 1 does not call any AI provider itself (no agent executes real
 * work yet) — this file only defines the *shape* future steps will read
 * from, plus a sensible free-tier-first default per agent, following the
 * same "don't hardcode one provider" principle Worker af's
 * ai-providers.js already uses for the content pipeline.
 */

// Falls back to this when an agent's row has no explicit model_provider.
export const DEFAULT_PROVIDER = 'gemini';
export const DEFAULT_MODEL = 'gemini-3.5-flash';

// Per-agent overrides — deliberately sparse in Step 1. Reasoning/analysis
// agents default to a stronger model; high-volume agents default to a
// cheaper/faster one. Empty for now until Step 2 wires actual calls.
export const AGENT_MODEL_DEFAULTS = {};

export function resolveModelConfig(agentRow) {
  const override = AGENT_MODEL_DEFAULTS[agentRow?.id] || {};
  return {
    provider: agentRow?.model_provider || override.provider || DEFAULT_PROVIDER,
    model: agentRow?.model_name || override.model || DEFAULT_MODEL
  };
}
