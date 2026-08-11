// functions/api/send-tumblr.js
//
// Cloudflare Pages Function: posts a text/link post to Tumblr via the v2 API.
// Tumblr requires OAuth 1.0a (HMAC-SHA1) signing on every request — there is
// no simple webhook or bearer token like Discord/Mastodon, so this file does
// the signing itself using the Web Crypto API (works in the Pages runtime
// without any extra npm packages).
//
// Required secrets (already set via `wrangler pages secret put`):
//   TUMBLR_CONSUMER_KEY
//   TUMBLR_CONSUMER_SECRET
//   TUMBLR_OAUTH_TOKEN
//   TUMBLR_OAUTH_TOKEN_SECRET
//   TUMBLR_BLOG_ID   (e.g. "gravityos.tumblr.com" — no https://)
//
// Expected POST body (JSON):
//   { "title": "optional title", "body": "post content", "url": "optional link", "tags": ["tag1","tag2"] }

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

async function hmacSha1(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function buildOAuthHeader({ method, url, params, consumerKey, consumerSecret, token, tokenSecret }) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: "1.0",
  };

  // Combine oauth params + request body params for the signature base string
  const allParams = { ...oauthParams, ...params };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(String(allParams[k]))}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = await hmacSha1(signingKey, baseString);

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerString = Object.keys(headerParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
    .join(", ");

  return `OAuth ${headerString}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const required = [
    "TUMBLR_CONSUMER_KEY",
    "TUMBLR_CONSUMER_SECRET",
    "TUMBLR_OAUTH_TOKEN",
    "TUMBLR_OAUTH_TOKEN_SECRET",
    "TUMBLR_BLOG_ID",
  ];
  for (const key of required) {
    if (!env[key]) {
      return new Response(
        JSON.stringify({ error: `${key} ยังไม่ถูกตั้งค่าเป็น secret` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { title, body, url: linkUrl, tags } = payload;
  if (!body && !linkUrl) {
    return new Response(
      JSON.stringify({ error: "ต้องมี body หรือ url อย่างน้อยหนึ่งอย่าง" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const blogId = env.TUMBLR_BLOG_ID;
  const apiUrl = `https://api.tumblr.com/v2/blog/${blogId}/post`;

  // NPF-lite via legacy create_post-style params (type=text or type=link)
  const postParams = linkUrl
    ? {
        type: "link",
        title: title || "",
        url: linkUrl,
        description: body || "",
      }
    : {
        type: "text",
        title: title || "",
        body: body,
      };
  if (tags && Array.isArray(tags) && tags.length > 0) {
    postParams.tags = tags.join(",");
  }

  try {
    const authHeader = await buildOAuthHeader({
      method: "POST",
      url: apiUrl,
      params: postParams,
      consumerKey: env.TUMBLR_CONSUMER_KEY,
      consumerSecret: env.TUMBLR_CONSUMER_SECRET,
      token: env.TUMBLR_OAUTH_TOKEN,
      tokenSecret: env.TUMBLR_OAUTH_TOKEN_SECRET,
    });

    const formBody = Object.keys(postParams)
      .map((k) => `${percentEncode(k)}=${percentEncode(postParams[k])}`)
      .join("&");

    const tumblrResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody,
    });

    const result = await tumblrResponse.json();

    if (!tumblrResponse.ok) {
      return new Response(
        JSON.stringify({ error: "tumblr_api_error", detail: result }),
        { status: tumblrResponse.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ status: "ok", result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "unexpected_error", detail: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
