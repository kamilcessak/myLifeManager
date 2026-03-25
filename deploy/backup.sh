#!/bin/bash
set -euo pipefail

# ============================================
# Database backup script for myLifeManager
# Add to crontab: 0 3 * * * /opt/mylifemanager/deploy/backup.sh >> /var/log/mlm-backup.log 2>&1
# ============================================

APP_DIR="/opt/mylifemanager"
BACKUP_DIR="${APP_DIR}/backups"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
ENV_FILE="${APP_DIR}/.env.production"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

source "$ENV_FILE"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

docker compose -f "$COMPOSE_FILE" exec -T db \
    pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-mylifemanager}" \
    | gzip > "${BACKUP_DIR}/db_${DATE}.sql.gz"

FILESIZE=$(du -h "${BACKUP_DIR}/db_${DATE}.sql.gz" | cut -f1)
echo "[$(date)] Backup created: db_${DATE}.sql.gz (${FILESIZE})"

DELETED=$(find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[$(date)] Cleaned up ${DELETED} old backup(s) (>${RETENTION_DAYS} days)"
fi

echo "[$(date)] Backup complete."
