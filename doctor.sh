#!/bin/bash
echo "=== 1. ENV ==="
node -v
npx wrangler --version

echo ""
echo "=== 2. D1 binding config in wrangler.toml ==="
grep -B1 -A4 "d1_databases" wrangler.toml

DB_NAME=$(grep -A4 "d1_databases" wrangler.toml | grep database_name | sed 's/.*"\(.*\)".*/\1/')
echo "-> database_name = $DB_NAME"

echo ""
echo "=== 3. Tables that actually exist in D1 (remote) ==="
npx wrangler d1 execute "$DB_NAME" --remote --command "SELECT name FROM sqlite_master WHERE type='table';"

echo ""
echo "=== 4. attention_events: มีข้อมูลไหม, variant_id มาหรือยัง ==="
npx wrangler d1 execute "$DB_NAME" --remote --command "SELECT event_type, variant_id, product_id, COUNT(*) as n FROM attention_events GROUP BY event_type, variant_id ORDER BY n DESC LIMIT 20;"

echo ""
echo "=== 5. conversions: schema จริง + ตัวอย่างข้อมูล ==="
npx wrangler d1 execute "$DB_NAME" --remote --command "PRAGMA table_info(conversions);"
npx wrangler d1 execute "$DB_NAME" --remote --command "SELECT * FROM conversions LIMIT 5;"

echo ""
echo "=== 6. clicks table มีจริงไหม (ที่ backlog บอกว่ายังไม่เคยเห็น schema) ==="
npx wrangler d1 execute "$DB_NAME" --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='clicks';"
npx wrangler d1 execute "$DB_NAME" --remote --command "PRAGMA table_info(clicks);" 2>&1

echo ""
echo "=== 7. ยิง endpoint จริงดูว่า error อะไร ==="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" "https://gravity-blog.pages.dev/api/funnel-stats?product_id=248&days=30"

echo ""
echo "=== 8. ดูโค้ดทั้งไฟล์ funnel-stats.js (จุดที่มัก error) ==="
grep -n "env\.\|DB\.\|await\|JSON.parse\|catch" functions/api/funnel-stats.js
