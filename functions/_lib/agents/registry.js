/**
 * functions/_lib/agents/registry.js — GRAVITY ARS STEP 1
 * ---------------------------------------------------------
 * Static identity for the 13 agents: id, display name, role description.
 * Deliberately does NOT include capabilities (see capabilities.js) or
 * model/provider config (see model-config.js) — the architecture rules
 * for this step call for identity, capabilities, and model config to be
 * three separate, independently-replaceable concerns.
 *
 * This is the source of truth for what "13 agents" means in code. The
 * `agents` D1 table mirrors these ids — reconcileRegistry() (called from
 * functions/api/agents/status.js) registers any of these not already in
 * D1, and updates identity fields on ones that are, without touching
 * their live status/counters.
 */

export const AGENT_REGISTRY = [
  { id: 'control', name: 'Control Agent', role: 'Coordinates the agent team, routes tasks, retries failures, monitors global progress' },
  { id: 'market', name: 'Market Agent', role: 'Discovers markets, demand, trends, and commercial opportunities' },
  { id: 'opportunity', name: 'Opportunity Agent', role: 'Evaluates and scores opportunities, compares potential revenue' },
  { id: 'offer', name: 'Offer Agent', role: 'Develops and improves offers, products, and affiliate deals' },
  { id: 'audience', name: 'Audience Agent', role: 'Analyzes audience intent, pain points, desires, and objections' },
  { id: 'content', name: 'Content Agent', role: 'Creates content concepts: articles, reviews, SEO, conversion copy' },
  { id: 'media', name: 'Media Agent', role: 'Manages image, video, audio generation workflows and creative variations' },
  { id: 'distribution', name: 'Distribution Agent', role: 'Distributes and schedules content across supported platforms' },
  { id: 'traffic', name: 'Traffic Agent', role: 'Analyzes and optimizes traffic acquisition and sources' },
  { id: 'conversion', name: 'Conversion Agent', role: 'Optimizes visitor to lead to transaction conversion, CTAs, landing experience' },
  { id: 'revenue', name: 'Revenue Agent', role: 'Tracks real revenue, commissions, and transactions only — never estimates' },
  { id: 'experiment', name: 'Experiment Agent', role: 'Creates experiments and variants, measures and compares outcomes' },
  { id: 'growth', name: 'Growth Agent', role: 'Scales proven patterns and continuously searches for new revenue streams' }
];

export function getAgentIdentity(id) {
  return AGENT_REGISTRY.find(a => a.id === id) || null;
}
