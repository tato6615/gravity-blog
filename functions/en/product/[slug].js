import { renderArticlePage } from '../../_lib/article.js';

export async function onRequestGet({ env, params }) {
  return renderArticlePage(env, params.slug, 'en');
}
