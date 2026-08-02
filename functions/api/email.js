// functions/api/email.js
// Phase 5: Email automation (Mailchimp integration)

export async function onRequest(context) {
  const { env, request } = context;

  // GET /api/email/subscribe - Add subscriber
  if (request.method === 'POST' && new URL(request.url).pathname.includes('/subscribe')) {
    return handleSubscribe(request, env);
  }

  // GET /api/email/send-newsletter - Send newsletter
  if (request.method === 'POST' && new URL(request.url).pathname.includes('/send-newsletter')) {
    return handleSendNewsletter(env);
  }

  return new Response('Email API', { status: 200 });
}

// Subscribe user to email list
async function handleSubscribe(request, env) {
  try {
    const { email, name } = await request.json();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
    }

    const MAILCHIMP_API_KEY = env.MAILCHIMP_API_KEY;
    const MAILCHIMP_SERVER = env.MAILCHIMP_SERVER;
    const MAILCHIMP_LIST_ID = env.MAILCHIMP_LIST_ID;

    if (!MAILCHIMP_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Mailchimp not configured' }),
        { status: 500 }
      );
    }

    // Add to Mailchimp
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

    if (response.ok || data.status === 400 && data.title === 'Member Exists') {
      await env.DB.prepare(`
        INSERT INTO email_subscribers (email, name, subscribed_at)
        VALUES (?, ?, ?)
      `).bind(email, name || 'Unknown', new Date()).run();

      return new Response(
        JSON.stringify({ success: true, message: 'Subscribed!' }),
        { status: 200 }
      );
    } else {
      return new Response(
        JSON.stringify({ error: data.detail || 'Subscription failed' }),
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Subscribe error:', error);
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500 }
    );
  }
}

// Send newsletter to subscribers
async function handleSendNewsletter(env) {
  try {
    const MAILCHIMP_API_KEY = env.MAILCHIMP_API_KEY;
    const MAILCHIMP_SERVER = env.MAILCHIMP_SERVER;
    const MAILCHIMP_LIST_ID = env.MAILCHIMP_LIST_ID;

    if (!MAILCHIMP_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Mailchimp not configured' }),
        { status: 500 }
      );
    }

    // Get top products from analytics
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
      .map(p => \`
        <li>
          <strong>\${p.name}</strong><br/>
          Clicks: \${p.clicks} | Commission: $\${p.commission || 0}
        </li>
      \`)
      .join('');

    const emailContent = \`
      <h2>Weekly Top Products 📊</h2>
      <p>Here are this week's best performers:</p>
      <ul>\${productList}</ul>
      <p>Keep optimizing! 🚀</p>
    \`;

    console.log('Newsletter ready to send:', emailContent);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Newsletter prepared',
        subscribers: await env.DB.prepare('SELECT COUNT(*) as count FROM email_subscribers').first(),
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Newsletter error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send newsletter' }),
      { status: 500 }
    );
  }
}
