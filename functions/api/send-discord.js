// functions/api/send-discord.js
//
// Cloudflare Pages Function — ส่งข้อความไปยัง Discord ผ่าน Incoming Webhook
// อ่าน URL ของ webhook จาก secret: env.DISCORD_WEBHOOK_URL
// (ตั้งไว้แล้วด้วย: wrangler pages secret put DISCORD_WEBHOOK_URL --project-name=gravity-blog)
//
// เรียกใช้ได้ 2 แบบ:
//   1) ข้อความธรรมดา:      { "content": "ข้อความ" }
//   2) แบบ embed (การ์ด):  { "title": "...", "description": "...", "url": "...", "color": 5793266 }
// ใส่ทั้งคู่พร้อมกันก็ได้

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DISCORD_WEBHOOK_URL) {
    return json({ error: "DISCORD_WEBHOOK_URL ยังไม่ถูกตั้งค่าเป็น secret" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body ต้องเป็น JSON ที่ valid" }, 400);
  }

  const { content, title, description, url, color } = body || {};

  if (!content && !title && !description) {
    return json(
      { error: 'ต้องมีอย่างน้อย "content" หรือ "title"/"description"' },
      400
    );
  }

  const payload = {};
  if (content) payload.content = content;

  if (title || description) {
    payload.embeds = [
      {
        title,
        description,
        url,
        color: color ?? 0x5865f2, // สีม่วง Discord เป็นค่าเริ่มต้น
        timestamp: new Date().toISOString(),
      },
    ];
  }

  let discordResponse;
  try {
    discordResponse = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return json({ error: "เรียก Discord ไม่สำเร็จ", message: err.message }, 502);
  }

  // Discord ตอบ 204 No Content เมื่อสำเร็จ
  if (!discordResponse.ok) {
    const details = await discordResponse.text().catch(() => "");
    return json(
      { error: "Discord API ปฏิเสธ request", status: discordResponse.status, details },
      502
    );
  }

  return json({ status: "ok" }, 200);
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
