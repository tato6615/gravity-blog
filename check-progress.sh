#!/bin/bash
echo "🚀 GRAVITY-BLOG: PHASE PROGRESS CHECK"
echo "======================================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMPLETED=0
TOTAL=0

check_file() {
  local file="$1"
  local label="$2"
  TOTAL=$((TOTAL+1))
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $label"
    COMPLETED=$((COMPLETED+1))
  else
    echo -e "${RED}❌${NC} $label"
  fi
}

echo "📦 PHASE 0: FOUNDATION"
check_file "wrangler.toml" "wrangler.toml"
check_file "package.json" "package.json"
echo ""

echo "📊 PHASE 1: TRACKING"
check_file "functions/api/click.js" "click.js"
check_file "functions/go/[id].js" "go/[id].js (ตัวจริงที่ปุ่ม Buy เรียก)"
echo ""

echo "💳 PHASE 2: CONVERSION"
check_file "functions/api/product-webhook.js" "product-webhook.js"
echo ""

echo "📈 PHASE 3: ANALYTICS"
check_file "functions/api/stats.js" "stats.js"
echo ""

echo "✍️  PHASE 4: CONTENT"
ARTICLE_COUNT=$(find . -name "*.html" -path "*/product/*" 2>/dev/null | wc -l)
echo "📄 Articles: $ARTICLE_COUNT"
check_file "admin.html" "admin.html"
echo ""

echo "🌱 PHASE 5: GROWTH"
check_file "functions/api/email.js" "email.js"
echo ""

echo "⚙️  PHASE 6: AUTOMATION"
check_file "fix-content-product-links.js" "fix-content-product-links.js"
echo ""

echo "======================================"
PERCENT=$((COMPLETED * 100 / TOTAL))
FILLED=$((PERCENT * 30 / 100))
BAR=""
for ((i=0; i<FILLED; i++)); do BAR="${BAR}█"; done
for ((i=FILLED; i<30; i++)); do BAR="${BAR}░"; done
echo "📊 PROGRESS: $BAR $PERCENT%"
echo "✅ $COMPLETED / $TOTAL complete"
echo "======================================"
echo ""
echo "⚠️  หมายเหตุ: เช็คนี้ดูแค่ว่า 'ไฟล์มีอยู่ไหม' เท่านั้น"
echo "   ไม่ได้พิสูจน์ว่ามันทำงานถูกต้อง หรือข้อมูลเบื้องหลัง"
echo "   (เช่น affiliate_link ใน Grist) ถูกกรอกครบ"
echo "   เขียว 100% ที่นี่ ไม่เท่ากับ 'ใช้งานได้จริง 100%'"
