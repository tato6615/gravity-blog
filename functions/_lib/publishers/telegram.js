/**
 * functions/_lib/publishers/telegram.js
 * ไม่มี approval gate — ยิงผ่าน Bot API ได้ทันทีหลังสมัคร BotFather
 * ต้องตั้ง TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (เช่น "@gravityos" หรือ channel id ตัวเลข)
 */
export async function publishTelegram(article, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { success: false, error: 'missing TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID' };
  }
  const caption = `${article.title}\n\n${article.url}`;
  const method = article.imageUrl ? 'sendPhoto' : 'sendMessage';
  const body = article.imageUrl
    ? { chat_id: env.TELEGRAM_CHAT_ID, photo: article.imageUrl, caption }
    : { chat_id: env.TELEGRAM_CHAT_ID, text: caption };

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) return { success: false, error: JSON.stringify(data) };
  return { success: true, url: `https://t.me/${String(env.TELEGRAM_CHAT_ID).replace('@', '')}` };
}
