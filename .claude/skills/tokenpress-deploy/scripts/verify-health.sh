#!/bin/bash
# TokenPress: Verify deployment health
# Usage:
#   verify-health.sh <project-dir> local
#   verify-health.sh <project-dir> vps
set -euo pipefail

PROJECT_DIR="$1"
MODE="${2:-local}"
CONFIG_FILE="$PROJECT_DIR/deploy.conf"
HOST_FILE="$PROJECT_DIR/host.conf"

if [ -f "$CONFIG_FILE" ]; then source "$CONFIG_FILE"; fi
if [ -f "$HOST_FILE" ]; then source "$HOST_FILE"; fi

: ${HTTP_PORT:=8080}
: ${VPS_HOST:=localhost}

ALL_PASS=true
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[VERIFY] ========================================"
echo "[VERIFY]  TokenPress Deployment Verification"
echo "[VERIFY]  Mode: $MODE | Time: $TIMESTAMP"
echo ""

if [ "$MODE" = "local" ]; then
    BASE_URL="http://localhost:$HTTP_PORT"
    SSH_CHECK=""
elif [ "$MODE" = "vps" ]; then
    BASE_URL="http://$VPS_HOST:$HTTP_PORT"
    SSH_CMD="ssh -i \"$SSH_KEY\" -p $VPS_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10"
    SSH_CHECK="$SSH_CMD $VPS_USER@$VPS_HOST"
else
    echo "[VERIFY] [ERROR] Unknown mode: $MODE"
    exit 1
fi

# === 1. Docker Container Status ===
echo "[VERIFY] --- Container Status ---"
if [ "$MODE" = "local" ]; then
    docker ps -a --filter "name=yourdomain-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
else
    eval "$SSH_CHECK \"docker ps -a --filter 'name=yourdomain-' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'\""
fi
echo ""

# === 2. API Health ===
echo "[VERIFY] --- API Health Check ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "  [PASS] API /health returned HTTP $HTTP_CODE"
else
    echo "  [FAIL] API /health returned HTTP $HTTP_CODE (expected 200)"
    ALL_PASS=false
fi

# Try to get JSON response
HEALTH_JSON=$(curl -s "$BASE_URL/api/v1/health" 2>/dev/null || echo '{"status":"unknown"}')
echo "  Response: $HEALTH_JSON"
echo ""

# === 3. Frontend ===
echo "[VERIFY] --- Frontend Check ---"
FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>/dev/null || echo "000")
if [ "$FRONTEND_CODE" = "200" ] || [ "$FRONTEND_CODE" = "301" ] || [ "$FRONTEND_CODE" = "302" ]; then
    echo "  [PASS] Frontend returned HTTP $FRONTEND_CODE"
else
    echo "  [WARN] Frontend returned HTTP $FRONTEND_CODE (expected 200)"
fi
echo ""

# === 4. API Response Time ===
echo "[VERIFY] --- Performance ---"
START_TIME=$(date +%s%N)
curl -s -o /dev/null "$BASE_URL/api/v1/health" 2>/dev/null || true
END_TIME=$(date +%s%N)
RESPONSE_MS=$(( (END_TIME - START_TIME) / 1000000 ))
if [ $RESPONSE_MS -lt 1000 ]; then
    echo "  [PASS] Response time: ${RESPONSE_MS}ms"
elif [ $RESPONSE_MS -lt 3000 ]; then
    echo "  [WARN] Response time: ${RESPONSE_MS}ms (acceptable)"
else
    echo "  [FAIL] Response time: ${RESPONSE_MS}ms (too slow)"
fi
echo ""

# === 5. Disk Usage (VPS only) ===
if [ "$MODE" = "vps" ]; then
    echo "[VERIFY] --- Disk Usage ---"
    eval "$SSH_CHECK \"df -h / | tail -1 | awk '{print \\\"  [INFO] \\\" \\$3 \\\" used / \\$2 \\\" (\\$5)\\\"}'\""
    echo ""
fi

# === Summary ===
echo "[VERIFY] ========================================"
if [ "$ALL_PASS" = true ]; then
    echo "[VERIFY]  ✓ All checks passed"
else
    echo "[VERIFY]  ✗ Some checks failed - review above"
fi
echo "[VERIFY] ========================================"
echo ""

# Return result for report
echo "VERIFY_RESULT=$ALL_PASS"
