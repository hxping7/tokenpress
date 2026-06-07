#!/bin/bash
# TokenPress: Deploy on remote VPS
# Usage: deploy-vps.sh <project-dir>
set -euo pipefail

PROJECT_DIR="$1"
CONFIG_FILE="$PROJECT_DIR/deploy.conf"
HOST_FILE="$PROJECT_DIR/host.conf"
STATE_DIR="$PROJECT_DIR/.deploy-state"

if [ -f "$CONFIG_FILE" ]; then source "$CONFIG_FILE"; fi
if [ -f "$HOST_FILE" ]; then source "$HOST_FILE"; fi

: ${VPS_HOST:?[ERROR] VPS_HOST not defined}
: ${SSH_KEY:?[ERROR] SSH_KEY not defined}
: ${VPS_USER:=root}
: ${VPS_PORT:=22}
: ${SITE_PATH:=/root/yourdomain}
: ${HTTP_PORT:=8080}

SSH_CMD="ssh -i \"$SSH_KEY\" -p $VPS_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10"

mkdir -p "$STATE_DIR"

echo "[DEPLOY] ========================================"
echo "[DEPLOY]  TokenPress VPS Deployment"
echo "[DEPLOY]  Target: $VPS_USER@$VPS_HOST"
echo "[DEPLOY]  Path:   $SITE_PATH"
echo "[DEPLOY]  Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. Ensure deploy.sh is remote and executable
echo "[DEPLOY] Step 1/4: Preparing remote deploy script..."
eval "$SSH_CMD $VPS_USER@$VPS_HOST \"chmod +x $SITE_PATH/deploy.sh 2>/dev/null; sed -i 's/\\\r$//' $SITE_PATH/deploy.sh 2>/dev/null; ls -la $SITE_PATH/deploy.sh\""
echo ""

# 2. Execute deploy.sh on VPS
echo "[DEPLOY] Step 2/4: Running deploy.sh on VPS..."
DEPLOY_LOG="$STATE_DIR/deploy-vps-$(date '+%Y%m%d_%H%M%S').log"
eval "$SSH_CMD $VPS_USER@$VPS_HOST \"cd $SITE_PATH && bash deploy.sh 2>&1\"" | tee "$DEPLOY_LOG"
DEPLOY_EXIT=${PIPESTATUS[0]}

if [ $DEPLOY_EXIT -ne 0 ]; then
    echo "[DEPLOY] [ERROR] Remote deploy script failed (exit code: $DEPLOY_EXIT)"
    echo "[DEPLOY]   Log saved to: $DEPLOY_LOG"
    exit 1
fi
echo "[DEPLOY]   Deploy script completed"
echo ""

# 3. Wait for services to become healthy
echo "[DEPLOY] Step 3/4: Waiting for services (up to 90s)..."
MAX_WAIT=90
WAITED=0
HEALTHY=false

while [ $WAITED -lt $MAX_WAIT ]; do
    HEALTH=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST \"docker inspect --format='{{.State.Health.Status}}' yourdomain-backend 2>/dev/null || echo 'starting'\"" 2>/dev/null || echo "unknown")
    
    if [ "$HEALTH" = "healthy" ]; then
        HEALTHY=true
        echo "[DEPLOY]   Backend healthy after ${WAITED}s"
        break
    fi
    
    # Also check running containers
    ALL_RUNNING=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST \"docker ps --filter 'name=yourdomain-' --format '{{.Names}} {{.Status}}' 2>/dev/null\"" || echo "")
    echo "[DEPLOY]   [${WAITED}s] Backend: $HEALTH"
    
    sleep 5
    WAITED=$((WAITED + 5))
done

if [ "$HEALTHY" != true ]; then
    echo "[DEPLOY] [WARN] Backend not healthy within ${MAX_WAIT}s, checking status..."
    eval "$SSH_CMD $VPS_USER@$VPS_HOST \"docker ps -a --filter 'name=yourdomain-' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'\"" 2>/dev/null || true
    eval "$SSH_CMD $VPS_USER@$VPS_HOST \"docker logs yourdomain-backend --tail 30 2>/dev/null\"" || true
fi
echo ""

# 4. Quick health check via HTTP
echo "[DEPLOY] Step 4/4: Verifying HTTP endpoint..."
HTTP_OK=$(curl -s -o /dev/null -w "%{http_code}" "http://$VPS_HOST:$HTTP_PORT/api/v1/health" 2>/dev/null || echo "000")
if [ "$HTTP_OK" = "200" ]; then
    echo "[DEPLOY]   API health check: OK (HTTP $HTTP_OK)"
else
    echo "[DEPLOY]   [WARN] API health check: HTTP $HTTP_OK (not critical if firewall blocks)"
fi

echo ""
echo "[DEPLOY] ========================================"
echo "[DEPLOY]  VPS Deploy Complete"
echo "[DEPLOY] ========================================"
echo "[DEPLOY]   Site: http://$VPS_HOST:$HTTP_PORT"
echo "[DEPLOY]   Log:  $DEPLOY_LOG"
echo ""

# Return the deploy log path for the report
echo "DEPLOY_LOG=$DEPLOY_LOG"
