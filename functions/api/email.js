// functions/api/email.js
// Phase 5: Email automation (Mailchimp integration)

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
      return jsonResponse({ error: 'Invalid email' }, 400);
    }

    const config = getMailchimpConfig(env);
    if (config.error) {
      return jsonResponse({ error: config.error }, 500);
    }
    const { MAILCHIMP_API_KEY, MAILCHIMP_SERVER, MAILCHIMP_LIST_ID } = config;

    const response = await fetch(
      `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`anystring:${MAILCHIMP_API_KEY}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: email,
          status: 'subscribed',
          merge_fields: {
            FNAME: name || 'Subscriber',
          },
        }),
      }
    );

    const data = await response.json();
    const isSuccess = response.ok || (data.status === 400 && data.title === 'Member Exists');

    if (isSuccess) {
      try {
        await env.DB.prepare(`
          INSERT INTO email_subscribers (email, name, subscribed_at)
          VALUES (?, ?, ?)
        `).bind(email, name || 'Unknown', new Date().toISOString()).run();
      } catch (dbError) {
        console.error('DB insert error (Mailchimp subscribe already succeeded):', dbError.message);
      }

      return jsonResponse({ success: true, message: 'Subscribed!' }, 200);
    } else {
      return jsonResponse({ error: data.detail || 'Subscription failed' }, 400);
    }
  } catch (error) {
    console.error('Subscribe error:', error);
    return jsonResponse({ error: 'Server error' }, 500);
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
        p.id,
        p.name,
        COUNT(DISTINCT c.id) as clicks,
        ROUND(SUM(cv.commission), 2) as commission
      FROM clicks c
      LEFT JOIN conversions cv ON c.product_id = cv.product_id
      JOIN products p ON c.product_id = p.id
      WHERE c.timestamp > datetime('now', '-7 days')
      GROUP BY p.id
      ORDER BY commission DESC
      LIMIT 5
    `).all();

    const productList = topProducts.results
      .map(p => `
        <li>
          <strong>${p.name}</strong><br/>
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

    const createRes = await fetch(`${mcBase}/campaigns`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'regular',
        recipients: { list_id: MAILCHIMP_LIST_ID },
        settings: {
          subject_line: 'Weekly Top Products 📊',
          title: `Weekly Newsletter - ${new Date().toISOString().slice(0, 10)}`,
          from_name: 'Gravity Blog',
          reply_to: env.NEWSLETTER_REPLY_TO || 'noreply@example.com',
        },
      }),
    });
    const campaign = await createRes.json();
    if (!createRes.ok) {
      throw new Error(`Mailchimp create campaign failed: ${campaign.detail || createRes.status}`);
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
      subscribers: subscriberCount,
    }, 200);
  } catch (error) {
    console.error('Newsletter error:', error);
    return jsonResponse({ error: error.message || 'Failed to send newsletter' }, 500);
  }
}
