export async function onRequestPost(context) {
  const { env, request } = context;

  const body = await request.json().catch(() => ({}));
  const blogId = env.TUMBLR_BLOG_IDENTIFIER || 'gravityos-deals';
  const title = body.title || 'GRAVITY OS Update';
  const content = body.content || 'New update from GRAVITY OS!';

  const params = new URLSearchParams({
    type: 'text',
    title: title,
    body: content,
  });

  const res = await fetch(`https://api.tumblr.com/v2/blog/${blogId}/post?api_key=${env.TUMBLR_CONSUMER_KEY}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.TUMBLR_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ error: data }, { status: res.status });
  return Response.json({ status: 'ok', data });
}
