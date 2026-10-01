// functions/_lib/deal-ui.js
// Deal-style UI (mobile-first) for the home page. Pure presentation: every value
// rendered here comes from real article data passed in by homepage.js.
// Icons: Material Symbols (Apache-2.0), inlined as SVG so nothing flashes as text.

import { escapeHtml } from './layout.js';

const ICON_PATHS = {
  arrow_back: 'm274-450 248 248-42 42-320-320 320-320 42 42-248 248h526v60H274Z',
  check: 'M378-246 154-470l43-43 181 181 384-384 43 43-427 427Z',
  error: 'M503.5-289.48q9.5-9.48 9.5-23.5t-9.48-23.52q-9.48-9.5-23.5-9.5t-23.52 9.48q-9.5 9.48-9.5 23.5t9.48 23.52q9.48 9.5 23.5 9.5t23.52-9.48ZM453-433h60v-253h-60v253Zm27.27 353q-82.74 0-155.5-31.5Q252-143 197.5-197.5t-86-127.34Q80-397.68 80-480.5t31.5-155.66Q143-709 197.5-763t127.34-85.5Q397.68-880 480.5-880t155.66 31.5Q709-817 763-763t85.5 127Q880-563 880-480.27q0 82.74-31.5 155.5Q817-252 763-197.68q-54 54.31-127 86Q563-80 480.27-80Zm.23-60Q622-140 721-239.5t99-241Q820-622 721.19-721T480-820q-141 0-240.5 98.81T140-480q0 141 99.5 240.5t241 99.5Zm-.5-340Z',
  expand_more: 'M480-344 240-584l43-43 197 197 197-197 43 43-240 240Z',
  verified_user: 'm436-347 228-228-42-41-183 183-101-101-44 44 142 143Zm44 266q-140-35-230-162.5T160-523v-238l320-120 320 120v238q0 152-90 279.5T480-81Zm0-62q115-38 187.5-143.5T740-523v-196l-260-98-260 98v196q0 131 72.5 236.5T480-143Zm0-337Z',
  local_fire_department: 'M220-400q0 63 28.5 118.5T328-189q-4-12-6-24.5t-2-24.5q0-32 12-60t35-51l113-111 113 111q23 23 35 51t12 60q0 12-2 24.5t-6 24.5q51-37 79.5-92.5T740-400q0-54-23-105.5T651-600q-21 15-44 23.5t-46 8.5q-61 0-101-41.5T420-714v-20q-46 33-83 73t-63 83.5q-26 43.5-40 89T220-400Zm260 24-71 70q-14 14-21.5 31t-7.5 37q0 41 29 69.5t71 28.5q42 0 71-28.5t29-69.5q0-20-7.5-37T551-306l-71-70Zm0-464v132q0 34 23.5 57t57.5 23q18 0 33.5-7.5T622-658l18-22q74 42 117 117t43 163q0 134-93 227T480-80q-134 0-227-93t-93-227q0-128 86-246.5T480-840Z',
  star_fill: 'm233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z',
  bolt: 'm393-165 279-335H492l36-286-253 366h154l-36 255Zm-73 85 40-280H160l360-520h80l-40 320h240L400-80h-80Zm154-396Z',
  notifications: 'M160-200v-60h80v-304q0-84 49.5-150.5T420-798v-22q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v22q81 17 130.5 83.5T720-564v304h80v60H160Zm320-302Zm0 422q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM300-260h360v-304q0-75-52.5-127.5T480-744q-75 0-127.5 52.5T300-564v304Z',
  search: 'M796-121 533-384q-30 26-70 40.5T378-329q-108 0-183-75t-75-181q0-106 75-181t182-75q106 0 180.5 75T632-585q0 43-14 83t-42 75l264 262-44 44ZM377-389q81 0 138-57.5T572-585q0-81-57-138.5T377-781q-82 0-139.5 57.5T180-585q0 81 57.5 138.5T377-389Z',
  trending_up: 'm123-240-43-43 292-291 167 167 241-241H653v-60h227v227h-59v-123L538-321 371-488 123-240Z',
  chevron_right: 'M530-481 332-679l43-43 241 241-241 241-43-43 198-198Z',
  north_east: 'm202-160-42-42 498-498H364v-60h396v396h-60v-294L202-160Z',
  open_in_new: 'M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h279v60H180v600h600v-279h60v279q0 24-18 42t-42 18H180Zm202-219-42-43 398-398H519v-60h321v321h-60v-218L382-339Z',
  compare: 'M422-40v-80H180q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h242v-80h60v880h-60ZM180-222h242v-277L180-222Zm362 102v-375l238 273v-558H542v-60h238q24 0 42 18t18 42v600q0 24-18 42t-42 18H542Z',
  chat: 'M240-399h313v-60H240v60Zm0-130h480v-60H240v60Zm0-130h480v-60H240v60ZM80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z',
  info: 'M453-280h60v-240h-60v240Zm50.5-323.2q9.5-9.2 9.5-22.8 0-14.45-9.48-24.22-9.48-9.78-23.5-9.78t-23.52 9.78Q447-640.45 447-626q0 13.6 9.48 22.8 9.48 9.2 23.5 9.2t23.52-9.2ZM480.27-80q-82.74 0-155.5-31.5Q252-143 197.5-197.5t-86-127.34Q80-397.68 80-480.5t31.5-155.66Q143-709 197.5-763t127.34-85.5Q397.68-880 480.5-880t155.66 31.5Q709-817 763-763t85.5 127Q880-563 880-480.27q0 82.74-31.5 155.5Q817-252 763-197.68q-54 54.31-127 86Q563-80 480.27-80Zm.23-60Q622-140 721-239.5t99-241Q820-622 721.19-721T480-820q-141 0-240.5 98.81T140-480q0 141 99.5 240.5t241 99.5Zm-.5-340Z',
  category: 'm261-526 220-354 220 354H261ZM706-80q-74 0-124-50t-50-124q0-74 50-124t124-50q74 0 124 50t50 124q0 74-50 124T706-80Zm-586-25v-304h304v304H120Zm586.08-35Q754-140 787-173.08q33-33.09 33-81Q820-302 786.92-335q-33.09-33-81-33Q658-368 625-334.92q-33 33.09-33 81Q592-206 625.08-173q33.09 33 81 33ZM180-165h184v-184H180v184Zm189-421h224L481-767 369-586Zm112 0ZM364-349Zm342 95Z',
  check_circle: 'm421-298 283-283-46-45-237 237-120-120-45 45 165 166Zm59 218q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-60q142 0 241-99.5T820-480q0-142-99-241t-241-99q-141 0-240.5 99T140-480q0 141 99.5 240.5T480-140Zm0-340Z',
  sell: 'M863-404 557-97q-9 8.5-20.25 12.75T514.25-80Q503-80 492-84.5T472-97L98-472q-8-8-13-18.96-5-10.95-5-23.04v-306q0-24.75 17.63-42.38Q115.25-880 140-880h307q12.07 0 23.39 4.87Q481.7-870.25 490-862l373 373q9.39 9 13.7 20.25 4.3 11.25 4.3 22.5t-4.5 22.75Q872-412 863-404ZM516-138l306-307-375-375H140v304l376 378ZM245-664q21 0 36.5-15.5T297-716q0-21-15.5-36.5T245-768q-21 0-36.5 15.5T193-716q0 21 15.5 36.5T245-664Zm236 185Z',
  apps: 'M179-179q-19-19-19-47t19-47q19-19 47-19t47 19q19 19 19 47t-19 47q-19 19-47 19t-47-19Zm254 0q-19-19-19-47t19-47q19-19 47-19t47 19q19 19 19 47t-19 47q-19 19-47 19t-47-19Zm254 0q-19-19-19-47t19-47q19-19 47-19t47 19q19 19 19 47t-19 47q-19 19-47 19t-47-19ZM179-433q-19-19-19-47t19-47q19-19 47-19t47 19q19 19 19 47t-19 47q-19 19-47 19t-47-19Zm254 0q-19-19-19-47t19-47q19-19 47-19t47 19q19 19 19 47t-19 47q-19 19-47 19t-47-19Zm254 0q-19-19-19-47t19-47q19-19 47-19t47 19q19 19 19 47t-19 47q-19 19-47 19t-47-19ZM179-687q-19-19-19-47t19-47q19-19 47-19t47 19q19 19 19 47t-19 47q-19 19-47 19t-47-19Zm254 0q-19-19-19-47t19-47q19-19 47-19t47 19q19 19 19 47t-19 47q-19 19-47 19t-47-19Zm254 0q-19-19-19-47t19-47q19-19 47-19t47 19q19 19 19 47t-19 47q-19 19-47 19t-47-19Z',
  campaign: 'M730-450v-60h150v60H730Zm50 290-121-90 36-48 121 90-36 48Zm-82-503-36-48 118-89 36 48-118 89ZM210-200v-160h-70q-24.75 0-42.37-17.63Q80-395.25 80-420v-120q0-24.75 17.63-42.38Q115.25-600 140-600h180l200-120v480L320-360h-50v160h-60Zm250-146v-268l-124 74H140v120h196l124 74Zm100 0v-268q27 24 43.5 58.5T620-480q0 41-16.5 75.5T560-346ZM300-480Z',
  home: 'M220-180h150v-250h220v250h150v-390L480-765 220-570v390Zm-60 60v-480l320-240 320 240v480H530v-250H430v250H160Zm320-353Z',
};

export function icon(name, cls = '') {
  const d = ICON_PATHS[name];
  if (!d) return '';
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

export const DEAL_FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&family=Noto+Sans+Thai:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">';

const HOME_CSS = `
:root{
  --surface:#faf8ff; --lowest:#ffffff; --c-low:#f2f3ff; --c:#eaedff; --c-high:#e2e7ff; --c-highest:#dae2fd;
  --on-surface:#131b2e; --on-variant:#3d4947; --outline:#6d7a77;
  --primary:#00685f; --secondary:#9d4300; --orange:#fd761a; --orange-fixed:#ffdbca; --on-orange-fixed:#341100;
  --tertiary:#006948; --tertiary-c:#00855d; --tertiary-fixed:#85f8c4; --on-tertiary-fixed:#002114;
  --inverse:#283044; --inverse-on:#eef0ff; --error:#ba1a1a;
  --f-head:'Space Grotesk','Noto Sans Thai',system-ui,sans-serif;
  --f-body:'Hanken Grotesk','Noto Sans Thai',system-ui,sans-serif;
  /* legacy vars: community-hub.js / older snippets still read these */
  --bg:var(--surface); --ink:var(--on-surface); --ink-muted:var(--on-variant); --hairline:var(--c-highest);
  --border:var(--c-highest); --surface-2:var(--c-low); --text-secondary:var(--on-variant); --accent:var(--primary);
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body.dl{margin:0;background:var(--surface);color:var(--on-surface);font-family:var(--f-body);font-size:15px;line-height:22px;-webkit-font-smoothing:antialiased;padding-bottom:88px}
.dl a{color:inherit;text-decoration:none}
.dl a:focus-visible,.dl button:focus-visible,.dl input:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.dl h1,.dl h2,.dl h3,.dl p{margin:0}
.ic{width:1em;height:1em;fill:currentColor;flex:none;display:inline-block;vertical-align:middle}

/* header */
.dl-top{position:sticky;top:0;z-index:50;background:rgba(250,248,255,.86);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:0 1px 8px rgba(0,0,0,.04);padding-top:env(safe-area-inset-top,0px)}
.dl-top-in{max-width:1120px;margin:0 auto;height:64px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.dl-brand{display:flex;align-items:center;gap:8px;font:600 18px/26px var(--f-head);letter-spacing:-.01em;color:var(--primary)!important;white-space:nowrap}
.dl-brand svg{width:32px;height:32px;border-radius:9px}
.dl-search{flex:1;max-width:210px;position:relative;display:flex;align-items:center;margin:0 4px;min-width:0}
.dl-search .ic{position:absolute;left:10px;font-size:18px;color:var(--outline);pointer-events:none}
.dl-search input{width:100%;height:36px;padding:0 12px 0 32px;border:0;border-radius:8px;background:var(--lowest);color:var(--on-surface);font:400 13px/18px var(--f-body);box-shadow:0 1px 2px rgba(0,0,0,.03)}
.dl-search input::placeholder{color:var(--outline)}
.dl-top-actions{display:flex;align-items:center;gap:4px}
.dl-bell{position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--on-variant);font-size:24px}
.dl-bell:hover{color:var(--primary)}
.dl-lang{width:32px;height:32px;border-radius:50%;background:var(--primary);color:#fff!important;display:flex;align-items:center;justify-content:center;font:700 11px/1 var(--f-head);letter-spacing:.02em}

/* layout */
.dl-main{max-width:1120px;margin:0 auto;padding:16px 16px 0;display:flex;flex-direction:column;gap:16px}
.dl-sec{background:var(--lowest);border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(19,27,46,.05)}

/* trust bar */
.dl-trust{background:var(--c-low);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:4px;box-shadow:0 1px 2px rgba(19,27,46,.05)}
.dl-trust-l1{display:flex;align-items:center;gap:4px;color:var(--primary);font:600 12px/16px var(--f-body);letter-spacing:.02em;min-width:0}
.dl-trust-l1 .ic{font-size:18px}
.dl-trust-l1 span{color:var(--on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dl-trust-l2{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.dl-pill{display:inline-flex;align-items:center;gap:4px;background:var(--c);padding:2px 8px;border-radius:999px;font:600 12px/16px var(--f-body);letter-spacing:.02em}
.dl-pill .ic{font-size:14px}
.dl-pill.hot{color:var(--secondary);font-weight:700}
.dl-pill.rate{color:var(--primary);font-weight:600}
.dl-live{margin-left:auto;display:flex;align-items:center;gap:2px;color:var(--on-variant);font:400 13px/18px var(--f-body)}
.dl-live i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--tertiary-c);margin-right:2px;animation:dlpulse 2s cubic-bezier(.4,0,.6,1) infinite}
@keyframes dlpulse{50%{opacity:.5}}
@media (prefers-reduced-motion:reduce){.dl-live i{animation:none}}

/* chips */
.dl-chips{margin:0 -16px;padding:0 16px 4px;display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none}
.dl-chips::-webkit-scrollbar{display:none}
.dl-chip{flex:none;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:var(--lowest);color:var(--on-surface);font:600 14px/18px var(--f-body);letter-spacing:.01em;box-shadow:0 1px 2px rgba(19,27,46,.06);white-space:nowrap}
.dl-chip .ic{font-size:16px;color:var(--primary)}
.dl-chip.on{background:var(--inverse);color:var(--inverse-on)}
.dl-chip.on .ic{color:var(--orange)}

/* hero */
.dl-hero{background:var(--lowest);border-radius:12px;padding:16px;box-shadow:0 4px 8px rgba(19,27,46,.08);display:flex;flex-direction:column;gap:8px;overflow:hidden}
.dl-hero-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dl-badge{display:inline-flex;align-items:center;gap:4px;background:var(--orange-fixed);color:var(--on-orange-fixed);font:700 11px/14px var(--f-head);letter-spacing:.04em;padding:4px 10px;border-radius:999px}
.dl-badge .ic{font-size:14px}
.dl-hero-meta{display:inline-flex;align-items:center;gap:4px;color:var(--orange);font:600 12px/16px var(--f-body)}
.dl-hero-meta .ic{font-size:15px}
.dl-hero-body{display:flex;gap:12px;align-items:center}
.dl-hero-media{display:block;position:relative;width:112px;height:112px;border-radius:8px;overflow:hidden;flex:none;background:var(--c-low)}
.dl-hero-media img{width:100%;height:100%;object-fit:contain;padding:6px;background:#fff;display:block}
.dl-tag{position:absolute;left:4px;bottom:4px;max-width:calc(100% - 8px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(218,226,253,.92);color:var(--on-surface);font:700 11px/14px var(--f-head);padding:2px 6px;border-radius:4px}
.dl-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px;color:var(--outline);font:400 11px/14px var(--f-body);background:var(--c-low)}
.dl-hero-txt{display:flex;flex-direction:column;min-width:0;flex:1}
.dl-hero-title{font:600 18px/1.35 var(--f-head);letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.dl-hero-cat{display:flex;align-items:center;gap:4px;margin-top:4px;color:var(--tertiary);font:400 13px/18px var(--f-body)}
.dl-hero-cat .ic{font-size:14px;flex:none}
.dl-hero-cat span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dl-price-xl{font:700 32px/36px var(--f-head);letter-spacing:-.02em;color:var(--orange);margin-top:4px}
.dl-pro{background:var(--c-low);border-radius:8px;padding:10px;display:flex;align-items:flex-start;gap:8px}
.dl-pro .ic{font-size:18px;color:var(--secondary);margin-top:1px}
.dl-pro-t{font:600 12px/16px var(--f-body);letter-spacing:.02em;color:var(--on-surface)}
.dl-cta{display:flex;flex-direction:column;gap:8px;padding-top:4px}
.dl-btn{display:flex;align-items:center;justify-content:center;gap:6px;text-align:center;transition:transform .1s}
.dl-btn:active{transform:scale(.98)}
.dl-btn.main{background:var(--orange);color:#fff!important;font:600 18px/26px var(--f-head);letter-spacing:-.01em;padding:12px 16px;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dl-btn.main:hover{background:var(--secondary)}
.dl-btn.main .ic{font-size:20px}
.dl-btn.alt{background:var(--c);color:var(--primary)!important;font:600 14px/18px var(--f-body);letter-spacing:.01em;padding:8px 12px;border-radius:8px}
.dl-btn.alt:hover{background:var(--c-high)}
.dl-btn.alt .ic{font-size:16px}

/* section head + grid */
.dl-sec-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dl-sec-title{display:flex;align-items:center;gap:6px}
.dl-sec-title .ic{font-size:22px;color:var(--secondary)}
.dl-sec-title h2{font:600 18px/26px var(--f-head);letter-spacing:-.01em}
.dl-more{display:flex;align-items:center;color:var(--primary);font:600 12px/16px var(--f-body);letter-spacing:.02em}
.dl-more .ic{font-size:16px}
.dl-feed{display:flex;flex-direction:column;gap:8px}
.dl-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.dl-card{background:var(--lowest);border-radius:12px;padding:12px;box-shadow:0 1px 2px rgba(19,27,46,.06);display:flex;flex-direction:column;justify-content:space-between}
.dl-card-top{display:flex;flex-direction:column;gap:8px}
.dl-card-media{position:relative;display:block;width:100%;height:128px;border-radius:8px;overflow:hidden;background:var(--c-low)}
.dl-card-media img{width:100%;height:100%;object-fit:contain;padding:6px;background:#fff;display:block}
.dl-rank{position:absolute;top:6px;left:6px;background:var(--tertiary-fixed);color:var(--on-tertiary-fixed);font:700 11px/14px var(--f-head);letter-spacing:.04em;padding:2px 8px;border-radius:999px}
.dl-tags{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.dl-mini{background:var(--c);padding:2px 6px;border-radius:4px;font:700 10px/14px var(--f-head);color:var(--on-surface);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dl-mini.hot{background:var(--orange-fixed);color:var(--on-orange-fixed)}
.dl-mini.new{background:var(--tertiary-fixed);color:var(--on-tertiary-fixed)}
.dl-mini.star{display:inline-flex;align-items:center;gap:2px;background:transparent;padding:2px 0 2px 2px;color:var(--secondary)}
.dl-mini.star .ic{font-size:12px}
.dl-card h3{font:600 14px/1.3 var(--f-body);letter-spacing:.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dl-price-lg{font:700 22px/28px var(--f-head);letter-spacing:-.01em;color:var(--orange)}
.dl-card .dl-btn{margin-top:12px;padding:8px;border-radius:8px;font:700 12px/16px var(--f-body);letter-spacing:.02em}
.dl-card .dl-btn.hi{background:var(--orange);color:#fff!important}
.dl-card .dl-btn.lo{background:var(--c-highest);color:var(--primary)!important}
.dl-card .dl-btn .ic{font-size:14px}

/* compare */
.dl-cmp-wrap{overflow-x:auto;margin:0 -16px;padding:0 16px 8px;scrollbar-width:none}
.dl-cmp-wrap::-webkit-scrollbar{display:none}
.dl-cmp{width:100%;min-width:340px;border-collapse:separate;border-spacing:0;text-align:left}
.dl-cmp th{background:var(--c);color:var(--on-variant);font:600 12px/16px var(--f-body);letter-spacing:.02em;padding:8px 8px;white-space:nowrap}
.dl-cmp th:first-child{border-radius:8px 0 0 8px;padding-left:10px}
.dl-cmp th:last-child{border-radius:0 8px 8px 0;padding-right:10px}
.dl-cmp td{font:400 13px/18px var(--f-body);padding:10px 8px;vertical-align:middle}
.dl-cmp td:first-child{padding-left:10px;min-width:120px}
.dl-cmp td:last-child{padding-right:10px}
.dl-cmp .r{text-align:right}
.dl-cmp .nm{font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dl-cmp tr.best td{background:var(--c-low);font-weight:700}
.dl-cmp tr.best td:first-child{border-radius:8px 0 0 8px}
.dl-cmp tr.best td:last-child{border-radius:0 8px 8px 0}
.dl-cmp tr.best .nm{color:var(--primary)}
.dl-cmp .ok{color:var(--tertiary)}
.dl-cmp tr.best .pr{color:var(--orange)}
.dl-cmp .pr{font-weight:600}
.dl-best{display:inline-block;background:var(--orange);color:#fff;font:700 9px/14px var(--f-body);padding:0 4px;border-radius:4px;margin-top:2px}
.dl-cmp-label{font:700 11px/14px var(--f-head);letter-spacing:.04em;text-transform:uppercase;color:var(--outline);text-align:right;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dl-verdict{text-align:right;color:var(--primary);font:600 12px/16px var(--f-body);letter-spacing:.02em}

/* alerts / community */
.dl-alert{background:linear-gradient(135deg,var(--c),var(--c-high));border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(19,27,46,.05);display:flex;flex-direction:column;gap:10px}
.dl-alert-head{display:flex;align-items:center;gap:8px}
.dl-alert-ic{width:32px;height:32px;border-radius:50%;background:var(--tertiary-c);color:#f5fff7;display:flex;align-items:center;justify-content:center;font-size:18px;flex:none}
.dl-alert h3{font:600 18px/1.3 var(--f-head);letter-spacing:-.01em}
.dl-alert p{color:var(--on-variant);font:400 13px/18px var(--f-body)}
.dl-alert .community-hub--compact{margin:0!important}

/* pagination */
.pg-wrap{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;margin:8px 0 0}
.pg-num,.pg-nav{display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:36px;padding:0 10px;border-radius:8px;background:var(--lowest);box-shadow:0 1px 2px rgba(19,27,46,.06);font:600 14px/1 var(--f-body);color:var(--on-surface);-webkit-tap-highlight-color:transparent}
.pg-num:hover,.pg-nav:hover{color:var(--primary)}
.pg-active{background:var(--inverse);color:var(--inverse-on)!important}
.pg-ellipsis{color:var(--outline);padding:0 4px;user-select:none}
.pg-nav.is-disabled{opacity:.35;pointer-events:none}
.pg-status{width:100%;text-align:center;font:400 12px/16px var(--f-body);color:var(--outline);margin-top:4px}

/* misc */
.dl-none{display:none;color:var(--on-variant);padding:12px 0 4px;font-size:14px}
.dl-empty{text-align:center;padding:64px 16px;color:var(--on-variant)}
.dl-empty p+p{margin-top:8px;font-size:13px}
.dl-foot{padding:8px 0 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}
.dl-foot-h{display:flex;align-items:center;gap:4px;color:var(--outline);font:600 12px/16px var(--f-body);letter-spacing:.02em}
.dl-foot-h .ic{font-size:16px}
.dl-foot p{color:var(--outline);font:400 13px/18px var(--f-body);max-width:440px;padding:0 8px}
.dl-h1{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}

/* bottom nav */
.dl-nav{position:fixed;left:0;right:0;bottom:0;z-index:50;background:rgba(250,248,255,.92);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:0 -2px 12px rgba(0,0,0,.05);padding-bottom:env(safe-area-inset-bottom,0px)}
.dl-nav-in{display:flex;justify-content:space-around;align-items:center;height:64px;padding:0 4px;max-width:560px;margin:0 auto}
.dl-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:56px;height:48px;color:var(--on-variant);font:600 12px/16px var(--f-body);letter-spacing:.02em}
.dl-nav a .ic{font-size:22px}
.dl-nav a span{margin-top:2px}
.dl-nav a.on{color:var(--primary)}
html{scroll-behavior:smooth;scroll-padding-top:76px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}

/* wider screens: same design, more room */
@media (min-width:720px){
  .dl-main{padding-top:24px;gap:20px}
  .dl-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .dl-hero-media{width:176px;height:176px}
  .dl-hero-body{gap:20px}
  .dl-cta{flex-direction:row}
  .dl-cta .dl-btn.main{flex:2}.dl-cta .dl-btn.alt{flex:1}
  .dl-card-media{height:160px}
}
@media (min-width:1000px){
  .dl-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
  body.dl{padding-bottom:0}
  .dl-nav{display:none}
}
`;

const ARTICLE_CSS = `
/* ───────── article page (.dl-art) ───────── */
body.dl-has-bar{padding-bottom:92px!important}
.dl-art{max-width:760px;margin:0 auto;width:100%;display:flex;flex-direction:column;gap:16px}
.dl-back{display:inline-flex;align-items:center;gap:4px;width:fit-content;color:var(--primary)!important;font:600 13px/18px var(--f-body);letter-spacing:.01em}
.dl-back .ic{font-size:18px}
.dl-art-card{background:var(--lowest);border-radius:12px;padding:16px;box-shadow:0 4px 8px rgba(19,27,46,.08);display:flex;flex-direction:column;gap:12px}
.dl-art-tags{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dl-art h1{font:700 26px/34px var(--f-head);letter-spacing:-.02em}
.dl-art .gallery{margin:0}
.dl-art .gallery-main{width:100%;height:300px;object-fit:contain;display:block;background:#fff;border-radius:8px;padding:8px;box-shadow:inset 0 0 0 1px var(--c-highest)}
.dl-art .gallery-strip{display:flex;gap:8px;margin-top:8px;overflow-x:auto;scrollbar-width:none}
.dl-art .gallery-strip::-webkit-scrollbar{display:none}
.dl-art .gallery-thumb{flex:none;width:60px;height:60px;object-fit:contain;background:#fff;border-radius:8px;padding:4px;cursor:pointer;box-shadow:inset 0 0 0 1px var(--c-highest)}
.dl-art .gallery-thumb.is-active{box-shadow:inset 0 0 0 2px var(--orange)}
.dl-art .stars{color:var(--orange);font-size:14px;letter-spacing:1px}
.dl-art .stars .rating-num{color:var(--on-variant);font-size:13px;letter-spacing:0;margin-left:6px}
.dl-art .price-tag{display:block;font:700 32px/36px var(--f-head);letter-spacing:-.02em;color:var(--orange);margin:0}
.dl-art .price-tag .currency{font-size:22px;font-weight:600;margin-right:2px}
.dl-disc{font:400 12px/16px var(--f-body);color:var(--outline)}
.dl-art .share-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0}
.dl-art .share-label{font:600 12px/16px var(--f-body);color:var(--on-variant);margin-right:2px}
.dl-art .share-btn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:var(--c);color:var(--primary)!important;border:0;padding:0;cursor:pointer;font:inherit}
.dl-art .share-btn:hover{background:var(--primary);color:#fff!important}
.dl-meta{font:400 12px/16px var(--f-body);color:var(--on-variant)}
.dl-art .dl-btn.main{width:100%}
.dl-vcard{background:var(--c-low);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px}
.dl-card-h{display:flex;align-items:center;gap:6px;font:600 18px/26px var(--f-head);letter-spacing:-.01em}
.dl-card-h .ic{font-size:22px;color:var(--secondary)}
.dl-aud{font:600 15px/22px var(--f-body)}
.dl-sub{font:700 13px/18px var(--f-head);letter-spacing:.01em;margin-bottom:6px}
.dl-sub.pro{color:var(--tertiary)}
.dl-sub.con{color:var(--secondary)}
.dl-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.dl-list li{display:flex;gap:8px;align-items:flex-start;font:400 15px/22px var(--f-body)}
.dl-list li .ic{font-size:18px;margin-top:2px}
.dl-list.pro li .ic{color:var(--tertiary-c)}
.dl-list.con li .ic{color:var(--secondary)}
.dl-spec{margin:0;display:flex;flex-direction:column}
.dl-spec div{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid var(--c)}
.dl-spec div:last-child{border-bottom:0}
.dl-spec dt{color:var(--on-variant);font:400 14px/20px var(--f-body)}
.dl-spec dd{margin:0;text-align:right;font:600 14px/20px var(--f-body)}
.dl-spec-plain{margin:0;padding-left:1.2em;font:400 14px/22px var(--f-body);color:var(--on-variant)}
.dl-prose{background:var(--lowest);border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(19,27,46,.06)}
.dl-prose h2{font:600 22px/30px var(--f-head);letter-spacing:-.01em;margin:24px 0 8px}
.dl-prose h3{font:600 18px/26px var(--f-head);letter-spacing:-.01em;margin:20px 0 6px}
.dl-prose p{margin:0 0 14px;font:400 16px/1.75 var(--f-body)}
.dl-prose ul,.dl-prose ol{margin:0 0 14px;padding-left:1.3em;font:400 16px/1.7 var(--f-body)}
.dl-prose li{margin-bottom:6px}
.dl-prose>:first-child{margin-top:0}
.dl-prose>:last-child{margin-bottom:0}
.dl-warn{background:var(--orange-fixed);color:var(--on-orange-fixed);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px}
.dl-warn .dl-card-h .ic{color:var(--secondary)}
.dl-warn .dl-list li .ic{color:var(--secondary)}
.dl-faq{display:flex;flex-direction:column;gap:8px}
.dl-faq details{background:var(--c-low);border-radius:8px}
.dl-faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px;font:600 15px/22px var(--f-body)}
.dl-faq summary::-webkit-details-marker{display:none}
.dl-faq summary .ic{font-size:22px;color:var(--primary);transition:transform .15s}
.dl-faq details[open] summary .ic{transform:rotate(180deg)}
.dl-faq details p{margin:0;padding:0 12px 12px;color:var(--on-variant);font:400 15px/22px var(--f-body)}
.dl-art .author-section{display:flex;gap:12px;align-items:flex-start;background:var(--lowest);border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(19,27,46,.06)}
.dl-art .author-avatar{width:44px;height:44px;border-radius:50%;flex:none;background:var(--c)}
.dl-art .author-info h4{margin:0 0 2px;font:600 15px/22px var(--f-head)}
.dl-art .author-info p{margin:0;font:400 13px/18px var(--f-body);color:var(--on-variant)}
.dl-art .author-role{font-weight:600;color:var(--primary)}
.dl-art .tags{display:flex;flex-wrap:wrap;gap:6px}
.dl-art .tag{background:var(--c);color:var(--primary);font:600 12px/16px var(--f-body);padding:4px 10px;border-radius:999px}
.dl-buybar{position:fixed;left:0;right:0;bottom:0;z-index:50;background:rgba(250,248,255,.94);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:0 -2px 12px rgba(0,0,0,.06);padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px))}
.dl-buybar-in{max-width:760px;margin:0 auto;display:flex;align-items:center;gap:12px}
.dl-buybar-price{font:700 22px/28px var(--f-head);letter-spacing:-.01em;color:var(--orange);white-space:nowrap}
.dl-buybar .dl-btn.main{flex:1;width:auto;font-size:16px;line-height:24px;padding:10px 14px}
@media (min-width:720px){.dl-art .gallery-main{height:380px}.dl-art h1{font-size:30px;line-height:38px}}
`;

export const DEAL_CSS = HOME_CSS + ARTICLE_CSS;

const BRAND_MARK = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="9" fill="#00685f"/><text x="16" y="22.5" text-anchor="middle" font-family="'Space Grotesk',sans-serif" font-weight="700" font-size="18" fill="#fff">G</text></svg>`;

// ── small helpers ─────────────────────────────────────────────────────────
const CURRENCY_SYMBOL = { USD: '$', GBP: '£', EUR: '€', JPY: '¥', THB: '฿', HKD: 'HK$', KRW: '₩' };

/** Price exactly as stored (currency-aware). Returns '' when the product has no price. */
export function priceText(product, lang) {
  if (!product) return '';
  if (product.priceAmount != null && product.priceCurrency) {
    const sym = CURRENCY_SYMBOL[product.priceCurrency] || `${product.priceCurrency} `;
    const locale = lang === 'en' ? 'en-US' : 'th-TH';
    return sym + product.priceAmount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return product.price ? String(product.price).trim() : '';
}

/** ตัดเส้นทางหมวดหมู่ยาวๆ ("A > B > C > D") ให้สั้นพอใส่ชิป โดยคงส่วนท้ายที่เจาะจงที่สุดไว้ */
export function shortCat(label, max = 26) {
  const parts = String(label || '').split('>').map(x => x.trim()).filter(Boolean);
  if (!parts.length) return '';
  let out = parts.join(' > ');
  if (out.length > max && parts.length > 1) out = parts.slice(-2).join(' > ');
  if (out.length > max && parts.length > 1) out = parts[parts.length - 1];
  return clip(out, max);
}

function clip(str, max) {
  const s = String(str || '');
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

function ratingNum(product) {
  return product && product.rating != null && !isNaN(Number(product.rating))
    ? Math.max(0, Math.min(5, Number(product.rating))) : null;
}

function articleHref(a, lang) {
  return `${lang === 'en' ? '/en' : ''}/product/${encodeURIComponent(a.slug)}`;
}

function buyHref(a) {
  return a.product && a.product.buyUrl ? `/go/${encodeURIComponent(a.id)}` : null;
}

function searchText(a) {
  return `${a.seoTitle || ''} ${(a.product && a.product.brand) || ''}`.toLowerCase().replace(/"/g, '');
}

// ── sections ──────────────────────────────────────────────────────────────

export function renderTrustBar({ t, count, avgRating }) {
  return `
<section class="dl-trust" aria-label="${escapeHtml(t.trustLine)}">
  <div class="dl-trust-l1">${icon('verified_user')}<span>${escapeHtml(t.trustLine)}</span></div>
  <div class="dl-trust-l2">
    <span class="dl-pill hot">${icon('local_fire_department')} ${escapeHtml(t.trustCount(count))}</span>
    ${avgRating != null ? `<span class="dl-pill rate">${icon('star_fill')} ${escapeHtml(t.trustRating(avgRating.toFixed(2)))}</span>` : ''}
    <span class="dl-live"><i></i> ${escapeHtml(t.liveLabel)}</span>
  </div>
</section>`;
}

/** chips: [{label, href, active, kind:'all'|'cat'}] */
export function renderChips(chips) {
  if (!chips.length) return '';
  return `<nav class="dl-chips" id="categories" aria-label="Categories">${chips.map(c =>
    `<a class="dl-chip${c.active ? ' on' : ''}" href="${escapeHtml(c.href)}" title="${escapeHtml(c.label)}"${c.active ? ' aria-current="page"' : ''}>${icon(c.kind === 'all' ? 'apps' : 'sell')}<span>${escapeHtml(shortCat(c.label))}</span></a>`
  ).join('')}</nav>`;
}

export function renderHero(a, { t, lang, clickCounts, hotThreshold, isNew, topPro, categoryLabel }) {
  const p = a.product;
  const rating = ratingNum(p);
  const price = priceText(p, lang);
  const href = articleHref(a, lang);
  const buy = buyHref(a);
  const isHot = (clickCounts[String(a.id)] || 0) >= hotThreshold;
  const media = p.image
    ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(a.seoTitle)}" fetchpriority="high">`
    : `<div class="dl-noimg">${escapeHtml(t.noImage)}</div>`;
  const rightMeta = rating != null
    ? `<span class="dl-hero-meta">${icon('star_fill')}${rating.toFixed(1)}</span>`
    : (isNew ? `<span class="dl-hero-meta">${escapeHtml(t.newBadge)}</span>` : '');

  return `
<section class="dl-hero" data-search="${escapeHtml(searchText(a))}" aria-label="${escapeHtml(t.heroLabel)}">
  <div class="dl-hero-top">
    <span class="dl-badge">${icon('local_fire_department')} ${escapeHtml(isHot ? `${t.rankLabel} 1 · ${t.hotBadge}` : `${t.rankLabel} 1`)}</span>
    ${rightMeta}
  </div>
  <div class="dl-hero-body">
    <a class="dl-hero-media" href="${href}" tabindex="-1" aria-hidden="true">${media}${p.brand ? `<span class="dl-tag">${escapeHtml(p.brand)}</span>` : ''}</a>
    <div class="dl-hero-txt">
      <a href="${href}"><h2 class="dl-hero-title">${escapeHtml(a.seoTitle)}</h2></a>
      ${categoryLabel ? `<div class="dl-hero-cat">${icon('trending_up')}<span title="${escapeHtml(categoryLabel)}">${escapeHtml(shortCat(categoryLabel, 40))}</span></div>` : ''}
      ${price ? `<div class="dl-price-xl">${escapeHtml(price)}</div>` : ''}
    </div>
  </div>
  ${topPro ? `<div class="dl-pro">${icon('check_circle')}<div class="dl-pro-t">${escapeHtml(topPro)}</div></div>` : ''}
  <div class="dl-cta">
    <a class="dl-btn main" href="${href}"><span>${escapeHtml(t.ctaRead)}</span>${icon('north_east')}</a>
    ${buy ? `<a class="dl-btn alt" href="${buy}" target="_blank" rel="nofollow sponsored noopener"><span>${escapeHtml(t.buyBtn)}</span>${icon('open_in_new')}</a>` : ''}
  </div>
</section>`;
}

export function renderCardGrid(articles, { t, lang, clickCounts, hotThreshold, startRank = 0, newProductIds = new Set() }) {
  return articles.map((a, idx) => {
    const i = startRank + idx;
    const p = a.product;
    const rating = ratingNum(p);
    const price = priceText(p, lang);
    const href = articleHref(a, lang);
    const isHot = i < 3 && (clickCounts[String(a.id)] || 0) >= hotThreshold;
    const isNew = newProductIds.has(String(a.id));
    const media = p.image
      ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(a.seoTitle)}" loading="lazy">`
      : `<div class="dl-noimg">${escapeHtml(t.noImage)}</div>`;
    return `
    <article class="dl-card" data-search="${escapeHtml(searchText(a))}">
      <div class="dl-card-top">
        <a class="dl-card-media" href="${href}" tabindex="-1" aria-hidden="true">${media}<span class="dl-rank">${escapeHtml(t.rankLabel)} ${i + 1}</span></a>
        <div class="dl-tags">
          <span class="dl-mini">${escapeHtml(p.brand || t.fallbackEyebrow)}</span>
          ${isHot ? `<span class="dl-mini hot">${escapeHtml(t.hotBadge)}</span>` : ''}
          ${isNew ? `<span class="dl-mini new">${escapeHtml(t.newBadge)}</span>` : ''}
          ${rating != null ? `<span class="dl-mini star">${icon('star_fill')}${rating.toFixed(1)}</span>` : ''}
        </div>
        <a href="${href}"><h3>${escapeHtml(a.seoTitle)}</h3></a>
        ${price ? `<div class="dl-price-lg">${escapeHtml(price)}</div>` : ''}
      </div>
      <a class="dl-btn ${i < 3 ? 'hi' : 'lo'}" href="${href}"><span>${escapeHtml(t.cardCta)}</span>${icon('north_east')}</a>
    </article>`;
  }).join('');
}

export function renderFeed({ cardsHtml, t, moreHref }) {
  if (!cardsHtml) return '';
  return `
<section class="dl-feed" id="feed">
  <div class="dl-sec-head">
    <div class="dl-sec-title">${icon('trending_up')}<h2>${escapeHtml(t.feedHeading)}</h2></div>
    ${moreHref ? `<a class="dl-more" href="${escapeHtml(moreHref)}">${escapeHtml(t.viewAll)}${icon('chevron_right')}</a>` : ''}
  </div>
  <div class="dl-grid">${cardsHtml}</div>
</section>`;
}

/** Top-N (real ranking) side by side. Columns appear only when the data exists. */
export function renderComparison(items, { t, lang, label }) {
  if (!items || items.length < 2) return '';
  const rows = items.map(a => ({
    a, p: a.product, rating: ratingNum(a.product), price: priceText(a.product, lang),
  }));
  const hasBrand = rows.some(r => r.p.brand);
  const hasRating = rows.some(r => r.rating != null);
  const hasPrice = rows.some(r => r.price);

  const head = `<tr><th>${escapeHtml(t.cmpModel)}</th>${hasBrand ? `<th>${escapeHtml(t.cmpBrand)}</th>` : ''}${hasRating ? `<th>${escapeHtml(t.cmpRating)}</th>` : ''}${hasPrice ? `<th class="r">${escapeHtml(t.cmpPrice)}</th>` : ''}</tr>`;
  const body = rows.map((r, i) => `
    <tr${i === 0 ? ' class="best"' : ''}>
      <td><a href="${articleHref(r.a, lang)}" title="${escapeHtml(r.p.name)}"><span class="nm">${escapeHtml(clip(r.p.name, 60))}</span></a>${i === 0 ? `<span class="dl-best">${escapeHtml(t.rankLabel)} 1</span>` : ''}</td>
      ${hasBrand ? `<td>${r.p.brand ? escapeHtml(clip(r.p.brand, 18)) : '–'}</td>` : ''}
      ${hasRating ? `<td class="ok">${r.rating != null ? `${r.rating.toFixed(1)}/5` : '–'}</td>` : ''}
      ${hasPrice ? `<td class="r pr">${r.price ? escapeHtml(r.price) : '–'}</td>` : ''}
    </tr>`).join('');

  const top = rows[0];
  return `
<section class="dl-sec" id="compare" style="display:flex;flex-direction:column;gap:8px">
  <div class="dl-sec-head">
    <div class="dl-sec-title">${icon('compare')}<h2>${escapeHtml(t.cmpHeading)}</h2></div>
    ${label ? `<span class="dl-cmp-label" title="${escapeHtml(label)}">${escapeHtml(shortCat(label, 24))}</span>` : ''}
  </div>
  <div class="dl-cmp-wrap"><table class="dl-cmp"><thead>${head}</thead><tbody>${body}</tbody></table></div>
  <div class="dl-verdict">${escapeHtml(t.cmpVerdict(clip(top.p.brand || top.p.name, 32)))}</div>
</section>`;
}

/** Wraps the existing Community Hub (already admin-toggled + fed from D1) in the alert card. */
export function renderAlertCard({ t, hubHtml }) {
  if (!hubHtml) return '';
  return `
<section class="dl-alert" id="alerts">
  <div class="dl-alert-head">
    <div class="dl-alert-ic">${icon('chat')}</div>
    <div><h3>${escapeHtml(t.alertTitle)}</h3><p>${escapeHtml(t.alertSub)}</p></div>
  </div>
  ${hubHtml}
</section>`;
}

export function renderPagination({ page, totalPages, t, hrefFor }) {
  if (totalPages <= 1) return '';
  const prev = page > 1 ? hrefFor(page - 1) : null;
  const next = page < totalPages ? hrefFor(page + 1) : null;
  const nums = new Set([1, totalPages]);
  for (let p = page - 2; p <= page + 2; p++) if (p >= 1 && p <= totalPages) nums.add(p);
  let numbersHtml = '';
  let last = 0;
  for (const p of [...nums].sort((x, y) => x - y)) {
    if (last && p - last > 1) numbersHtml += `<span class="pg-ellipsis">…</span>`;
    numbersHtml += p === page
      ? `<span class="pg-num pg-active" aria-current="page">${p}</span>`
      : `<a class="pg-num" href="${escapeHtml(hrefFor(p))}">${p}</a>`;
    last = p;
  }
  return `
<nav class="pg-wrap" aria-label="Pagination">
  ${prev ? `<a class="pg-nav" href="${escapeHtml(prev)}">${escapeHtml(t.pagePrev)}</a>` : `<span class="pg-nav is-disabled">${escapeHtml(t.pagePrev)}</span>`}
  ${numbersHtml}
  ${next ? `<a class="pg-nav" href="${escapeHtml(next)}">${escapeHtml(t.pageNext)}</a>` : `<span class="pg-nav is-disabled">${escapeHtml(t.pageNext)}</span>`}
  <div class="pg-status">${escapeHtml(t.pageOf(page, totalPages))}</div>
</nav>`;
}

export const SEARCH_SCRIPT = `<script>
function filterProductCards(query){
  var q=query.trim().toLowerCase();
  var items=document.querySelectorAll('[data-search]');
  var visible=0;
  items.forEach(function(el){
    var m=!q||el.getAttribute('data-search').indexOf(q)!==-1;
    el.style.display=m?'':'none';
    if(m)visible++;
  });
  var n=document.getElementById('searchNoResults');
  if(n)n.style.display=(q&&visible===0)?'block':'none';
}
</script>`;

/**
 * Full page body: sticky header, main content, footer note, bottom nav.
 * `nav` items are built by the caller from real anchors only.
 */
export function renderDealBody({ t, homeHref, altLangPath, langLabel, hasSearch, hasAlerts, mainHtml, footerParagraphs, navItems = [], bottomHtml = null }) {
  const search = hasSearch ? `
    <div class="dl-search">${icon('search')}<input type="text" id="sbInput" placeholder="${escapeHtml(t.searchPlaceholder)}" aria-label="${escapeHtml(t.searchPlaceholder)}" autocomplete="off" oninput="filterProductCards(this.value)"></div>` : '<div style="flex:1"></div>';
  const bell = hasAlerts ? `<a class="dl-bell" href="#alerts" aria-label="${escapeHtml(t.alertTitle)}">${icon('notifications')}</a>` : '';
  const lang = altLangPath ? `<a class="dl-lang" href="${escapeHtml(altLangPath)}" aria-label="Language">${escapeHtml(langLabel)}</a>` : '';

  return `
<header class="dl-top"><div class="dl-top-in">
  <a class="dl-brand" href="${homeHref}">${BRAND_MARK}<span>GRAVITY OS</span></a>${search}
  <div class="dl-top-actions">${bell}${lang}</div>
</div></header>
<main class="dl-main">
${mainHtml}
  <footer class="dl-foot">
    <div class="dl-foot-h">${icon('info')}<span>${escapeHtml(t.disclosureTitle)}</span></div>
    ${footerParagraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
  </footer>
</main>
${bottomHtml !== null ? bottomHtml : `<nav class="dl-nav" aria-label="Primary"><div class="dl-nav-in">${navItems.map(n =>
  `<a href="${escapeHtml(n.href)}"${n.active ? ' class="on" aria-current="page"' : ''}>${icon(n.icon)}<span>${escapeHtml(n.label)}</span></a>`).join('')}</div></nav>`}`;
}