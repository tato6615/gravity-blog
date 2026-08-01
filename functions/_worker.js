export { onRequest } from './api/click.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return await onRequest({ request, env });
    }
    return new Response('Not Found', { status: 404 });
  }
};
