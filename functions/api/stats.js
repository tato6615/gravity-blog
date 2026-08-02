export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');

  let start, end;
  if (startParam && endParam) {
    start = startParam;
    end = endParam;
  } else {
    const days = parseInt(daysParam || '30', 10);
    const now = new Date();
    end = now.toISOString();
    start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  const query = `
    WITH click_stats AS (
      SELECT CAST(product_id AS TEXT) as product_id, COUNT(*) as total_clicks
      FROM clicks
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY CAST(product_id AS TEXT)
    ),
    conversion_stats AS (
      SELECT CAST(product_id AS TEXT) as product_id, COUNT(*) as conversions, SUM(commission) as total_commission
      FROM conversions
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY CAST(product_id AS TEXT)
    ),
    all_products AS (
      SELECT product_id FROM click_stats
      UNION
      SELECT product_id FROM conversion_stats
    )
    SELECT
      p.product_id,
      COALESCE(cs.total_clicks, 0) as total_clicks,
      COALESCE(cvs.conversions, 0) as conversions,
      ROUND(COALESCE(cvs.conversions,0) * 100.0 / NULLIF(cs.total_clicks,0), 2) as conversion_rate,
      ROUND(COALESCE(cvs.total_commission,0), 2) as total_commission,
      ROUND(COALESCE(cvs.total_commission,0) / NULLIF(cs.total_clicks,0), 2) as commission_per_click
    FROM all_products p
    LEFT JOIN click_stats cs ON cs.product_id = p.product_id
    LEFT JOIN conversion_stats cvs ON cvs.product_id = p.product_id
    ORDER BY total_commission DESC
    LIMIT 10;
  `;

  try {
    const { results } = await env.DB.prepare(query).bind(start, end, start, end).all();
    return new Response(JSON.stringify({ ok: true, start, end, products: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
