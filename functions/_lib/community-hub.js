// functions/_lib/community-hub.js
// 🎪 Community Hub — HTML generator (platform list stored in D1, editable from admin)

export const DEFAULT_PLATFORMS = [
  { key: 'telegram', emoji: '📱', name: 'Telegram', tagline: 'Real-time deals & chat', members: null, memberLabel: 'members', cta: 'Join', url: 'https://t.me/+WGeLknFUTpIzNTJl' },
  { key: 'discord', emoji: '💬', name: 'Discord', tagline: 'Community server', members: null, memberLabel: 'members', cta: 'Join', url: 'https://discord.gg/ZssCDTJ95' },
  { key: 'mastodon', emoji: '🦣', name: 'Mastodon', tagline: 'Social feed', members: null, memberLabel: 'followers', cta: 'Follow', url: 'https://mastodon.social/@GravityOS' },
  { key: 'facebook', emoji: '📘', name: 'Facebook', tagline: 'Organic reach', members: null, memberLabel: 'followers', cta: 'Follow', url: 'https://www.facebook.com/profile.php?id=61591796983643' },
  { key: 'threads', emoji: '💬', name: 'Threads', tagline: 'Meta ecosystem', members: null, memberLabel: 'followers', cta: 'Follow', url: 'https://www.threads.com/@inangtato?igshid=NTc4MTIwNjQ2YQ==' },
];

async function getPlatforms(env) {
  if (!env || !env.DB) return DEFAULT_PLATFORMS;
  try {
    const cache = caches.default;
    const cacheKey = new Request('https://cache.internal/community-platforms-data');
    const cached = await cache.match(cacheKey);
    if (cached) {
      const data = await cached.json();
      return Array.isArray(data) && data.length ? data : DEFAULT_PLATFORMS;
    }
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('community_platforms').first();
    const parsed = row ? JSON.parse(row.value) : null;
    const list = Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PLATFORMS;
    const resp = new Response(JSON.stringify(list), { headers: { 'Cache-Control': 'max-age=60' } });
    await cache.put(cacheKey, resp.clone());
    return list;
  } catch {
    return DEFAULT_PLATFORMS;
  }
}

function parseCount(v) {
  if (!v) return 0;
  const s = String(v).trim().toUpperCase();
  if (s.endsWith('K')) return Math.round(parseFloat(s) * 1000);
  if (s.endsWith('M')) return Math.round(parseFloat(s) * 1000000);
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function formatTotal(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K+`;
  return `${n}+`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCard(p) {
  const memberLine = p.members
    ? `<p class="ch-meta">${escapeHtml(p.members)} ${escapeHtml(p.memberLabel)}</p>`
    : `<p class="ch-meta ch-meta--tbd">${escapeHtml(p.memberLabel)}</p>`;
  return `
    <div class="ch-card" data-platform="${escapeHtml(p.key)}">
      <div class="ch-card-info">
        <strong class="ch-name">${escapeHtml(p.emoji)} ${escapeHtml(p.name)}</strong>
        ${memberLine}
      </div>
      <a class="ch-btn" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.cta)}</a>
    </div>`;
}

function renderChip(p) {
  return `<a class="ch-chip" data-platform="${escapeHtml(p.key)}" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">
    <span class="ch-chip-emoji">${escapeHtml(p.emoji)}</span>
    <span class="ch-chip-name">${escapeHtml(p.name)}</span>
  </a>`;
}

/**
 * @param {object} opts
 * @param {'compact'|'full'} [opts.mode]
 * @param {boolean} [opts.showViewAll]
 * @param {object} [opts.env]
 * @param {string} [opts.searchBoxHtml] - Optional raw HTML for a search button/input
 *   (compact mode only). Rendered as the FIRST item in the chip row, to the left
 *   of the Telegram/Discord/... chips.
 */
export async function renderCommunityHub({ mode = 'compact', showViewAll = true, env, searchBoxHtml = '' } = {}) {
  const platforms = await getPlatforms(env);
  const isFull = mode === 'full';

  if (!platforms.length) return '';

  if (!isFull) {
    const chips = platforms.map(renderChip).join('');
    return `
      <section class="community-hub community-hub--compact">
        <style>
          .community-hub--compact { max-width: 700px; margin: 0 auto 20px; }
          .ch-chip-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
          .ch-chip {
            display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px;
            border-radius: 20px; border: 0.5px solid var(--border, var(--hairline));
            background: var(--surface-2, var(--surface)); color: inherit; text-decoration: none;
            font-size: 13px; font-weight: 500; white-space: nowrap;
          }
          .ch-chip:hover { opacity: 0.75; }
          .ch-chip-emoji { font-size: 15px; line-height: 1; }
          .ch-view-all-chip { font-size: 12.5px; color: var(--text-secondary, var(--ink-muted)); text-decoration: underline; padding: 7px 4px; white-space: nowrap; }

          /* Search button/input, placed first in the chip row */
          .sb-wrap { position: relative; display: inline-flex; align-items: center; flex-shrink: 0; }
          .sb-btn {
            width: 36px; height: 36px; border-radius: 50%;
            border: 0.5px solid var(--border, var(--hairline)); background: var(--surface-2, var(--surface));
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 15px; flex-shrink: 0; transition: border-color .15s;
            color: inherit;
          }
          .sb-btn:hover { opacity: 0.75; }
          .sb-input {
            position: absolute; left: 42px; top: 50%; transform: translateY(-50%);
            width: 0; opacity: 0; pointer-events: none;
            box-sizing: border-box; height: 36px; padding: 0;
            border: 0.5px solid var(--border, var(--hairline)); border-radius: 10px;
            background: var(--surface); color: inherit;
            font-size: 14px; font-family: inherit;
            transition: width .25s ease, opacity .2s ease, padding .2s ease;
            z-index: 5;
          }
          .sb-input.open { width: 200px; opacity: 1; pointer-events: auto; padding: 0 12px; }
          @media (max-width: 400px) { .sb-input.open { width: calc(100vw - 90px); } }
        </style>
        <div class="ch-chip-row">
          ${searchBoxHtml}
          ${chips}
          ${showViewAll ? `<a class="ch-view-all-chip" href="/community">ดูชุมชนทั้งหมด →</a>` : ''}
        </div>
      </section>`;
  }

  const total = platforms.reduce((sum, p) => sum + parseCount(p.members), 0);
  const cards = platforms.map(renderCard).join('');

  return `
    <section class="community-hub community-hub--full">
      <style>
        .community-hub { max-width: 500px; margin: 0 auto; padding: 2rem 1rem; }
        .community-hub h2 { font-size: 24px; font-weight: 600; margin: 0 0 4px; }
        .community-hub .ch-sub { color: var(--text-secondary); font-size: 14px; margin: 0 0 1rem; }
        .ch-card { background: var(--surface-2); border: 0.5px solid var(--border); border-radius: 12px; padding: 1rem; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
        .ch-name { display: block; font-size: 15px; }
        .ch-meta { font-size: 13px; color: var(--text-secondary); margin: 2px 0 0; }
        .ch-meta--tbd { font-style: italic; opacity: 0.7; }
        .ch-btn { flex-shrink: 0; padding: 6px 16px; border-radius: 8px; border: 0.5px solid var(--border); background: var(--surface-1, transparent); color: inherit; font-size: 13px; font-weight: 500; text-decoration: none; }
        .ch-btn:hover { opacity: 0.8; }
        .ch-total { text-align: center; margin-top: 1.5rem; padding-top: 1rem; border-top: 0.5px solid var(--border); }
        .ch-total p { margin: 0; }
        .ch-total .ch-total-label { color: var(--text-secondary); font-size: 13px; }
        .ch-total .ch-total-number { font-size: 20px; font-weight: 500; }
      </style>
      <h2>เข้าชุมชนเรา</h2>
      <p class="ch-sub">เลือกแพลตฟอร์มที่คุณชอบ</p>
      ${cards}
      <div class="ch-total">
        <p class="ch-total-label">ชุมชนทั้งหมด</p>
        <p class="ch-total-number">${formatTotal(total)} members</p>
      </div>
    </section>`;
}