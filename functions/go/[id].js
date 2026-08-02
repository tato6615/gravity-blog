import { getProductBuyUrlById } from '../_lib/grist.js';

const TRACK_URL = 'https://af.pakpiromjajaja.workers.dev/api/track-click';

export async function onRequestGet({ params, env, waitUntil }) {
  const productId = params.id;

  let buyUrl;
  try {
    buyUrl = await getProductBuyUrlById(env, productId);
  } catch (e) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>เกิดข้อผิดพลาด</title>
       <body style="font-family:sans-serif;padding:40px;text-align:center;">
         <p>โหลดข้อมูลสินค้าไม่สำเร็จ: ${e.message}</p>
         <p><a href="/">← กลับหน้าแรก</a></p>
       </body>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (!buyUrl) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>ไม่พบลิงก์สินค้านี้</title>
       <body style="font-family:sans-serif;padding:40px;text-align:center;">
         <p>ไม่พบลิงก์สินค้านี้ (product id: ${productId})</p>
         <p><a href="/">← กลับหน้าแรก</a></p>
       </body>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  waitUntil(
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    }).catch(() => {})
  );

  return Response.redirect(buyUrl, 302);
}
