// functions/api/funnel-stats.js
//
// GET /api/funnel-stats?product_id=248&days=30
//
// Returns real funnel data from `attention_events` for the Attention dashboard (P1.1):
//   - overall funnel (view -> scroll_25 -> scroll_50 -> scroll_75 -> scroll_100 -> click) + drop-off %
//   - by_channel  (session share per channel)
//   - by_variant  (views/clicks/CTR per variant_id)
//   - by_section  (event counts per content section: review/buying_guide/faq/cta)
//
// D1 binding assumed to be `env.DB` — rename below if your wrangler.toml uses a different binding name.
//
// NOTE on "conversion" stage:
//   `attention_events` has no conversion event — conversions live in a separate
//   `conversions` table (per backlog: click_id / Amazon Associates import).
//   This endpoint does NOT join conversions yet because I don't have that table's
//   schema. Once you share it (or confirm the table/column names), I'll add a
//   `conversion` stage to the funnel via a join on click_id / product_id.

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");
  const days = parseInt(url.searchParams.get("days") || "30", 10);

  try {
    const sinceClause = `datetime('now', '-${days} days')`;
    const productFilter = productId ? "AND product_id = ?" : "";
    const bindings = productId ? [productId] : [];

    // 1. Overall funnel counts by event_type
    const funnelSql = `
      SELECT event_type, COUNT(*) as count, COUNT(DISTINCT session_id) as unique_sessions
      FROM attention_events
      WHERE ts >= ${sinceClause} ${productFilter}
      GROUP BY event_type
    `;
    const funnelRows = (await env.DB.prepare(funnelSql).bind(...bindings).all()).results;

    // 2. By channel (based on 'view' events, since channel is detected on page load)
    const channelSql = `
      SELECT channel, COUNT(DISTINCT session_id) as sessions
      FROM attention_events
      WHERE event_type = 'view' AND channel IS NOT NULL AND ts >= ${sinceClause} ${productFilter}
      GROUP BY channel
      ORDER BY sessions DESC
    `;
    const channelRows = (await env.DB.prepare(channelSql).bind(...bindings).all()).results;

    // 3. By variant (view -> click CTR per hook variant)
    const variantSql = `
      SELECT
        variant_id,
        SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views,
        SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks
      FROM attention_events
      WHERE variant_id IS NOT NULL AND ts >= ${sinceClause} ${productFilter}
      GROUP BY variant_id
    `;
    const variantRows = (await env.DB.prepare(variantSql).bind(...bindings).all()).results;

    // 4. By section (which part of the article people drop off at)
    const sectionSql = `
      SELECT section, event_type, COUNT(*) as count
      FROM attention_events
      WHERE section IS NOT NULL AND ts >= ${sinceClause} ${productFilter}
      GROUP BY section, event_type
    `;
    const sectionRows = (await env.DB.prepare(sectionSql).bind(...bindings).all()).results;

    // --- shape the response ---

    const STAGES = ["view", "scroll_25", "scroll_50", "scroll_75", "scroll_100", "click"];
    const countByStage = Object.fromEntries(funnelRows.map(r => [r.event_type, r.count]));
    let prev = null;
    const funnel = STAGES.map(stage => {
      const count = countByStage[stage] || 0;
      const dropoff_pct = prev !== null && prev > 0
        ? Math.round(((prev - count) / prev) * 100)
        : 0;
      prev = count;
      return { stage, count, dropoff_pct };
    });

    const byVariant = variantRows
      .map(v => ({
        variant_id: v.variant_id,
        views: v.views,
        clicks: v.clicks,
        ctr_pct: v.views > 0 ? Math.round((v.clicks / v.views) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.ctr_pct - a.ctr_pct);

    const totalChannelSessions = channelRows.reduce((s, r) => s + r.sessions, 0);
    const byChannel = channelRows.map(c => ({
      channel: c.channel,
      sessions: c.sessions,
      share_pct: totalChannelSessions > 0
        ? Math.round((c.sessions / totalChannelSessions) * 1000) / 10
        : 0
    }));

    const bySection = {};
    for (const row of sectionRows) {
      if (!bySection[row.section]) bySection[row.section] = {};
      bySection[row.section][row.event_type] = row.count;
    }

    return Response.json({
      ok: true,
      product_id: productId || "all",
      days,
      funnel,
      by_channel: byChannel,
      by_variant: byVariant,
      by_section: bySection,
      has_data: funnel.some(f => f.count > 0)
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
