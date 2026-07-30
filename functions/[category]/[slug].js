/**
 * functions/[category]/[slug].js
 * 
 * Category-based routing for products. Routes like:
 * /pets/best-dog-toy/
 * /camera-gear/best-dslr/
 * /lifestyle/best-pillow/
 */

import { renderArticlePage } from '../_lib/article.js';

const VALID_CATEGORIES = new Set([
  'pets',
  'camera-gear',
  'lifestyle',
  'tech',
  'home',
  'wellness',
  'outdoor',
  'gaming'
  // ADD MORE CATEGORIES HERE
]);

function isCategoryMatch(category, article) {
  if (!article || !article.category) return true;
  return article.category.toLowerCase() === category.toLowerCase();
}

export async function onRequest(context) {
  const { params, request, env } = context;
  const { category, slug } = params;
  const urlObj = new URL(request.url);
  const lang = urlObj.pathname.startsWith('/en/') ? 'en' : 'th';

  if (!VALID_CATEGORIES.has(category)) {
    return new Response('Category not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=UTF-8' }
    });
  }

  try {
    const response = await renderArticlePage(env, slug, lang);
    if (response.status === 404) {
      return response;
    }
    return response;
  } catch (e) {
    return new Response(`Error: ${e.message}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=UTF-8' }
    });
  }
}