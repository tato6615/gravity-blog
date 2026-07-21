import { renderHomePage } from '../_lib/home-page.js';

export async function onRequestGet({ env }) {
  return renderHomePage(env, 'en');
}