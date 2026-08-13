// functions/_lib/community-hub.js
// 🎪 Community Hub — HTML generator for the multi-platform community section
//
// Used by:
//   - functions/index.js      → renderCommunityHub({ mode: 'compact' })  (homepage section, above search bar)
//   - functions/community.js  → renderCommunityHub({ mode: 'full' })     (dedicated /community page)
//
// TODO before going live:
//   1. Replace every `url: '...REPLACE_ME...'` below with the real channel/page link.
//   2. Replace `members` with real counts. Later, if you build
//      functions/api/community-stats.js to pull live numbers from each platform's API,
//      swap these static values for the fetched ones (same shape: string like "1.2K" or null).

export const COMMUNITY_PLATFORMS = [
  {
    key: 'telegram',
    emoji: '📱',
    name: 'Telegram',
    tagline: 'Real-time deals & chat',
    members: '1.2K',
    memberLabel: 'members',
    cta: 'Join',
    url: 'https://t.me/REPLACE_ME',
  },
  {
    key: 'discord',
    emoji: '💬',
    name: 'Discord',
    tagline: 'Community server',
    members: '850',
    memberLabel: 'members',
    cta: 'Join',
    url: 'https://discord.gg/REPLACE_ME',
  },
  {
    key: 'mastodon',
    emoji: '🦣',
    name: 'Mastodon',
    tagline: 'Social feed',
    members: '2.3K',
    memberLabel: 'followers',
    cta: 'Follow',
    url: 'https://mastodon.social/@REPLACE_ME',
  },
  {
    key: 'facebook',
    emoji: '📘',
    name: 'Facebook',
    tagline: 'Organic reach',
    members: null,
    memberLabel: 'followers',
    cta: 'Follow',
    url: 'https://facebook.com/REPLACE_ME',
  },
  {
    key: 'threads',
    emoji: '💬',
    name: 'Threads',
    tagline: 'Meta ecosystem',
    members: null,
    memberLabel: 'followers',
    cta: 'Follow',
    url: 'https://threads.net/@REPLACE_ME',
  },
  {
    key: 'tumblr',
    emoji: '🎨',
    name: 'Tumblr',
    tagline: 'Long-form content',
    members: null,
    memberLabel: 'followers',
    cta: 'Follow',
    url: 'https://REPLACE_ME.tumblr.com',
  },
];

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
  return String(str)
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
    <div class="ch-card" data-platform="${p.key}">
      <div class="ch-card-info">
        <strong class="ch-name">${p.emoji} ${escapeHtml(p.name)}</strong>
        ${memberLine}
      </div>
      <a class="ch-btn" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.cta)}</a>
    </div>`;
}

export function renderCommunityHub({ mode = 'compact', showViewAll = true } = {}) {
  const total = COMMUNITY_PLATFORMS.reduce((sum, p) => sum + parseCount(p.members), 0);
  const cards = COMMUNITY_PLATFORMS.map(renderCard).join('');
  const isFull = mode === 'full';

  return `
    <section class="community-hub community-hub--${mode}">
      <style>
        .community-hub { max-width: 500px; margin: 0 auto; padding: ${isFull ? '2rem 1rem' : '1.5rem 1rem'}; }
        .community-hub h2 { font-size: ${isFull ? '24px' : '18px'}; font-weight: 600; margin: 0 0 4px; }
        .community-hub .ch-sub { color: var(--text-secondary); font-size: 14px; margin: 0 0 1rem; }
        .ch-card {
          background: var(--surface-2);
          border: 0.5px solid var(--border);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ch-name { display: block; font-size: 15px; }
        .ch-meta { font-size: 13px; color: var(--text-secondary); margin: 2px 0 0; }
        .ch-meta--tbd { font-style: italic; opacity: 0.7; }
        .ch-btn {
          flex-shrink: 0;
          padding: 6px 16px;
          border-radius: 8px;
          border: 0.5px solid var(--border);
          background: var(--surface-1, transparent);
          color: inherit;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
        }
        .ch-btn:hover { opacity: 0.8; }
        .ch-total {
          text-align: center;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 0.5px solid var(--border);
        }
        .ch-total p { margin: 0; }
        .ch-total .ch-total-label { color: var(--text-secondary); font-size: 13px; }
        .ch-total .ch-total-number { font-size: 20px; font-weight: 500; }
        .ch-view-all { display: block; text-align: center; margin-top: 1rem; font-size: 13px; color: var(--text-secondary); text-decoration: underline; }
      </style>

      <h2>เข้าชุมชนเรา</h2>
      <p class="ch-sub">เลือกแพลตฟอร์มที่คุณชอบ</p>

      ${cards}

      <div class="ch-total">
        <p class="ch-total-label">ชุมชนทั้งหมด</p>
        <p class="ch-total-number">${formatTotal(total)} members</p>
      </div>

      ${!isFull && showViewAll ? `<a class="ch-view-all" href="/community">ดูทั้งหมด →</a>` : ''}
    </section>`;
}
