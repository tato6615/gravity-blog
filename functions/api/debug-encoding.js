export async function onRequestGet({ env }) {
  const res = await fetch(
    `https://docs.getgrist.com/api/docs/${env.GRIST_DOC_ID}/tables/CONTENT/records`,
    { headers: { Authorization: `Bearer ${env.GRIST_API_KEY}` } }
  );

  const debug = {
    responseContentTypeHeader: res.headers.get('content-type'),
  };

  const text = await res.text();
  const json = JSON.parse(text);
  const harloonRow = json.records.find(r => String(r.fields.product) === '138');

  debug.rawSeoTitleFromGrist = harloonRow ? harloonRow.fields.seo_title : null;
  debug.rawBytesFirst20 = harloonRow
    ? Array.from(new TextEncoder().encode(harloonRow.fields.seo_title)).slice(0, 20)
    : null;

  return new Response(JSON.stringify(debug, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
