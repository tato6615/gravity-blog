/**
 * functions/_lib/agents/capabilities.js — GRAVITY ARS STEP 1
 * ---------------------------------------------------------
 * What each agent can DO, kept separate from who it IS (registry.js).
 * Step 1 only declares these — no agent actually executes any of them
 * yet (that's the revenue-engine work explicitly out of scope for this
 * step). Step 2+ implements handlers and wires them to real task types.
 */

export const AGENT_CAPABILITIES = {
  control: ['coordinate_agents', 'assign_tasks', 'route_tasks', 'detect_failures', 'retry_tasks', 'monitor_progress'],
  market: ['discover_markets', 'detect_demand', 'detect_trends', 'identify_problems', 'identify_opportunities'],
  opportunity: ['evaluate_opportunities', 'score_opportunities', 'compare_revenue_potential', 'recommend_opportunities'],
  offer: ['develop_offers', 'evaluate_products', 'identify_affiliate_opportunities', 'improve_offers'],
  audience: ['analyze_audience', 'identify_intent', 'identify_pain_points', 'identify_objections'],
  content: ['create_content_concepts', 'seo_content', 'conversion_content', 'review_content'],
  media: ['image_workflows', 'video_workflows', 'audio_workflows', 'media_asset_management'],
  distribution: ['distribute_content', 'schedule_publishing', 'manage_platforms', 'monitor_publish_status'],
  traffic: ['analyze_traffic', 'identify_traffic_sources', 'optimize_acquisition'],
  conversion: ['optimize_conversion_funnel', 'optimize_cta', 'optimize_landing', 'identify_conversion_issues'],
  revenue: ['track_revenue', 'track_commissions', 'track_transactions', 'calculate_revenue_efficiency'],
  experiment: ['create_experiments', 'create_variants', 'compare_results', 'record_hypotheses'],
  growth: ['scale_proven_patterns', 'identify_new_streams', 'improve_revenue_efficiency']
};

export function getCapabilities(agentId) {
  return AGENT_CAPABILITIES[agentId] || [];
}
