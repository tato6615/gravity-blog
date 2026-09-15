# DONE — งานที่เสร็จแล้ว
**Archive เท่านั้น — ไม่ต้องทำซ้ำ**

---

## 2026-09-15

| งาน | หลักฐาน/Commit | ผลลัพธ์ |
|---|---|---|
| **[SEC-001]** Rotate Google Service Account Key (`ga4-views-sync@gen-lang-client-0149890375`) — ลบ key ID `416a0ab80a23970e745fb6dcc846292f705ea2c1` + สร้างใหม่ + อัปเดต GitHub Secret `GA4_SERVICE_ACCOUNT_KEY` | Google Cloud Console | key เก่าถูก revoke ✅ |
| **[SEC-002]** Rotate credentials ที่หลุดทั้งหมด — Discord Webhook URL (สร้างใหม่), Cloudflare API Token (revoke + สร้างใหม่), Telegram Bot Token (revoke ผ่าน @BotFather + สร้างใหม่) | Discord/Cloudflare/Telegram Dashboard | credentials เก่าทั้งหมด revoke ✅ |
| Worker "af": แก้บั๊กสินค้าซ้ำ (check-then-insert race condition) — atomic insert ด้วย UNIQUE constraint | Dashboard Quick Edit | `COUNT(*) = 1` ยืนยันไม่ซ้ำ ✅ |
| **[GRAVITY ARS STEP 1]** ระบบ 13 AI Agents ครบ — registry.js + capabilities.js + agent files ทั้ง 13 ตัว (opportunity, audience, offer, content, media, distribution และ sub-agents) | commit `ad1fd285` | agents โหลดและ register ครบ ✅ |
| **[GRAVITY ARS STEP 2]** control-agent.js — orchestrator กลางที่รับ task จาก tick.js, เลือก agent ที่เหมาะสมจาก registry, และ chain pipeline ตามลำดับ opportunity→audience→offer→content→media→distribution | commit `ad1fd285` | control-agent รัน pipeline ครบ ✅ |
| **[GRAVITY ARS STEP 3]** tick.js อัตโนมัติทุก 10 นาที — Cloudflare Cron Trigger เรียก control-agent.js วน loop ตลอด ไม่ต้องรัน manual | commit `ad1fd285` | tick ยืนยันใน Cloudflare dashboard ✅ |

## 2026-08-14

| งาน | Commit | ผลลัพธ์ |
|---|---|---|
| `/go/[id].js` — แก้ redirect → ดาวน์โหลดไฟล์ | `f1e5a90` | `/go/152` → 302 ✅ |
| `functions/en/product/[slug].js` — เพิ่ม try/catch | `2bf09ab` | ไม่ 500 ดิบแล้ว ✅ |
| `functions/product/[slug].js` — เพิ่ม try/catch | `f1e5a90` | ✅ |
| `functions/index.js` — เพิ่ม try/catch | `eca094f` | `/` → 200 ✅ |
| `functions/en/index.js` — เพิ่ม try/catch | `eca094f` | `/en` → 200 ✅ |
| `functions/community.js` — เพิ่ม try/catch | `eca094f` | `/community` → 200 ✅ |
| Worker "af" Source Adapter Pattern (Amazon/eBay/generic) | Dashboard | root `/` → 200 ✅ |

## 2026-08-13

| งาน | Commit | ผลลัพธ์ |
|---|---|---|
| D1 "too many SQL variables" sort bug | `f642b0a` | Harloon rank 69 → 4 ✅ |
| ลบ debug endpoints (debug-firstseen, debug-sort, debug-encoding) | `8946046`, `c2cca54` | ✅ |
| Community Hub — integrate 4 ไฟล์ (async + D1 + endpoint) | — | `/community` ✅ |

## 2026-08-12

| งาน | Commit | ผลลัพธ์ |
|---|---|---|
| ลบ `_worker.bundle` | `d529e95` | Publish ผ่าน dashboard ✅ |
| Grist 429 cache fix | `8ba1d8c`, `cda04cb` | เว็บปกติ ✅ |
| Homepage search bar | — | Real-time filter ✅ |
| Telegram/Discord/Mastodon publish | — | ยืนยัน 10:02-10:04 ✅ |

## ก่อนหน้า (2026-08-02 ถึง 2026-08-11)

- Phase 0-6 ทั้งหมด (Foundation → Growth/Email) ✅
- Multi-platform publish: Telegram, Discord, Mastodon, Facebook, Threads ✅
- D1 tracking, Grist integration, GA4, Newsletter (Resend) ✅
- System Health Dashboard 14 จุด ✅