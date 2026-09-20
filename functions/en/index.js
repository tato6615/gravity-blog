// /en/ ย้ายมาที่ / แล้ว
// TODO: เปลี่ยน 302 เป็น 301 หลังทดสอบเสร็จ
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  return Response.redirect(`${url.origin}/${url.search}`, 302);
}
