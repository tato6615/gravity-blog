# DEPLOY PLAYBOOK — GRAVITY OS

---

## gravity-blog (Cloudflare Pages) — วิธีปกติ

```bash
# แก้ไฟล์
cat > functions/ไฟล์ที่แก้.js << 'EOF'
...โค้ด...
EOF

# ตรวจสอบก่อน commit
grep -c "try {" functions/ไฟล์ที่แก้.js  # ต้องได้ ≥ 1

# Deploy
git add .
git commit -m "fix: อธิบายสิ่งที่แก้"
git push
# Cloudflare Pages auto-deploy จาก main ✅
```

## ตรวจสอบหลัง Deploy (~2 นาที)

```bash
curl -o /dev/null -w "%{http_code}\n" https://gravity-blog.pages.dev/
curl -o /dev/null -w "%{http_code}\n" https://gravity-blog.pages.dev/en
curl -o /dev/null -w "%{http_code}\n" https://gravity-blog.pages.dev/community
curl -o /dev/null -w "%{http_code}\n" https://gravity-blog.pages.dev/go/152
# ทุกบรรทัดควรได้ 200 หรือ 302
```

---

## Worker "af" — ต่างจาก Pages

**ไม่มี git** — ต้องแก้ผ่าน Cloudflare Dashboard Quick Edit เท่านั้น:
1. ไปที่ [dash.cloudflare.com](https://dash.cloudflare.com) → Workers → af
2. Quick Edit → แก้โค้ด
3. กด Deploy

---

## ถ้า Deploy Success แต่ไม่เห็นผล

```bash
# เช็ค _worker.bundle ที่บล็อก functions/
ls -la _worker.bundle _worker.js 2>/dev/null || echo "ไม่มี — ดี"
# ถ้ามี: git rm _worker.bundle && git commit -m "fix: remove _worker.bundle" && git push
```

---

## ตั้ง Secret ใหม่

```bash
echo -n "SECRET_VALUE" | wrangler pages secret put SECRET_NAME --project-name gravity-blog
# แล้ว trigger deploy ใหม่
git commit --allow-empty -m "chore: trigger deploy for new secret"
git push
```
