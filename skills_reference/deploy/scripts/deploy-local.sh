#!/bin/bash
# TokenPress: Deploy to local Docker
# Usage: deploy-local.sh <project-dir>
set -euo pipefail

PROJECT_DIR="$1"
CONFIG_FILE="$PROJECT_DIR/deploy.conf"
STATE_DIR="$PROJECT_DIR/.deploy-state"

if [ -f "$CONFIG_FILE" ]; then source "$CONFIG_FILE"; fi

: ${HTTP_PORT:=8080}
: ${HTTPS_PORT:=8443}
: ${SITE_URL:=http://localhost:$HTTP_PORT}

mkdir -p "$STATE_DIR"

echo "[DEPLOY] ========================================"
echo "[DEPLOY]  TokenPress Local Docker Deployment"
echo "[DEPLOY]  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. Check Docker
echo "[DEPLOY] Step 1/5: Checking Docker..."
if ! docker --version >/dev/null 2>&1; then
    echo "[DEPLOY] [ERROR] Docker is not available"
    exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
    echo "[DEPLOY] [ERROR] Docker Compose is not available"
    exit 1
fi
echo "[DEPLOY]   Docker OK"
echo ""

# 2. Check built images exist
echo "[DEPLOY] Step 2/5: Checking built images..."
if [ ! -f "$PROJECT_DIR/yourdomain-backend.tar.gz" ] || [ ! -f "$PROJECT_DIR/yourdomain-frontend.tar.gz" ]; then
    echo "[DEPLOY]   [INFO] Local images not found, using docker-compose build"
else
    echo "[DEPLOY]   Found local image archives"
    echo "[DEPLOY]   Loading backend..."
    gunzip -c "$PROJECT_DIR/yourdomain-backend.tar.gz" | docker load
    echo "[DEPLOY]   Loading frontend..."
    gunzip -c "$PROJECT_DIR/yourdomain-frontend.tar.gz" | docker load
fi
echo ""

# 3. Generate .env
echo "[DEPLOY] Step 3/5: Generating .env..."
cat > "$PROJECT_DIR/.env" << EOF
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
JWT_SECRET=$JWT_SECRET
SITE_URL=$SITE_URL
FRONTEND_URL=$SITE_URL
NEXT_PUBLIC_API_URL=/api/v1
NEXT_PUBLIC_SITE_URL=$SITE_URL
EOF
echo "[DEPLOY]   .env generated"
echo ""

# 4. Stop existing and start
echo "[DEPLOY] Step 4/5: Starting services..."
cd "$PROJECT_DIR"

# Stop existing containers (including orphans)
docker compose down --remove-orphans 2>/dev/null || true

# Start with build if images are fresh, otherwise just up
if [ -f "$PROJECT_DIR/yourdomain-backend.tar.gz" ]; then
    docker compose up -d
else
    docker compose up --build -d
fi
echo ""

# 5. Wait for health
echo "[DEPLOY] Step 5/5: Waiting for backend health..."
MAX_WAIT=90
WAITED=0
HEALTHY=false

while [ $WAITED -lt $MAX_WAIT ]; do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' yourdomain-backend 2>/dev/null || echo "starting")
    
    if [ "$HEALTH" = "healthy" ]; then
        HEALTHY=true
        echo "[DEPLOY]   Backend healthy after ${WAITED}s"
        break
    fi
    
    # Also try direct HTTP check
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$HTTP_PORT/api/v1/health" 2>/dev/null || echo "000")
    
    echo "[DEPLOY]   [${WAITED}s] Backend: $HEALTH | HTTP: $HTTP_CODE"
    sleep 5
    WAITED=$((WAITED + 5))
done

if [ "$HEALTHY" != true ]; then
    echo "[DEPLOY] [WARN] Backend not healthy after ${MAX_WAIT}s"
    docker ps -a --filter "name=yourdomain-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    docker logs yourdomain-backend --tail 30 2>/dev/null || true
fi

echo ""
echo "[DEPLOY] ========================================"
echo "[DEPLOY]  Local Deploy Complete!"
echo "[DEPLOY] ========================================"
echo "[DEPLOY]   HTTP:   http://localhost:$HTTP_PORT"
echo "[DEPLOY]   HTTPS:  https://localhost:$HTTPS_PORT"
echo ""
