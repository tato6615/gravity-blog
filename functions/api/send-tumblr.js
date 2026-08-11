export async function onRequestPost(context) {
  const { env, request } = context;

  if (!env.TUMBLR_CONSUMER_KEY || !env.TUMBLR_TOKEN) {
    return Response.json({ error: 'Tumblr secrets not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const blogId = env.TUMBLR_BLOG_IDENTIFIER || 'gravityos-deals';
  const title = body.title || 'GRAVITY OS Update';
  const content = body.content || 'New update from GRAVITY OS!';

  const oauth = buildOAuthHeader({
    method: 'POST',
    url: `https://api.tumblr.com/v2/blog/${blogId}/post`,
    consumerKey: env.TUMBLR_CONSUMER_KEY,
    consumerSecret: env.TUMBLR_CONSUMER_SECRET,
    token: env.TUMBLR_TOKEN,
    tokenSecret: env.TUMBLR_TOKEN_SECRET,
  });

  const res = await fetch(`https://api.tumblr.com/v2/blog/${blogId}/post`, {
    method: 'POST',
    headers: { 'Authorization': oauth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'text', title, body: content }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ error: data }, { status: res.status });
  return Response.json({ status: 'ok', data });
}

function buildOAuthHeader({ method, url, consumerKey, consumerSecret, token, tokenSecret }) {
  const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: '1.0',
  };
  const sortedParams = Object.keys(params).sort()
    .map(k => `${encode(k)}=${encode(params[k])}`).join('&');
  const baseString = `${method}&${encode(url)}&${encode(sortedParams)}`;
  const signingKey = `${encode(consumerSecret)}&${encode(tokenSecret)}`;
  const signature = hmacSha1(signingKey, baseString);
  params['oauth_signature'] = signature;
  const headerParams = Object.keys(params).sort()
    .map(k => `${encode(k)}="${encode(params[k])}"`).join(', ');
  return `OAuth ${headerParams}`;
}

function encode(str) {
  return encodeURIComponent(String(str)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

async function hmacSha1(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
