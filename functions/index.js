import { renderHomePage } from './_lib/homepage.js';

export async function onRequestGet({ env }) {
  return renderHomePage(env, 'th');
}
