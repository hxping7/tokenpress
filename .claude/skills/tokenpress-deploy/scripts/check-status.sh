#!/bin/bash
# TokenPress: Check current deployment status (local or VPS)
# Usage:
#   check-status.sh <project-dir> local
#   check-status.sh <project-dir> vps
set -euo pipefail

PROJECT_DIR="$1"
MODE="${2:-local}"
CONFIG_FILE="$PROJECT_DIR/deploy.conf"
HOST_FILE="$PROJECT_DIR/host.conf"

if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

if [ -f "$HOST_FILE" ]; then
    source "$HOST_FILE"
fi

: ${HTTP_PORT:=8080}
: ${SITE_PATH:=/root/yourdomain}
# 镜像名与容器名前缀（compose 里 container_name/image 均以它开头）
: ${PROJECT_PREFIX:=tokenpress}

echo "[STATUS] ========================================"
echo "[STATUS]  TokenPress Deployment Status Check"
echo "[STATUS]  Mode: $MODE"
echo "[STATUS]  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Helper: prints JSON-compatible status
report() {
    local category="$1"
    local key="$2"
    local value="$3"
    printf '  %-20s %-25s %s\n' "[$category]" "$key:" "$value"
}

# Helper: HTTP status code of a URL（curl 失败/无输出时返回 000）
# 注意：带 -A UA（反爬中间件会拦空 UA）；本机 Git Bash 下 `-o /dev/null -w`
# 可能以 exit 23（write error）结束但仍打印了状态码，故不能用 `|| echo 000`
# 追加回退值，只能按「输出是否为空」判定。
http_code() {
    local url="$1"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" -A 'Mozilla/5.0' --max-time 10 "$url" 2>/dev/null) || true
    [ -z "$code" ] && code="000"
    printf '%s' "$code"
}

report "SYSTEM" "Platform" "$(uname -s 2>/dev/null || echo Windows)"
report "SYSTEM" "Date" "$(date '+%Y-%m-%d %H:%M:%S')"
echo ""

if [ "$MODE" = "local" ]; then
    # === Local Docker Status ===

    # Docker availability
    if docker --version >/dev/null 2>&1; then
        report "DOCKER" "Available" "Yes ($(docker --version | head -1))"
    else
        report "DOCKER" "Available" "No"
    fi

    # Docker Compose
    if docker compose version >/dev/null 2>&1; then
        report "DOCKER" "Compose" "Yes ($(docker compose version | head -1))"
    else
        report "DOCKER" "Compose" "No"
    fi

    echo ""

    # Images
    for img in ${PROJECT_PREFIX}-backend:latest ${PROJECT_PREFIX}-frontend:latest; do
        SIZE=$(docker images "$img" --format '{{.Size}}' 2>/dev/null | head -1)
        if [ -n "$SIZE" ]; then
            report "IMAGES" "$img" "$SIZE"
        else
            report "IMAGES" "$img" "NOT FOUND"
        fi
    done
    echo ""

    # Containers
    for svc in ${PROJECT_PREFIX}-backend ${PROJECT_PREFIX}-frontend ${PROJECT_PREFIX}-nginx; do
        STATUS=$(docker ps -a --filter "name=$svc" --format '{{.Status}}' 2>/dev/null | head -1)
        if [ -z "$STATUS" ]; then
            report "CONTAINERS" "$svc" "Not deployed"
        else
            report "CONTAINERS" "$svc" "$STATUS"
        fi
    done
    echo ""

    # Health check
    HEALTH=$(http_code "http://localhost:$HTTP_PORT/api/v1/health")
    if [ "$HEALTH" = "200" ]; then
        report "HEALTH" "API" "OK (HTTP $HEALTH @ :$HTTP_PORT)"
    else
        report "HEALTH" "API" "FAIL (HTTP $HEALTH @ :$HTTP_PORT)"
    fi

elif [ "$MODE" = "vps" ]; then
    # === VPS Status ===
    if [ -z "${VPS_HOST:-}" ]; then
        report "VPS" "Host" "NOT CONFIGURED"
        echo "[STATUS] [ERROR] VPS_HOST not defined in $HOST_FILE"
        exit 1
    fi
    SSH_CMD="ssh -i \"$SSH_KEY\" -p $VPS_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10"

    report "VPS" "Host" "$VPS_HOST"
    report "VPS" "User" "$VPS_USER"
    report "VPS" "Port" "$VPS_PORT"

    # SSH connectivity
    SSH_OK=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST 'echo OK'" 2>/dev/null || echo "FAIL")
    if [ "$SSH_OK" = "OK" ]; then
        report "VPS" "SSH" "Connected"
    else
        report "VPS" "SSH" "FAILED"
        echo ""
        echo "[STATUS] [ERROR] Cannot connect to VPS via SSH"
        exit 1
    fi

    # Docker on VPS
    DOCKER_OK=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST 'docker --version'" 2>/dev/null || echo "FAIL")
    if [ "$DOCKER_OK" != "FAIL" ]; then
        report "VPS" "Docker" "$DOCKER_OK"
    else
        report "VPS" "Docker" "NOT INSTALLED"
    fi
    echo ""

    # Images on VPS
    for img in ${PROJECT_PREFIX}-backend:latest ${PROJECT_PREFIX}-frontend:latest; do
        IMG_INFO=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST 'docker images $img --format \"{{.Size}}\"'" 2>/dev/null || echo "")
        [ -z "$IMG_INFO" ] && IMG_INFO="NOT FOUND"
        report "IMAGES" "$img" "$IMG_INFO"
    done
    echo ""

    # Containers on VPS
    for svc in ${PROJECT_PREFIX}-backend ${PROJECT_PREFIX}-frontend ${PROJECT_PREFIX}-nginx; do
        CSTATUS=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST 'docker ps -a --filter name=$svc --format \"{{.Status}}\"'" 2>/dev/null || echo "")
        if [ -z "$CSTATUS" ]; then
            report "CONTAINERS" "$svc" "Not deployed"
        else
            report "CONTAINERS" "$svc" "$CSTATUS"
        fi
    done
    echo ""

    # Health check
    PUBLIC_URL="http://$VPS_HOST:$HTTP_PORT"
    HEALTH=$(http_code "$PUBLIC_URL/api/v1/health")
    if [ "$HEALTH" = "200" ]; then
        report "HEALTH" "API" "OK (HTTP $HEALTH @ $PUBLIC_URL)"
    else
        report "HEALTH" "API" "FAIL (HTTP $HEALTH @ $PUBLIC_URL)"
    fi
fi

echo ""
echo "[STATUS] ========================================"
echo "[STATUS]  Status check complete"
echo "[STATUS] ========================================"
echo ""
