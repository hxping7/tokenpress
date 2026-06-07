#!/bin/bash
# TokenPress: Generate deployment report
# Usage: generate-report.sh <project-dir> <mode> <build-result> <backup-result> <upload-result> <deploy-result> <verify-result>
set -euo pipefail

PROJECT_DIR="$1"
MODE="$2"
BUILD_RESULT="${3:-unknown}"
BACKUP_RESULT="${4:-unknown}"
UPLOAD_RESULT="${5:-unknown}"
DEPLOY_RESULT="${6:-unknown}"
VERIFY_RESULT="${7:-unknown}"

CONFIG_FILE="$PROJECT_DIR/deploy.conf"
HOST_FILE="$PROJECT_DIR/host.conf"
STATE_DIR="$PROJECT_DIR/.deploy-state"

if [ -f "$CONFIG_FILE" ]; then source "$CONFIG_FILE"; fi
if [ -f "$HOST_FILE" ]; then source "$HOST_FILE"; fi

: ${HTTP_PORT:=8080}
: ${VPS_HOST:=localhost}

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
REPORT_FILE="$PROJECT_DIR/.deploy-state/deploy-report-$(date '+%Y%m%d_%H%M%S').md"
BUILD_LOG="$STATE_DIR/build-$(date '+%Y%m%d')*.log"

mkdir -p "$STATE_DIR"

# Gather git info
GIT_COMMIT=""
GIT_BRANCH=""
if [ -d "$PROJECT_DIR/.git" ]; then
    GIT_COMMIT=$(cd "$PROJECT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    GIT_BRANCH=$(cd "$PROJECT_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
fi

# Determine overall status
if [ "$VERIFY_RESULT" = "true" ]; then
    OVERALL_STATUS="✅ SUCCESS"
elif [ "$DEPLOY_RESULT" = "success" ] && [ "$VERIFY_RESULT" = "false" ]; then
    OVERALL_STATUS="⚠️ DEPLOYED WITH WARNINGS"
else
    OVERALL_STATUS="❌ FAILED"
fi

# Get image sizes
BACKEND_SIZE=$(stat -c%s "$PROJECT_DIR/yourdomain-backend.tar.gz" 2>/dev/null || echo "0")
FRONTEND_SIZE=$(stat -c%s "$PROJECT_DIR/yourdomain-frontend.tar.gz" 2>/dev/null || echo "0")
BACKEND_SIZE_HR=$(numfmt --to=iec "$BACKEND_SIZE" 2>/dev/null || echo "${BACKEND_SIZE}B")
FRONTEND_SIZE_HR=$(numfmt --to=iec "$FRONTEND_SIZE" 2>/dev/null || echo "${FRONTEND_SIZE}B")

cat > "$REPORT_FILE" << REPORTEOF
# TokenPress 部署报告

## 基本信息

| 项目 | 值 |
|------|-----|
| 时间 | $TIMESTAMP |
| 模式 | $MODE |
| 目标 | $( [ "$MODE" = "local" ] && echo "localhost:$HTTP_PORT" || echo "$VPS_HOST:$HTTP_PORT" ) |
| Git 提交 | $GIT_COMMIT |
| Git 分支 | $GIT_BRANCH |
| 状态 | $OVERALL_STATUS |

## 步骤详情

| 步骤 | 结果 |
|------|------|
| 1. 构建镜像 | $BUILD_RESULT |
| 2. 数据库备份 | $BACKUP_RESULT |
| 3. 上传文件 | $UPLOAD_RESULT |
| 4. 部署服务 | $DEPLOY_RESULT |
| 5. 健康检查 | $VERIFY_RESULT |

## 镜像信息

| 镜像 | 大小 |
|------|------|
| yourdomain-backend | $BACKEND_SIZE_HR |
| yourdomain-frontend | $FRONTEND_SIZE_HR |

$( [ "$MODE" = "vps" ] && echo "## 目标服务器
| 项目 | 值 |
|------|-----|
| 主机 | $VPS_HOST |
| 用户 | $VPS_USER |
| 端口 | $VPS_PORT |
| 部署路径 | $SITE_PATH |
" || echo "" )

## 配置文件

| 文件 | 说明 |
|------|------|
| deploy.conf | 部署配置（端口/域名/JWT等） |
| host.conf | SSH连接信息（IP/密钥路径） |
| docker-compose.yml | Docker编排 |
| nginx.conf | Nginx反向代理配置 |

---
*报告由 TokenPress Deploy Skill 自动生成*
REPORTEOF

echo "[REPORT] Report generated: $REPORT_FILE"
echo "REPORT_FILE=$REPORT_FILE"
