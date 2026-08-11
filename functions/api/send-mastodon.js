// functions/api/send-mastodon.js
//
// Cloudflare Pages Function — โพสต์ข้อความไปยัง Mastodon ผ่าน REST API
// อ่านค่าจาก secret:
//   env.MASTODON_INSTANCE_URL  เช่น "https://mastodon.social"
//   env.MASTODON_ACCESS_TOKEN  access token ของ Application ที่สร้างไว้
//
// เรียกใช้ได้ 2 แบบ:
//   1) ข้อความธรรมดา:  { "status": "ข้อความ" }
//   2) แบบมีโครงสร้าง: { "title": "...", "description": "...", "url": "..." }
//      (จะถูกประกอบเป็นข้อความเดียว เพราะ Mastodon ไม่มี embed แบบ Discord)

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.MASTODON_INSTANCE_URL || !env.MASTODON_ACCESS_TOKEN) {
    return json(
      { error: "MASTODON_INSTANCE_URL หรือ MASTODON_ACCESS_TOKEN ยังไม่ถูกตั้งค่าเป็น secret" },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body ต้องเป็น JSON ที่ valid" }, 400);
  }

  const { status, title, description, url, visibility } = body || {};

  // ประกอบข้อความ: ใช้ "status" ตรง ๆ ถ้ามี ไม่งั้นประกอบจาก title/description/url
  let text = status;
  if (!text) {
    const parts = [title, description, url].filter(Boolean);
    text = parts.join("\n\n");
  }

  if (!text) {
    return json({ error: 'ต้องมีอย่างน้อย "status" หรือ "title"/"description"/"url"' }, 400);
  }

  const instanceUrl = env.MASTODON_INSTANCE_URL.replace(/\/+$/, ""); // ตัด trailing slash

  let mastodonResponse;
  try {
    mastodonResponse = await fetch(`${instanceUrl}/api/v1/statuses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.MASTODON_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        status: text,
        visibility: visibility || "public", // public | unlisted | private | direct
      }),
    });
  } catch (err) {
    return json({ error: "เรียก Mastodon ไม่สำเร็จ", message: err.message }, 502);
  }

  if (!mastodonResponse.ok) {
    const details = await mastodonResponse.text().catch(() => "");
    return json(
      { error: "Mastodon API ปฏิเสธ request", status: mastodonResponse.status, details },
      502
    );
  }

  const result = await mastodonResponse.json().catch(() => null);
  return json({ status: "ok", post_url: result?.url ?? null }, 200);
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
