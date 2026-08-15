# ENVIRONMENT VARIABLES — GRAVITY OS
**ทุกตัวแปรที่ระบบใช้ เรียงตามระบบ**

---

## Cloudflare Pages Secrets (gravity-blog)

### Grist
| ตัวแปร | ใช้ทำอะไร | สถานะ |
|---|---|---|
| `GRIST_API_KEY` | Grist API authentication | ✅ |
| `GRIST_DOC_ID` | Document ID ของ Grist | ✅ |

### Analytics
| ตัวแปร | ใช้ทำอะไร | สถานะ |
|---|---|---|
| `GA4_MEASUREMENT_ID` | GA4 tracking | ✅ |
| `GA4_API_SECRET` | GA4 Measurement Protocol | ✅ |

### Social Publishing
| ตัวแปร | ใช้ทำอะไร | สถานะ |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot | ✅ |
| `TELEGRAM_CHAT_ID` | `-1004477831278` | ✅ |
| `DISCORD_WEBHOOK_URL` | Discord webhook | ✅ ⚠️ ควร rotate |
| `MASTODON_INSTANCE_URL` | Mastodon instance | ✅ |
| `MASTODON_ACCESS_TOKEN` | Mastodon auth | ✅ |
| `FACEBOOK_PAGE_ID` | Facebook page | ✅ |
| `FACEBOOK_ACCESS_TOKEN` | Facebook auth | ✅ |
| `THREADS_ACCESS_TOKEN` | Threads auth | ✅ |

### Email
| ตัวแปร | ใช้ทำอะไร | สถานะ |
|---|---|---|
| `RESEND_API_KEY` | Newsletter (Resend) | ✅ |
| `RESEND_FROM_EMAIL` | Sender email | ⚪ ใช้ default `onboarding@resend.dev` |

### System
| ตัวแปร | ใช้ทำอะไร | สถานะ |
|---|---|---|
| `GITHUB_TOKEN` | System Health check workflows | ✅ |

### Tumblr (ยังไม่ได้ตั้ง)
| ตัวแปร | ใช้ทำอะไร | สถานะ |
|---|---|---|
| `TUMBLR_CONSUMER_KEY` | Tumblr OAuth | ⏳ |
| `TUMBLR_CONSUMER_SECRET` | Tumblr OAuth | ⏳ |
| `TUMBLR_ACCESS_TOKEN` | Tumblr OAuth | ⏳ |
| `TUMBLR_ACCESS_SECRET` | Tumblr OAuth | ⏳ |
| `TUMBLR_BLOG_ID` | Blog identifier | ⏳ |

---

## GitHub Secrets (gravity-blog repo)

| ตัวแปร | ใช้ทำอะไร | สถานะ |
|---|---|---|
| `GA4_SERVICE_ACCOUNT_KEY` | sync-ga4-views-to-grist.js | ✅ 🔴 **ต้อง rotate ด่วน** |
| `GRIST_API_KEY` | sync scripts | ✅ |
| `GRIST_DOC_ID` | sync scripts | ✅ |

---

## วิธีตั้ง Secret

```bash
# Cloudflare Pages
echo -n "VALUE" | wrangler pages secret put VAR_NAME --project-name gravity-blog

# GitHub (ผ่าน CLI)
gh secret set VAR_NAME --body "VALUE"
```

**⚠️ Secret ใหม่ต้อง deploy ใหม่ถึงมีผล → ดู `08_DEVELOPMENT_RULES/RULES.md` RULE 5**
