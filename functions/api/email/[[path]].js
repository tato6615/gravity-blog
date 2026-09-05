// functions/api/email/[[path]].js
// Resend version — replaces Mailchimp campaign flow with a simple direct-send API.
// Env vars needed: RESEND_API_KEY, RESEND_FROM_EMAIL (optional, defaults to onboarding@resend.dev)

   import { getProductNamesByIds } from '../../_lib/d1-products.js';

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
    if (!env.RESEND_API_KEY) {
      return jsonResponse({ error: 'Resend not configured (missing RESEND_API_KEY)' }, 500);
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

    const subscribers = await env.DB.prepare(`
      SELECT email FROM email_subscribers
    `).all();

    if (!subscribers.results.length) {
      return jsonResponse({ error: 'No subscribers found' }, 400);
    }

    const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const emailContent = `
      <h2>Weekly Top Products</h2>
      <ul>${productList}</ul>
      <hr>
      <p style="font-size:12px;color:#888">
        You're receiving this because you subscribed to Gravity Blog.
        Reply to this email if you'd like to unsubscribe.
      </p>
    `;

    const batch = subscribers.results.map(s => ({
      from: fromEmail,
      to: s.email,
      subject: 'Weekly Top Products 📊',
      html: emailContent,
    }));

    const sendRes = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });

    const sendData = await sendRes.json().catch(() => ({}));

    if (!sendRes.ok) {
      return jsonResponse({ error: `Send failed: ${JSON.stringify(sendData)}` }, sendRes.status);
    }

    return jsonResponse({ success: true, sentTo: subscribers.results.length, data: sendData }, 200);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
