# CREDENTIALS STATUS — GRAVITY OS
**ไฟล์นี้ไม่มีค่า secret จริง — มีแค่สถานะ**

---

## 🔴 ต้องดำเนินการทันที

| Credential | ปัญหา | สิ่งที่ต้องทำ |
|---|---|---|
| Google Service Account Key `416a0ab80a23...` | หลุดในแชท | ลบ + สร้างใหม่ → อัปเดต GitHub Secret `GA4_SERVICE_ACCOUNT_KEY` |

---

## ⚠️ หลุดในอดีต — ยังไม่ได้ rotate (ความเสี่ยงปานกลาง)

| Credential | สถานะ | Action ที่ต้องทำ |
|---|---|---|
| Discord Webhook URL | หลุดในแชทก่อนหน้า | Regenerate ใน Discord Server Settings |
| Cloudflare API Token เก่า | หลุดในแชท | Revoke ใน Cloudflare Dashboard |
| Telegram Bot Token เก่า | หลุดในแชท 2 ครั้ง | Revoke ผ่าน @BotFather |

---

## ✅ Credentials ที่ใช้งานอยู่ (สถานะปกติ)

| Credential | เก็บที่ | ใช้กับ |
|---|---|---|
| `GRIST_API_KEY` | Cloudflare Pages Secret | Grist API |
| `GRIST_DOC_ID` | Cloudflare Pages Secret | Grist Doc ID |
| `RESEND_API_KEY` | Cloudflare Pages Secret | Newsletter |
| `GA4_MEASUREMENT_ID` | Cloudflare Pages Secret | GA4 tracking |
| `GA4_API_SECRET` | Cloudflare Pages Secret | GA4 Measurement Protocol |
| `GA4_SERVICE_ACCOUNT_KEY` | GitHub Secret | sync-ga4-views-to-grist.js |
| `GITHUB_TOKEN` | Cloudflare Pages Secret | System Health check |
| `TELEGRAM_BOT_TOKEN` | Cloudflare Pages Secret | Telegram publish |
| `TELEGRAM_CHAT_ID` | Cloudflare Pages Secret | `-1004477831278` |
| `DISCORD_WEBHOOK_URL` | Cloudflare Pages Secret | Discord publish |
| `MASTODON_INSTANCE_URL` | Cloudflare Pages Secret | Mastodon publish |
| `MASTODON_ACCESS_TOKEN` | Cloudflare Pages Secret | Mastodon publish |
| `FACEBOOK_PAGE_ID` | Cloudflare Pages Secret | Facebook publish |
| `FACEBOOK_ACCESS_TOKEN` | Cloudflare Pages Secret | Facebook publish |
| `THREADS_ACCESS_TOKEN` | Cloudflare Pages Secret | Threads publish |

---

## ⏳ ยังไม่ได้ตั้ง

| Credential | ใช้กับ | หมายเหตุ |
|---|---|---|
| Tumblr Consumer Key/Secret | Tumblr publish | รอ FEAT-002 |
| Tumblr OAuth Token/Secret | Tumblr publish | รอ FEAT-002 |
| Tumblr Blog ID | Tumblr publish | รอ FEAT-002 |

---

## วิธีตั้ง Secret (Cloudflare Pages)

```bash
echo -n "VALUE" | wrangler pages secret put SECRET_NAME --project-name gravity-blog
# ต้อง deploy ใหม่ถึงจะมีผล
git commit --allow-empty -m "chore: trigger deploy" && git push
```
