#!/bin/bash
# Token00 Deploy (Linux/Git Bash Main Entry)
# Usage: ./deploy.sh <local|vps> [skip-build]
#
# Orchestrates full deployment workflow:
#   1. Build images          (skip with "skip-build")
#   2. Check current status
#   3. Backup database
#   4. Upload / Deploy
#   5. Health check
#   6. Generate report
set -euo pipefail

MODE="${1:-}"
SKIP_BUILD="${2:-}"

if [ -z "$MODE" ]; then
    echo "========================================"
    echo " Token00 Deployment Tool"
    echo "========================================"
    echo ""
    echo "Usage:  $0 <mode> [skip-build]"
    echo ""
    echo "Modes:"
    echo "  local       Deploy to local Docker"
    echo "  vps         Build locally, upload to VPS"
    echo ""
    echo "Options:"
    echo "  skip-build  Skip Docker build"
    echo "========================================"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)/scripts"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RESULT_DIR="$PROJECT_DIR/.deploy-state"
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "$RESULT_DIR"

echo "========================================"
echo " Token00 Deployment"
echo " Mode: $MODE"
echo " Start: $START_TIME"
echo "========================================"
echo ""

# ---- Step 1: Build ----
BUILD_RESULT="skipped"
if [ "$SKIP_BUILD" != "skip-build" ]; then
    echo "[1/6] Building Docker images..."
    if bash "$SCRIPT_DIR/build-images.sh" "$PROJECT_DIR"; then
        BUILD_RESULT="success"
    else
        BUILD_RESULT="failed"
        echo "[FATAL] Build failed. Aborting."
        bash "$SCRIPT_DIR/generate-report.sh" "$PROJECT_DIR" "$MODE" "$BUILD_RESULT" skipped skipped skipped skipped
        exit 1
    fi
else
    echo "[1/6] Skipped (skip-build flag)"
fi
echo ""

# ---- Step 2: Check status ----
echo "[2/6] Checking deployment status..."
bash "$SCRIPT_DIR/check-status.sh" "$PROJECT_DIR" "$MODE" || true
echo ""

# ---- Step 3: Backup DB ----
BACKUP_RESULT="skipped"
echo "[3/6] Backing up database..."
if bash "$SCRIPT_DIR/backup-db.sh" "$PROJECT_DIR" "$MODE"; then
    BACKUP_RESULT="success"
fi
echo ""

# ---- Step 4: Upload / Deploy ----
UPLOAD_RESULT="N/A"
DEPLOY_RESULT="skipped"

if [ "$MODE" = "vps" ]; then
    echo "[4/6] Uploading to VPS..."
    if bash "$SCRIPT_DIR/upload-vps.sh" "$PROJECT_DIR"; then
        UPLOAD_RESULT="success"
    else
        UPLOAD_RESULT="failed"
        echo "[FATAL] Upload failed."
        bash "$SCRIPT_DIR/generate-report.sh" "$PROJECT_DIR" "$MODE" "$BUILD_RESULT" "$BACKUP_RESULT" "$UPLOAD_RESULT" skipped skipped
        exit 1
    fi

    echo "[5/6] Deploying on VPS..."
    if bash "$SCRIPT_DIR/deploy-vps.sh" "$PROJECT_DIR"; then
        DEPLOY_RESULT="success"
    else
        DEPLOY_RESULT="failed"
    fi
else
    echo "[4/6] Deploying locally..."
    if bash "$SCRIPT_DIR/deploy-local.sh" "$PROJECT_DIR"; then
        DEPLOY_RESULT="success"
    else
        DEPLOY_RESULT="failed"
    fi
fi
echo ""

# ---- Step 5: Health check ----
VERIFY_RESULT="skipped"
echo "[5/6] Running health check..."
if bash "$SCRIPT_DIR/verify-health.sh" "$PROJECT_DIR" "$MODE"; then
    VERIFY_RESULT="true"
else
    VERIFY_RESULT="false"
fi
echo ""

# ---- Step 6: Generate report ----
echo "[6/6] Generating report..."
bash "$SCRIPT_DIR/generate-report.sh" "$PROJECT_DIR" "$MODE" "$BUILD_RESULT" "$BACKUP_RESULT" "$UPLOAD_RESULT" "$DEPLOY_RESULT" "$VERIFY_RESULT"

echo ""
echo "========================================"
echo " Deployment Completed"
echo " Started: $START_TIME"
echo " Ended:   $(date '+%Y-%m-%d %H:%M:%S')"
echo " Result:  Build=$BUILD_RESULT / Deploy=$DEPLOY_RESULT / Health=$VERIFY_RESULT"
echo "========================================"
