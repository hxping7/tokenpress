#!/bin/bash
# Token00 本地 Docker 部署 (Ubuntu/Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy.conf"

echo "========================================"
echo "  Token00 Local Docker Deployment"
echo "========================================"
echo

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "[ERROR] Docker Compose is not installed"
    exit 1
fi

# 检查配置文件
if [ ! -f "$CONFIG_FILE" ]; then
    echo "[ERROR] deploy.conf not found"
    echo "Please copy deploy.conf.sample to deploy.conf"
    exit 1
fi

# 读取配置
source "$CONFIG_FILE"

if [ -z "$JWT_SECRET" ]; then
    echo "[ERROR] JWT_SECRET not defined in deploy.conf"
    exit 1
fi

# 设置默认值
: ${HTTP_PORT:=8080}
: ${HTTPS_PORT:=8443}
: ${SITE_URL:=http://localhost:$HTTP_PORT}

echo "HTTP Port: $HTTP_PORT"
echo "HTTPS Port: $HTTPS_PORT"
echo "Site URL: $SITE_URL"
echo

# 检查端口
if lsof -i :$HTTP_PORT &> /dev/null; then
    echo "[WARNING] Port $HTTP_PORT is in use"
    echo "Stopping existing containers..."
    docker compose down 2>/dev/null || true
    sleep 2
fi

echo "[1/2] Generating .env..."

cat > "$SCRIPT_DIR/.env" << EOF
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
JWT_SECRET=$JWT_SECRET
SITE_URL=$SITE_URL
FRONTEND_URL=$SITE_URL
NEXT_PUBLIC_API_URL=/api/v1
NEXT_PUBLIC_SITE_URL=$SITE_URL
EOF

echo
echo "[2/2] Building and starting..."
echo

docker compose down 2>/dev/null || true
docker compose up --build -d

echo
echo "Waiting for services..."

# 等待后端健康检查
RETRY=0
while [ $RETRY -lt 30 ]; do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' token00-backend 2>/dev/null || echo "")
    if [ "$HEALTH" = "healthy" ]; then
        break
    fi
    RETRY=$((RETRY + 1))
    echo "Waiting... ($RETRY/30)"
    sleep 3
done

if [ "$HEALTH" != "healthy" ]; then
    echo "[ERROR] Backend not healthy"
    docker logs token00-backend --tail 20
    exit 1
fi

echo
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo
echo "  HTTP:   http://localhost:$HTTP_PORT"
echo "  HTTPS:  https://localhost:$HTTPS_PORT (need SSL)"
echo "  Login:  admin / admin123 (CHANGE PASSWORD ON FIRST LOGIN!)"
echo
echo "  Stop:   docker compose down"
echo "  Logs:   docker logs token00-backend"
echo "========================================"
