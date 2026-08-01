import { getProductBuyUrlById } from '../_lib/grist.js';

const TRACK_URL = 'https://af.pakpiromjajaja.workers.dev/api/track-click';

export async function onRequestGet({ params, env, waitUntil }) {
  const productId = params.id;

  let buyUrl;
  try {
    buyUrl = await getProductBuyUrlById(env, productId);
  } catch (e) {
    return new Response('โหลดข้อมูลสินค้าไม่สำเร็จ: ' + e.message, { status: 500 });
  }

  if (!buyUrl) {
    return new Response('ไม่พบลิงก์สินค้านี้', { status: 404 });
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
