// functions/api/debug-env.js
// ไฟล์ diagnostic ชั่วคราว — โชว์แค่ "ชื่อ" ของ env vars ที่ function เห็น
// ไม่โชว์ค่าจริงเพื่อความปลอดภัย ลบไฟล์นี้ทิ้งหลังใช้เสร็จ

export async function onRequestGet(context) {
  const { env } = context;
  const keys = Object.keys(env).sort();
  return new Response(
    JSON.stringify({ visible_env_keys: keys, has_discord_webhook: !!env.DISCORD_WEBHOOK_URL }, null, 2),
    { headers: { "Content-Type": "application/json" } }
  );
}
