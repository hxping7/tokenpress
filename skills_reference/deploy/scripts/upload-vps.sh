#!/bin/bash
# TokenPress: Upload to VPS with chunked resume + integrity verification
# Usage: upload-vps.sh <project-dir>
# Features:
#   - Chunked upload with configurable chunk size
#   - Resume: skips already-uploaded chunks (by size + checksum)
#   - SHA256 integrity verification per chunk and per file
#   - Auto-retry on network failure (3 attempts per chunk)
#   - Temporary state file for full resume across sessions
set -euo pipefail

PROJECT_DIR="$1"
CONFIG_FILE="$PROJECT_DIR/deploy.conf"
HOST_FILE="$PROJECT_DIR/host.conf"
STATE_DIR="$PROJECT_DIR/.deploy-state"

# Load configs
if [ -f "$CONFIG_FILE" ]; then source "$CONFIG_FILE"; fi
if [ -f "$HOST_FILE" ]; then source "$HOST_FILE"; fi

# Validate
: ${VPS_HOST:?[ERROR] VPS_HOST not defined in host.conf}
: ${SSH_KEY:?[ERROR] SSH_KEY not defined in host.conf}
: ${VPS_USER:=root}
: ${VPS_PORT:=22}
: ${SITE_PATH:=/root/yourdomain}
: ${CHUNK_MB:=50}

SSH_CMD="ssh -i \"$SSH_KEY\" -p $VPS_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o ServerAliveInterval=30"
SCP_CMD="scp -i \"$SSH_KEY\" -P $VPS_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=30"

REMOTE_UPLOAD_DIR="/root/yourdomain-upload"
CHUNK_SIZE="${CHUNK_MB}m"
MAX_RETRIES=3
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
UPLOAD_LOG="$PROJECT_DIR/.deploy-state/upload-$TIMESTAMP.log"

mkdir -p "$STATE_DIR"

echo "[UPLOAD] ========================================"
echo "[UPLOAD]  TokenPress VPS Uploader (Full Resume)"
echo "[UPLOAD]  Target: $VPS_USER@$VPS_HOST:$VPS_PORT"
echo "[UPLOAD]  Chunk:  ${CHUNK_MB}MB | Retries: $MAX_RETRIES"
echo "[UPLOAD]  Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Files to upload
FILES=(
    "$PROJECT_DIR/yourdomain-backend.tar.gz"
    "$PROJECT_DIR/yourdomain-frontend.tar.gz"
)

# Check files exist
for f in "${FILES[@]}"; do
    if [ ! -f "$f" ]; then
        echo "[UPLOAD] [ERROR] Missing: $f (run build first)"
        exit 1
    fi
    if [ ! -f "${f}.sha256" ]; then
        echo "[UPLOAD] [WARN] Missing checksum: ${f}.sha256 (will generate)"
        SHACMD="sha256sum"
        command -v "$SHACMD" >/dev/null 2>&1 || SHACMD="shasum -a 256"
        $SHACMD "$f" > "${f}.sha256"
    fi
done

# 1. Create remote temp directory (fixed name = cross-session resume)
echo "[UPLOAD] Step 1/5: Preparing remote directory..."
eval "$SSH_CMD $VPS_USER@$VPS_HOST \"mkdir -p $REMOTE_UPLOAD_DIR\"" 2>&1
echo "[UPLOAD]   Remote temp: $REMOTE_UPLOAD_DIR"
echo ""

# 2. Ensure remote final directory exists
eval "$SSH_CMD $VPS_USER@$VPS_HOST \"mkdir -p $SITE_PATH\"" 2>&1

# ============================================================
# Helper: upload a single chunk with retry + integrity check
# ============================================================
upload_chunk() {
    local chunk_path="$1" chunk_name="$2" chunk_sha="$3" count="$4" total="$5"

    # Resume: check if remote chunk already exists with matching SHA256
    local remote_chunk_sha
    remote_chunk_sha=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST \"sha256sum $REMOTE_UPLOAD_DIR/$chunk_name 2>/dev/null || shasum -a 256 $REMOTE_UPLOAD_DIR/$chunk_name 2>/dev/null\"" | awk '{print $1}' || echo "")

    if [ "$remote_chunk_sha" = "$chunk_sha" ]; then
        echo "  [$count/$total] $chunk_name verified (skip)"
        return 0
    fi

    # Upload with retry
    local attempt
    for attempt in $(seq 1 $MAX_RETRIES); do
        echo "  [$count/$total] Uploading $chunk_name (attempt $attempt/$MAX_RETRIES)..."

        if eval "$SCP_CMD \"$chunk_path\" $VPS_USER@$VPS_HOST:$REMOTE_UPLOAD_DIR/" 2>/dev/null; then
            local uploaded_sha
            uploaded_sha=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST \"sha256sum $REMOTE_UPLOAD_DIR/$chunk_name 2>/dev/null || shasum -a 256 $REMOTE_UPLOAD_DIR/$chunk_name 2>/dev/null\"" | awk '{print $1}' || echo "")

            if [ "$uploaded_sha" = "$chunk_sha" ]; then
                echo "  [$count/$total] $chunk_name uploaded and verified"
                return 0
            else
                echo "  [$count/$total] Checksum mismatch, retrying..."
            fi
        else
            echo "  [$count/$total] SCP failed, retrying..."
            sleep 2
        fi
    done

    return 1
}

# ============================================================
# 3. Upload each file with full cross-session chunked resume
# ============================================================
for FILE in "${FILES[@]}"; do
    BASENAME=$(basename "$FILE")
    PREFIX=$(echo "$BASENAME" | sed 's/\.tar\.gz$//')
    REMOTE_FILE="$REMOTE_UPLOAD_DIR/$BASENAME"
    REMOTE_MANIFEST="$REMOTE_UPLOAD_DIR/${PREFIX}_manifest.txt"

    echo "[UPLOAD] ===== File: $BASENAME ====="
    echo "[UPLOAD] Size: $(stat -c%s "$FILE" 2>/dev/null || stat -f%z "$FILE" 2>/dev/null) bytes"

    LOCAL_SHA=$(cat "${FILE}.sha256" | awk '{print $1}')

    # --- Phase A: Check if file is already fully uploaded ---
    REMOTE_SHA=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST \"sha256sum $REMOTE_FILE 2>/dev/null || shasum -a 256 $REMOTE_FILE 2>/dev/null\"" | awk '{print $1}' || echo "")

    if [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
        echo "[UPLOAD]   File already uploaded with matching checksum, skipping"
        echo ""
        continue
    fi

    # --- Phase B: Split locally ---
    echo "[UPLOAD]   Splitting into ${CHUNK_MB}MB chunks..."
    rm -f "$STATE_DIR/${PREFIX}_part_"*
    split -b "$CHUNK_SIZE" -d --suffix-length=3 "$FILE" "$STATE_DIR/${PREFIX}_part_"

    # Build chunk manifest (name + sha256)
    CHUNK_CHECKSUMS="$STATE_DIR/${PREFIX}_checksums.txt"
    > "$CHUNK_CHECKSUMS"

    TOTAL_CHUNKS=0
    for chunk in "$STATE_DIR/${PREFIX}_part_"*; do
        [ -f "$chunk" ] || continue
        TOTAL_CHUNKS=$((TOTAL_CHUNKS + 1))
        CHUNK_BASENAME=$(basename "$chunk")
        SHACMD="sha256sum"
        command -v "$SHACMD" >/dev/null 2>&1 || SHACMD="shasum -a 256"
        $SHACMD "$chunk" | awk "{print \"$CHUNK_BASENAME \" \$1}" >> "$CHUNK_CHECKSUMS"
    done

    echo "[UPLOAD]   $TOTAL_CHUNKS chunks total"

    # --- Phase C: Determine which chunks need uploading ---
    # Fetch remote manifest if exists (from previous partial upload)
    REMOTE_MANIFEST_CONTENT=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST \"cat $REMOTE_MANIFEST 2>/dev/null || echo ''\"" 2>/dev/null || echo "")

    NEED_UPLOAD=0
    COUNT=0
    for chunk in "$STATE_DIR/${PREFIX}_part_"*; do
        [ -f "$chunk" ] || continue
        COUNT=$((COUNT + 1))
        CHUNK_NAME=$(basename "$chunk")
        CHUNK_SHA=$(grep "^$CHUNK_NAME " "$CHUNK_CHECKSUMS" | awk '{print $2}')

        if upload_chunk "$chunk" "$CHUNK_NAME" "$CHUNK_SHA" "$COUNT" "$TOTAL_CHUNKS"; then
            :  # chunk is done
        else
            NEED_UPLOAD=$((NEED_UPLOAD + 1))
        fi
    done

    if [ "$NEED_UPLOAD" -gt 0 ]; then
        echo "[UPLOAD] [ERROR] $NEED_UPLOAD chunks failed after $MAX_RETRIES attempts each"
        echo "[UPLOAD] [INFO] Resume supported: re-run to retry only missing chunks"
        exit 1
    fi

    # --- Phase D: Upload manifest to VPS (records expected chunks) ---
    eval "$SCP_CMD \"$CHUNK_CHECKSUMS\" $VPS_USER@$VPS_HOST:$REMOTE_MANIFEST" 2>/dev/null

    # --- Phase E: Verify all chunks present on VPS, then merge ---
    echo "[UPLOAD]   Verifying all chunks on VPS..."

    MISSING=0
    while IFS=' ' read -r cname _; do
        [ -z "$cname" ] && continue
        EXISTS=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST \"test -f $REMOTE_UPLOAD_DIR/$cname && echo 1 || echo 0\"" 2>/dev/null || echo 0)
        if [ "$EXISTS" = "0" ]; then
            echo "  [WARN] Missing chunk on VPS: $cname"
            MISSING=$((MISSING + 1))
        fi
    done < "$CHUNK_CHECKSUMS"

    if [ "$MISSING" -gt 0 ]; then
        echo "[UPLOAD] [ERROR] $MISSING chunks missing on VPS after upload attempt"
        exit 1
    fi

    echo "[UPLOAD]   All chunks present, merging..."
    eval "$SSH_CMD $VPS_USER@$VPS_HOST \"cat $REMOTE_UPLOAD_DIR/${PREFIX}_part_* > $REMOTE_FILE\"" 2>&1

    # Verify final file integrity
    FINAL_SHA=$(eval "$SSH_CMD $VPS_USER@$VPS_HOST \"sha256sum $REMOTE_FILE 2>/dev/null || shasum -a 256 $REMOTE_FILE 2>/dev/null\"" | awk '{print $1}' || echo "")
    if [ "$FINAL_SHA" != "$LOCAL_SHA" ]; then
        echo "[UPLOAD] [ERROR] Final integrity check FAILED for $BASENAME"
        echo "[UPLOAD]   Local SHA:  $LOCAL_SHA"
        echo "[UPLOAD]   Remote SHA: $FINAL_SHA"
        eval "$SSH_CMD $VPS_USER@$VPS_HOST \"rm -f $REMOTE_FILE\"" 2>/dev/null || true
        rm -f "$STATE_DIR/${PREFIX}_part_"*
        echo "[UPLOAD] [ERROR] Upload failed integrity check. Run again to retry."
        exit 1
    fi
    echo "[UPLOAD]   File integrity verified (SHA256 match)"

    # Clean up: remote chunks + manifest, local chunks
    eval "$SSH_CMD $VPS_USER@$VPS_HOST \"rm -f $REMOTE_UPLOAD_DIR/${PREFIX}_part_* $REMOTE_MANIFEST\"" 2>/dev/null || true
    rm -f "$STATE_DIR/${PREFIX}_part_"* "$CHUNK_CHECKSUMS"
    echo ""
done

# 4. Upload deploy script and config files
echo "[UPLOAD] Step 4/5: Uploading deployment files..."
CONFIG_FILES=(
    "$PROJECT_DIR/deploy.sh"
    "$PROJECT_DIR/docker-compose.yml"
    "$PROJECT_DIR/deploy.conf"
    "$PROJECT_DIR/Dockerfile"
    "$PROJECT_DIR/nginx.conf"
)
for cf in "${CONFIG_FILES[@]}"; do
    if [ -f "$cf" ]; then
        echo "[UPLOAD]   Uploading $(basename "$cf")..."
        eval "$SCP_CMD \"$cf\" $VPS_USER@$VPS_HOST:$SITE_PATH/" 2>&1
    fi
done
echo ""

# 5. Cleanup remote temp dir
echo "[UPLOAD] Step 5/5: Cleaning up..."
eval "$SSH_CMD $VPS_USER@$VPS_HOST \"rmdir $REMOTE_UPLOAD_DIR 2>/dev/null; exit 0\"" 2>/dev/null || true

echo ""
echo "[UPLOAD] ========================================"
echo "[UPLOAD]  Upload Complete!"
echo "[UPLOAD]  Target: $VPS_USER@$VPS_HOST:$SITE_PATH"
echo "[UPLOAD] ========================================"
echo ""
