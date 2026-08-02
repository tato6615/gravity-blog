#!/bin/bash
echo "🚀 GRAVITY-BLOG: PHASE PROGRESS CHECK"
echo "======================================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0mมา

COMPLETED=0
TOTAL=0

echo "📦 PHASE 0: FOUNDATION"
[ -f "wrangler.toml" ] && echo -e "${GREEN}✅${NC} wrangler.toml" && COMPLETED=$((COMPLETED+1)) || echo -e "${RED}❌${NC} wrangler.toml"
TOTAL=$((TOTAL+1))
[ -f "package.json" ] && echo -e "${GREEN}✅${NC} package.json" && COMPLETED=$((COMPLETED+1)) || echo -e "${RED}❌${NC} package.json"
TOTAL=$((TOTAL+1))
echo ""

echo "📊 PHASE 1: TRACKING"
[ -f "functions/api/click.js" ] && echo -e "${GREEN}✅${NC} click.js" && COMPLETED=$((COMPLETED+1)) || echo -e "${RED}❌${NC} click.js"
TOTAL=$((TOTAL+1))
echo ""

echo "💳 PHASE 2: CONVERSION"
[ -f "functions/api/product-webhook.js" ] && echo -e "${GREEN}✅${NC} product-webhook.js" && COMPLETED=$((COMPLETED+1)) || echo -e "${RED}❌${NC} product-webhook.js"
TOTAL=$((TOTAL+1))
echo ""

echo "📈 PHASE 3: ANALYTICS"
[ -f "functions/api/stats.js" ] && echo -e "${GREEN}✅${NC} stats.js" && COMPLETED=$((COMPLETED+1)) || echo -e "${RED}❌${NC} stats.js"
TOTAL=$((TOTAL+1))
echo ""

echo "✍️  PHASE 4: CONTENT"
ARTICLE_COUNT=$(find . -name "*.html" -path "*/product/*" 2>/dev/null | wc -l)
echo "📄 Articles: $ARTICLE_COUNT"
[ -f "admin.html" ] && echo -e "${GREEN}✅${NC} admin.html" && COMPLETED=$((COMPLETED+1)) || echo -e "${RED}❌${NC} admin.html"
TOTAL=$((TOTAL+1))
echo ""

echo "🌱 PHASE 5: GROWTH"
[ -f "functions/api/email.js" ] && echo -e "${GREEN}✅${NC} email.js" && COMPLETED=$((COMPLETED+1)) || echo -e "${YELLOW}⚠️${NC}  email.js (TODO)"
TOTAL=$((TOTAL+1))
echo ""

echo "⚙️  PHASE 6: AUTOMATION"
[ -f "fix-content-product-links.js" ] && echo -e "${GREEN}✅${NC} fix-content-product-links.js" && COMPLETED=$((COMPLETED+1)) || echo -e "${RED}❌${NC} fix-content-product-links.js"
TOTAL=$((TOTAL+1))
echo ""

PERCENTAGE=$((COMPLETED * 100 / TOTAL))
BAR_LENGTH=30
FILLED=$((PERCENTAGE * BAR_LENGTH / 100))
BAR=""
for ((i = 0; i < FILLED; i++)); do BAR="${BAR}█"; done
for ((i = FILLED; i < BAR_LENGTH; i++)); do BAR="${BAR}░"; done

echo "======================================"
echo "📊 PROGRESS: ${BAR} ${PERCENTAGE}%"
echo "✅ $COMPLETED / $TOTAL complete"
echo "======================================"
