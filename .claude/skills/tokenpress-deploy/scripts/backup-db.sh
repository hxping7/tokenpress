#!/bin/bash
# Token00: Backup database
# Usage:
#   backup-db.sh <project-dir> local    - Backup from local Docker container
#   backup-db.sh <project-dir> vps      - Backup from remote VPS via SSH
set -euo pipefail

PROJECT_DIR="$1"
MODE="${2:-local}"
CONFIG_FILE="$PROJECT_DIR/deploy.conf"
HOST_FILE="$PROJECT_DIR/host.conf"
BACKUP_DIR="$PROJECT_DIR/data/backups"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Source deploy.conf
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Source host.conf for VPS mode
VPS_HOST=""
VPS_USER="root"
VPS_PORT="22"
SSH_KEY=""
if [ -f "$HOST_FILE" ]; then
    source "$HOST_FILE"
fi

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/token00-db-backup-$TIMESTAMP.db"
BACKUP_LOG="$BACKUP_DIR/backup-$TIMESTAMP.log"

echo "[BACKUP] ========================================"
echo "[BACKUP]  Token00 Database Backup"
echo "[BACKUP]  Mode: $MODE"
echo "[BACKUP]  Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

if [ "$MODE" = "local" ]; then
    # Local Docker backup
    echo "[BACKUP] Step 1/3: Checking local container..."

    # Check via docker cp or volume path
    CONTAINER="token00-backend"
    if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
        echo "[BACKUP]   Container '$CONTAINER' is running"
        echo "[BACKUP] Step 2/3: Copying database from container..."
        docker cp "$CONTAINER:/app/apps/server/data/token00.db" "$BACKUP_FILE"
        echo "[BACKUP]   Copied to: $BACKUP_FILE"
    else
        echo "[BACKUP]   [WARN] Container '$CONTAINER' not running, checking Docker volume..."
        # Try to get from Docker volume
        docker run --rm -v token00-data:/data alpine ls /data/token00.db >/dev/null 2>&1 || true
        if [ $? -eq 0 ]; then
            docker run --rm -v token00-data:/data -v "$BACKUP_DIR:/backup" alpine cp /data/token00.db "/backup/$(basename "$BACKUP_FILE")"
            echo "[BACKUP]   Copied from volume to: $BACKUP_FILE"
        else
            echo "[BACKUP]   [WARN] No database found in container or volume"
            echo "[BACKUP]   Local database may not exist yet on this deployment"
            touch "$BACKUP_FILE.empty"
            echo "[BACKUP]   Created empty backup marker"
        fi
    fi
elif [ "$MODE" = "vps" ]; then
    # Remote VPS backup via SSH
    echo "[BACKUP] Step 1/3: Connecting to VPS ($VPS_HOST)..."

    if [ -z "$VPS_HOST" ]; then
        echo "[BACKUP] [ERROR] VPS_HOST not defined in $HOST_FILE"
        exit 1
    fi

    SSH_CMD="ssh -i \"$SSH_KEY\" -p $VPS_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10"

    echo "[BACKUP] Step 2/3: Backing up database on VPS..."
    # Create backup on VPS, then copy back
    eval "$SSH_CMD $VPS_USER@$VPS_HOST\" docker exec token00-backend sh -c 'cat /app/apps/server/data/token00.db'\" > \"$BACKUP_FILE\" 2>/dev/null" || \
    eval "$SSH_CMD $VPS_USER@$VPS_HOST\" docker run --rm -v token00-data:/data alpine cat /data/token00.db\" > \"$BACKUP_FILE\" 2>/dev/null" || \
    echo "[BACKUP]   [WARN] Could not copy database from VPS"

    if [ -s "$BACKUP_FILE" ]; then
        BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null)
        echo "[BACKUP]   Downloaded: $BACKUP_FILE ($BACKUP_SIZE bytes)"
    else
        echo "[BACKUP]   [WARN] Database file is empty or not found on VPS"
        rm -f "$BACKUP_FILE"
    fi
else
    echo "[BACKUP] [ERROR] Unknown mode: $MODE (use 'local' or 'vps')"
    exit 1
fi

# 3. Generate integrity checksum
echo "[BACKUP] Step 3/3: Generating checksum..."
if [ -f "$BACKUP_FILE" ]; then
    SHACMD="sha256sum"
    if ! command -v "$SHACMD" &>/dev/null; then
        SHACMD="shasum -a 256"
    fi
    $SHACMD "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
    echo "[BACKUP]   SHA256: $(cat "$BACKUP_FILE.sha256")"
    echo "[BACKUP]   Backup saved to: $BACKUP_FILE"
else
    echo "[BACKUP]   No backup file to checksum"
fi

# Cleanup: keep last 10 backups
echo "[BACKUP] Cleaning old backups (keep last 10)..."
ls -t "$BACKUP_DIR"/token00-db-backup-*.db 2>/dev/null | tail -n +11 | while read old; do
    rm -f "$old" "${old}.sha256"
    echo "[BACKUP]   Removed old backup: $(basename "$old")"
done

echo ""
echo "[BACKUP] ========================================"
echo "[BACKUP]  Backup Complete"
echo "[BACKUP] ========================================"
echo "[BACKUP]   Database backup saved"
echo ""
