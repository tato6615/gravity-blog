export async function onRequest(context) {
  const data = await context.request.json();
  
  // Log ออกมา เดี๋ยวอ่านจาก log
  console.log('Telegram Update:', JSON.stringify(data, null, 2));
  
  // Extract chat_id
  const update = data.message || data.channel_post;
  if (update) {
    const chatId = update.chat.id;
    console.log('Chat ID:', chatId);
    return new Response(JSON.stringify({ status: 'ok', chat_id: chatId }));
  }
  
  return new Response(JSON.stringify({ status: 'ok' }));
}
