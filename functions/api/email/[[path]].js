import { getProductNamesByIds } from '../../_lib/grist.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method === 'POST' && new URL(request.url).pathname.includes('/send-newsletter')) {
    return handleSendNewsletter(env);
  }

  return new Response('Email API', { status: 200 });
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSendNewsletter(env) {
  try {
    if (!env.MAILCHIMP_API_KEY || !env.MAILCHIMP_SERVER || !env.MAILCHIMP_LIST_ID) {
      return jsonResponse({ error: 'Mailchimp not configured' }, 500);
    }

    const topProducts = await env.DB.prepare(`
      SELECT c.product_id as id, COUNT(DISTINCT c.id) as clicks
      FROM clicks c
      WHERE c.timestamp > datetime('now', '-7 days')
      GROUP BY c.product_id
      ORDER BY clicks DESC
      LIMIT 5
    `).all();

    const productIds = topProducts.results.map(p => p.id);
    const nameMap = await getProductNamesByIds(env, productIds);

    const productList = topProducts.results
      .map(p => `<li>${nameMap.get(String(p.id)) || `Product ${p.id}`}: ${p.clicks} clicks</li>`)
      .join('');

    const emailContent = `<h2>Weekly Top Products</h2><ul>${productList}</ul>`;

    const authHeader = { 'Authorization': `Basic ${btoa(`anystring:${env.MAILCHIMP_API_KEY}`)}` };
    const mcBase = `https://${env.MAILCHIMP_SERVER}.api.mailchimp.com/3.0`;

    const campaign = {
      type: 'regular',
      recipients: { list_id: env.MAILCHIMP_LIST_ID },
      settings: {
        subject_line: 'Weekly Top Products',
        from_name: 'Gravity',
        from_email: 'somboon0241@gmail.com',
        reply_to: 'somboon0241@gmail.com',
        title: 'Newsletter'
      }
    };

    const createRes = await fetch(`${mcBase}/campaigns`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });

    const data = await createRes.json();

    if (!createRes.ok) {
      return jsonResponse({ error: JSON.stringify(data) }, createRes.status);
    }

    const contentRes = await fetch(`${mcBase}/campaigns/${data.id}/content`, {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: emailContent }),
    });

    if (!contentRes.ok) {
      return jsonResponse({ error: 'Failed to set content' }, contentRes.status);
    }

    const sendRes = await fetch(`${mcBase}/campaigns/${data.id}/actions/send`, {
      method: 'POST',
      headers: authHeader,
    });

    const sendData = await sendRes.json().catch(() => ({}));

    if (!sendRes.ok) {
      return jsonResponse({ error: `Send failed: ${JSON.stringify(sendData)}` }, sendRes.status);
    }

    return jsonResponse({ success: true, campaignId: data.id }, 200);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
