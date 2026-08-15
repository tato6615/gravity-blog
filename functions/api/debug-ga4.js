export async function onRequestGet({ env }) {
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) {
    return new Response(
      JSON.stringify({ error: 'GA4_MEASUREMENT_ID หรือ GA4_API_SECRET ไม่ได้ตั้งใน env' }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  const testPayload = {
    client_id: '1234567890.1234567890',
    events: [{
      name: 'affiliate_click',
      params: {
        product_id: 'debug-test',
        link_url: 'https://example.com/debug-test',
        utm_source: '(debug)',
        utm_medium: '(debug)',
        page_referrer: '(debug)',
      }
    }]
  };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/debug/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      }
    );
    const result = await res.json();
    return new Response(
      JSON.stringify({ sent_payload: testPayload, ga4_status: res.status, ga4_response: result }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}
