#!/usr/bin/env node
/**
 * scripts/reddit-publish-queue.js
 * รันจาก .github/workflows/sync-reddit-queue.yml (cron) — ดึงคิวจาก D1 (publish_queue,
 * channel='reddit', status='pending') มาโพสต์ทีละตัว ผ่าน Cloudflare D1 REST API
 * (ไม่ใช้ wrangler CLI ตรงๆ เพื่อเลี่ยงต้อง auth wrangler ใน CI)
 */

const D1_DATABASE_ID = "da05a906-cf21-4717-a96f-c1da3966fd56";
const GRIST_PRODUCTS_TABLE = process.env.GRIST_PRODUCTS_TABLE || "PRODUCTS";

async function d1Query(sql, params = []) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`D1 query failed: ${JSON.stringify(data.errors)}`);
  return data.result[0].results;
}

async function getRedditAccessToken() {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: process.env.REDDIT_REFRESH_TOKEN }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Reddit auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function getProductInfo(productId) {
  const res = await fetch(
    `https://docs.getgrist.com/api/docs/${process.env.GRIST_DOC_ID}/tables/${GRIST_PRODUCTS_TABLE}/records/${productId}`,
    { headers: { Authorization: `Bearer ${process.env.GRIST_API_KEY}` } }
  );
  const data = await res.json();
  return data.fields || data;
}

async function getSlug(productId) {
  const res = await fetch(
    `https://docs.getgrist.com/api/docs/${process.env.GRIST_DOC_ID}/tables/CONTENT/records?filter=${encodeURIComponent(
      JSON.stringify({ product: [String(productId)], language: ["th"] })
    )}`,
    { headers: { Authorization: `Bearer ${process.env.GRIST_API_KEY}` } }
  );
  const data = await res.json();
  return data.records?.[0]?.fields?.slug || null;
}

async function postToReddit(accessToken, title, url) {
  const res = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({ sr: process.env.REDDIT_SUBREDDIT, kind: "link", title, url, api_type: "json" }),
  });
  const data = await res.json();
  const errors = data.json?.errors;
  if (errors && errors.length) throw new Error(JSON.stringify(errors));
  return data.json?.data?.url;
}

async function main() {
  const pending = await d1Query(
    `SELECT id, product_id FROM publish_queue WHERE channel = 'reddit' AND status = 'pending' LIMIT 5`
  );
  if (!pending.length) {
    console.log("ไม่มีคิว Reddit ค้าง");
    return;
  }

  const accessToken = await getRedditAccessToken();

  for (const row of pending) {
    try {
      const [product, slug] = await Promise.all([getProductInfo(row.product_id), getSlug(row.product_id)]);
      if (!slug) throw new Error("ยังไม่มี slug ใน CONTENT");

      const postUrl = await postToReddit(accessToken, product.product_name, `${process.env.SITE_URL}/product/${slug}`);

      await d1Query(`UPDATE publish_queue SET status = 'done', processed_at = ? WHERE id = ?`, [new Date().toISOString(), row.id]);
      console.log(`โพสต์แล้ว: ${postUrl}`);
    } catch (err) {
      console.error(`product ${row.product_id} ล้มเหลว:`, err.message);
      await d1Query(`UPDATE publish_queue SET status = 'error', processed_at = ? WHERE id = ?`, [new Date().toISOString(), row.id]);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
