/**
 * functions/_lib/attention-tracker.js
 * ---------------------------------------------------------------------------
 * Client-side tracking snippet — ฝังใน <script> ของหน้า product/content page
 * ส่ง event ไปที่ /api/track-event
 *
 * วิธีใช้: ใส่ใน layout หรือ article.js ที่ render หน้า product
 *
 * ตัวอย่าง inject ใน HTML:
 *   <script>
 *     window.__gravity = { productId: 248, variantId: 'specificity', channel: 'facebook' };
 *   </script>
 *   <script src="/lib/attention-tracker.js" defer></script>
 *
 * Events ที่ track:
 *   view         — เมื่อ page โหลดครบ
 *   scroll_25/50/75/100 — เมื่อ scroll ถึง % ของหน้า
 *   click        — เมื่อคลิก affiliate link (CTA)
 *   exit         — เมื่อ user กำลังจะออกจากหน้า (visibilitychange หรือ pagehide)
 */

(function () {
  'use strict';

  const cfg = window.__gravity || {};
  const ENDPOINT = '/api/track-event';

  // --- anonymous session id (in-memory only, ไม่ใช้ localStorage/cookie) ---
  const sessionId = cfg.sessionId || (
    Date.now().toString(36) + Math.random().toString(36).slice(2)
  );

  function send(eventType, section) {
    const payload = {
      session_id: sessionId,
      event_type: eventType,
      product_id: cfg.productId || null,
      variant_id: cfg.variantId || null,
      channel: cfg.channel || 'direct',
    };
    if (section) payload.section = section;

    // ใช้ sendBeacon ถ้าทำได้ (ไม่บล็อก unload) ไม่งั้น fallback fetch
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }, keepalive: true })
        .catch(() => {});
    }
  }

  // --- view event ---
  send('view');

  // --- scroll depth tracking ---
  const scrollMilestones = { 25: false, 50: false, 75: false, 100: false };

  function onScroll() {
    const el = document.documentElement;
    const scrolled = el.scrollTop + window.innerHeight;
    const total = el.scrollHeight;
    if (total === 0) return;
    const pct = Math.floor((scrolled / total) * 100);

    for (const [milestone, fired] of Object.entries(scrollMilestones)) {
      if (!fired && pct >= Number(milestone)) {
        scrollMilestones[milestone] = true;
        send(`scroll_${milestone}`);
      }
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // --- affiliate click tracking ---
  // จับ click บน element ที่มี data-section หรือ class ที่เป็น CTA
  document.addEventListener('click', function (e) {
    const target = e.target.closest('a[href], button');
    if (!target) return;

    const section = target.closest('[data-section]')?.dataset?.section || null;
    const href = target.getAttribute('href') || '';

    // เช็คว่าเป็น affiliate link หรือ CTA ปุ่มซื้อ
    const isAffiliate = href.includes('/go/') || href.includes('amzn.to') || href.includes('amazon.com');
    const isCTA = target.classList.contains('cta') || target.dataset.track === 'click';

    if (isAffiliate || isCTA) {
      send('click', section || 'cta');
    }
  });

  // --- exit tracking ---
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      send('exit');
    }
  });

  window.addEventListener('pagehide', function () {
    send('exit');
  });

})();
