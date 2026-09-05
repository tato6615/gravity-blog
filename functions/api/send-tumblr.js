// functions/api/send-tumblr.js
//
// Cloudflare Pages Function — ส่งข้อความ (text post) ไปยัง Tumblr ผ่าน Tumblr API v2
//
// ⭐ ต่างจาก send-discord.js/send-mastodon.js ตรงที่ Tumblr endpoint สำหรับ "เขียน" ข้อมูล
// (สร้างโพสต์) ต้องเซ็นทุก request ด้วย OAuth 1.0a (HMAC-SHA1) เท่านั้น — จะยิงด้วย
// Authorization: Bearer หรือแปะ api_key เป็น query string เฉยๆ (แบบที่เคยลองก่อนหน้านี้)
// ไม่ได้ผล เพราะนั่นใช้ได้แค่กับ endpoint แบบอ่านอย่างเดียว (read-only) เท่านั้น
//
// ต้องตั้ง secret ครบ 5 ตัว (ตามที่ระบุไว้ใน master summary ข้อ 4):
//   echo -n "xxx" | wrangler pages secret put TUMBLR_CONSUMER_KEY --project-name=gravity-blog
//   echo -n "xxx" | wrangler pages secret put TUMBLR_CONSUMER_SECRET --project-name=gravity-blog
//   echo -n "xxx" | wrangler pages secret put TUMBLR_OAUTH_TOKEN --project-name=gravity-blog
//   echo -n "xxx" | wrangler pages secret put TUMBLR_OAUTH_TOKEN_SECRET --project-name=gravity-blog
//   echo -n "xxx" | wrangler pages secret put TUMBLR_BLOG_IDENTIFIER --project-name=gravity-blog
// (blog identifier เช่น "gravityos-deals" หรือ "gravityos-deals.tumblr.com" — ใช้แบบไหนก็ได้ Tumblr รับทั้งคู่)
//
// รับ body: { "title": "...", "content": "...", "tags": ["a","b"] }  (tags เป็น optional)

const TUMBLR_POST_URL_TEMPLATE = (blogId) => `https://api.tumblr.com/v2/blog/${blogId}/post`;

export async function onRequestPost(context) {
  const { request, env } = context;

  const missing = ["TUMBLR_CONSUMER_KEY", "TUMBLR_CONSUMER_SECRET", "TUMBLR_OAUTH_TOKEN", "TUMBLR_OAUTH_TOKEN_SECRET"]
    .filter((k) => !env[k]);
  if (missing.length) {
    return json({ error: `ยังไม่ได้ตั้งค่า secret: ${missing.join(", ")}` }, 500);
  }
  const blogId = env.TUMBLR_BLOG_IDENTIFIER;
  if (!blogId) {
    return json({ error: "ยังไม่ได้ตั้งค่า TUMBLR_BLOG_IDENTIFIER" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body ต้องเป็น JSON ที่ valid" }, 400);
  }

  const { title, content, tags } = body || {};
  if (!title && !content) {
    return json({ error: 'ต้องมีอย่างน้อย "title" หรือ "content"' }, 400);
  }

  // Tumblr legacy /post endpoint รับ form params แบบนี้สำหรับ type=text
  const bodyParams = {
    type: "text",
    title: title || "",
    body: content || "",
  };
  if (Array.isArray(tags) && tags.length) {
    bodyParams.tags = tags.join(",");
  }

  const url = TUMBLR_POST_URL_TEMPLATE(blogId);

  let authHeader;
  try {
    authHeader = await buildOAuth1Header({
      method: "POST",
      url,
      bodyParams,
      consumerKey: env.TUMBLR_CONSUMER_KEY,
      consumerSecret: env.TUMBLR_CONSUMER_SECRET,
      oauthToken: env.TUMBLR_OAUTH_TOKEN,
      oauthTokenSecret: env.TUMBLR_OAUTH_TOKEN_SECRET,
    });
  } catch (err) {
    return json({ error: "สร้าง OAuth signature ไม่สำเร็จ", message: err.message }, 500);
  }

  let tumblrResponse;
  try {
    tumblrResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader,
      },
      body: new URLSearchParams(bodyParams).toString(),
    });
  } catch (err) {
    return json({ error: "เรียก Tumblr ไม่สำเร็จ", message: err.message }, 502);
  }

  const data = await tumblrResponse.json().catch(() => ({}));
  if (!tumblrResponse.ok) {
    return json(
      { error: "Tumblr API ปฏิเสธ request", status: tumblrResponse.status, details: data },
      502
    );
  }

  return json({ status: "ok", postId: data?.response?.id, data }, 200);
}

export async function onRequestGet() {
  return json({ error: "ใช้ method POST เท่านั้น" }, 405);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// OAuth 1.0a (HMAC-SHA1) signing — เขียนเองด้วย Web Crypto API เพราะ
// Cloudflare Pages Functions ไม่มี Node.js `crypto`/OAuth library ให้ import ตรงๆ
// (ต้องใช้ crypto.subtle ซึ่งเป็น Web Standard ที่ Workers runtime รองรับ)
// ─────────────────────────────────────────────────────────────────────────

// RFC 3986 percent-encoding — encodeURIComponent เพียวๆ ไม่เข้ม พอสำหรับ !*'() ต้อง encode เพิ่มเอง
function pctEncode(str) {
  return encodeURIComponent(str).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha1Base64(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signatureBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  const bytes = new Uint8Array(signatureBuf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// method: 'POST' | 'GET' ฯลฯ, url: absolute URL ไม่มี query string, bodyParams: object
// (สำหรับ request แบบ application/x-www-form-urlencoded — body params ต้องรวมเข้าไปใน
// signature base string ด้วยตามสเปก OAuth1, ต่างจากกรณี JSON body ซึ่งไม่ต้องรวม)
async function buildOAuth1Header({ method, url, bodyParams, consumerKey, consumerSecret, oauthToken, oauthTokenSecret }) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: oauthToken,
    oauth_version: "1.0",
  };

  // รวม oauth params + body params เข้าด้วยกันเพื่อสร้าง signature (ตามสเปก OAuth1)
  const allParams = { ...oauthParams, ...bodyParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(String(allParams[k]))}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    pctEncode(url),
    pctEncode(paramString),
  ].join("&");

  const signingKey = `${pctEncode(consumerSecret)}&${pctEncode(oauthTokenSecret)}`;
  const signature = await hmacSha1Base64(signingKey, baseString);

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerStr = Object.keys(headerParams)
    .sort()
    .map((k) => `${pctEncode(k)}="${pctEncode(headerParams[k])}"`)
    .join(", ");

  return `OAuth ${headerStr}`;
}
