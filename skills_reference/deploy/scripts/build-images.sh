#!/bin/bash
# TokenPress: Build Docker images
# Usage: build-images.sh [project-dir]
#   project-dir defaults to the current directory
set -euo pipefail

PROJECT_DIR="${1:-$(pwd)}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$PROJECT_DIR/deploy.conf"
STATE_DIR="$PROJECT_DIR/.deploy-state"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

mkdir -p "$STATE_DIR"

echo "[BUILD] ========================================"
echo "[BUILD]  TokenPress Docker Image Builder"
echo "[BUILD] ========================================"
echo "[BUILD] Project: $PROJECT_DIR"
echo "[BUILD] Time:    $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. Check Docker
if ! docker --version >/dev/null 2>&1; then
    echo "[BUILD] [ERROR] Docker is not available"
    exit 1
fi

# 2. Verify pnpm install / node_modules
if [ ! -f "$PROJECT_DIR/pnpm-lock.yaml" ]; then
    echo "[BUILD] [ERROR] Not a pnpm project root (no pnpm-lock.yaml)"
    exit 1
fi

# 3. Build backend
echo "[BUILD] Step 1/4: Building backend image..."
echo "[BUILD]   docker build --target backend -t tokenpress-backend:latest"
cd "$PROJECT_DIR"
if docker build --no-cache --target backend -t tokenpress-backend:latest . 2>&1; then
    echo "[BUILD]   Backend image built successfully"
else
    echo "[BUILD] [ERROR] Backend build FAILED - compile errors detected"
    exit 1
fi
echo ""

# 4. Build frontend
echo "[BUILD] Step 2/4: Building frontend image..."
echo "[BUILD]   docker build --target frontend -t tokenpress-frontend:latest"
if docker build --no-cache --target frontend -t tokenpress-frontend:latest . 2>&1; then
    echo "[BUILD]   Frontend image built successfully"
else
    echo "[BUILD] [ERROR] Frontend build FAILED - compile errors detected"
    exit 1
fi
echo ""

# 5. Export images (gzip compressed)
echo "[BUILD] Step 3/4: Exporting images (gzip)..."
echo "[BUILD]   Exporting backend..."
docker save tokenpress-backend:latest | gzip > "$PROJECT_DIR/tokenpress-backend.tar.gz"
BACKEND_SIZE=$(stat -c%s "$PROJECT_DIR/tokenpress-backend.tar.gz" 2>/dev/null || stat -f%z "$PROJECT_DIR/tokenpress-backend.tar.gz" 2>/dev/null)
echo "[BUILD]   tokenpress-backend.tar.gz: $(numfmt --to=iec $BACKEND_SIZE 2>/dev/null || echo $BACKEND_SIZE bytes)"

echo "[BUILD]   Exporting frontend..."
docker save tokenpress-frontend:latest | gzip > "$PROJECT_DIR/tokenpress-frontend.tar.gz"
FRONTEND_SIZE=$(stat -c%s "$PROJECT_DIR/tokenpress-frontend.tar.gz" 2>/dev/null || stat -f%z "$PROJECT_DIR/tokenpress-frontend.tar.gz" 2>/dev/null)
echo "[BUILD]   tokenpress-frontend.tar.gz: $(numfmt --to=iec $FRONTEND_SIZE 2>/dev/null || echo $FRONTEND_SIZE bytes)"
echo ""

# 6. Generate checksums for integrity verification
echo "[BUILD] Step 4/4: Generating integrity checksums..."

# Use sha256sum or shasum depending on platform
SHACMD="sha256sum"
if ! command -v "$SHACMD" &>/dev/null; then
    SHACMD="shasum -a 256"
fi

$SHACMD "$PROJECT_DIR/tokenpress-backend.tar.gz" > "$PROJECT_DIR/tokenpress-backend.tar.gz.sha256"
$SHACMD "$PROJECT_DIR/tokenpress-frontend.tar.gz" > "$PROJECT_DIR/tokenpress-frontend.tar.gz.sha256"
echo "[BUILD]   Checksums saved to .sha256 files"

# Remove intermediate tar files if they exist
rm -f "$PROJECT_DIR/tokenpress-backend.tar" "$PROJECT_DIR/tokenpress-frontend.tar"

echo ""
echo "[BUILD] ========================================"
echo "[BUILD]  Build Complete!"
echo "[BUILD] ========================================"
echo "[BUILD]   Backend:  tokenpress-backend.tar.gz ($(numfmt --to=iec $BACKEND_SIZE 2>/dev/null || echo $BACKEND_SIZE bytes))"
echo "[BUILD]   Frontend: tokenpress-frontend.tar.gz ($(numfmt --to=iec $FRONTEND_SIZE 2>/dev/null || echo $FRONTEND_SIZE bytes))"
echo "[BUILD]   Checksum: SHA256"
echo ""
