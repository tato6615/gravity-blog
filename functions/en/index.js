import { renderHomePage } from '../_lib/homepage.js';

export async function onRequestGet({ env, request }) {
  return renderHomePage(env, 'en', request);
}
