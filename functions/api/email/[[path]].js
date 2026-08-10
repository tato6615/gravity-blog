// Phase 5: Email automation (Mailchimp integration)

import { getProductNamesByIds } from '../../_lib/grist.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method === 'POST' && new URL(request.url).pathname.includes('/subscribe')) {
    return handleSubscribe(request, env);
  }

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

function getMailchimpConfig(env) {
  const MAILCHIMP_API_KEY = env.MAILCHIMP_API_KEY;
  const MAILCHIMP_SERVER = env.MAILCHIMP_SERVER;
  const MAILCHIMP_LIST_ID = env.MAILCHIMP_LIST_ID;
  const missing = [];
  if (!MAILCHIMP_API_KEY) missing.push('MAILCHIMP_API_KEY');
  if (!MAILCHIMP_SERVER) missing.push('MAILCHIMP_SERVER');
  if (!MAILCHIMP_LIST_ID) missing.push('MAILCHIMP_LIST_ID');
  if (missing.length) {
    return { error: `Mailchimp not configured — missing: ${missing.join(', ')}` };
  }
  return { MAILCHIMP_API_KEY, MAILCHIMP_SERVER, MAILCHIMP_LIST_ID };
}

async function handleSubscribe(request, env) {
  try {
    const { email, name } = await request.json();

    if (!email || !email.includes('@')) {
      return jsonResponse({ error: 'Invalid email address' }, 400);
    }

    const config = getMailchimpConfig(env);
    if (config.error) {
      return jsonResponse({ error: config.error }, 500);
    }

    const { MAILCHIMP_API_KEY, MAILCHIMP_SERVER, MAILCHIMP_LIST_ID } = config;
    const authHeader = { 'Authorization': `Basic ${btoa(`anystring:${MAILCHIMP_API_KEY}`)}` };
    const mcBase = `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0`;

    const subRes = await fetch(`${mcBase}/lists/${MAILCHIMP_LIST_ID}/members`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_address: email,
        status: 'subscribed',
        merge_fields: { FNAME: name || 'Subscriber' },
      }),
    });

    if (!subRes.ok) {
      const subErr = await subRes.json();
      console.error('Mailchimp subscribe error:', subErr);
      return jsonResponse(
        { error: `Mailchimp error: ${subErr.title || subErr.detail || 'Unknown error'}` },
        subRes.status
      );
    }

    await env.DB.prepare(
      'INSERT INTO email_subscribers (email, name, subscribed_at) VALUES (?, ?, ?)'
    ).bind(email, name || null, new Date().toISOString()).run();

    return jsonResponse({ success: true, message: 'Subscribed successfully', email }, 200);
  } catch (error) {
    console.error('Newsletter error:', error);
    return jsonResponse({ error: error.message || 'Failed to subscribe' }, 500);
  }
}

async function handleSendNewsletter(env) {
  try {
    const config = getMailchimpConfig(env);
    if (config.error) {
      return jsonResponse({ error: config.error }, 500);
    }

    const { MAILCHIMP_API_KEY, MAILCHIMP_SERVER, MAILCHIMP_LIST_ID } = config;

    const topProducts = await env.DB.prepare(`
      SELECT 
        c.product_id as id,
        COUNT(DISTINCT c.id) as clicks,
        ROUND(SUM(cv.commission), 2) as commission
      FROM clicks c
      LEFT JOIN conversions cv ON c.product_id = cv.product_id
      WHERE c.timestamp > datetime('now', '-7 days')
      GROUP BY c.product_id
      ORDER BY commission DESC
      LIMIT 5
    `).all();

    const productIds = topProducts.results.map(p => p.id);
    const nameMap = await getProductNamesByIds(env, productIds);

    const productList = topProducts.results
      .map(p => `
        <li>
          <strong>${nameMap.get(String(p.id)) || `Product #${p.id}`}</strong><br/>
          Clicks: ${p.clicks} | Commission: $${p.commission || 0}
        </li>
      `)
      .join('');

    const emailContent = `
      <h2>Weekly Top Products 📊</h2>
      <p>Here are this week's best performers:</p>
      <ul>${productList}</ul>
      <p>Keep optimizing! 🚀</p>
    `;

    const authHeader = { 'Authorization': `Basic ${btoa(`anystring:${MAILCHIMP_API_KEY}`)}` };
    const mcBase = `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0`;

    const campaignPayload = {
      type: 'regular',
      recipients: {
        list_id: MAILCHIMP_LIST_ID
      },
      settings: {
        subject_line: 'Weekly Top Products 📊',
        title: `Weekly Newsletter - ${new Date().toISOString().slice(0, 10)}`,
        from_name: 'Gravity Blog',
        reply_to: env.NEWSLETTER_REPLY_TO || 'noreply@example.com'
      }
    };

    console.log('Mailchimp campaign payload:', JSON.stringify(campaignPayload, null, 2));

    const createRes = await fetch(`${mcBase}/campaigns`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignPayload),
    });

    const campaign = await createRes.json();

    if (!createRes.ok) {
      console.error('Mailchimp create campaign error - Full response:', JSON.stringify(campaign, null, 2));
      const errorMsg = campaign.detail || (campaign.errors && campaign.errors.map(e => `${e.field}: ${e.message}`).join('; ')) || campaign.status || createRes.status;
      throw new Error(`Mailchimp create campaign failed: ${errorMsg}`);
    }

    const contentRes = await fetch(`${mcBase}/campaigns/${campaign.id}/content`, {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: emailContent }),
    });

    if (!contentRes.ok) {
      const contentErr = await contentRes.json();
      throw new Error(`Mailchimp set content failed: ${contentErr.detail || contentRes.status}`);
    }

    const sendRes = await fetch(`${mcBase}/campaigns/${campaign.id}/actions/send`, {
      method: 'POST',
      headers: authHeader,
    });

    if (!sendRes.ok) {
      const sendErr = await sendRes.json().catch(() => ({}));
      throw new Error(`Mailchimp send failed: ${sendErr.detail || sendRes.status}`);
    }

    const subscriberCount = await env.DB.prepare('SELECT COUNT(*) as count FROM email_subscribers').first();

    return jsonResponse({
      success: true,
      message: 'Newsletter sent',
      campaignId: campaign.id,
      subscribers: subscriberCount?.count || 0,
    }, 200);
  } catch (error) {
    console.error('Newsletter error:', error);
    return jsonResponse({ error: error.message || 'Failed to send newsletter' }, 500);
  }
}