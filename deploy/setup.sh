#!/bin/bash
set -euo pipefail

# ============================================
# Initial VPS setup for myLifeManager
# Run as root on a fresh Ubuntu 22.04+ / Debian 12+ VPS
# Usage: curl -sSL <raw-url> | bash
#   or:  bash deploy/setup.sh
# ============================================

APP_DIR="/opt/mylifemanager"
REPO_URL="${1:-}"

echo "==> Updating system packages..."
apt-get update && apt-get upgrade -y

echo "==> Installing essential tools..."
apt-get install -y curl git ufw fail2ban

echo "==> Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "    Docker already installed."
fi

echo "==> Configuring firewall (UFW)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Creating application directory..."
mkdir -p "$APP_DIR"

if [ -n "$REPO_URL" ]; then
    echo "==> Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
else
    echo ""
    echo "============================================"
    echo "  NEXT STEPS (run manually):"
    echo "============================================"
    echo ""
    echo "  1. Clone your repo:"
    echo "     git clone https://github.com/YOUR_USER/myLifeManager.git $APP_DIR"
    echo ""
    echo "  2. Create production env file:"
    echo "     cd $APP_DIR"
    echo "     cp .env.production.example .env.production"
    echo "     nano .env.production"
    echo ""
    echo "  3. Generate secrets:"
    echo "     # JWT secret"
    echo "     openssl rand -base64 64"
    echo "     # VAPID keys"
    echo "     docker run --rm node:20-alpine npx web-push generate-vapid-keys"
    echo "     # Postgres password"
    echo "     openssl rand -base64 32"
    echo ""
    echo "  4. Point your domain DNS A record to this server's IP"
    echo ""
    echo "  5. Start the application:"
    echo "     cd $APP_DIR"
    echo "     docker compose -f docker-compose.prod.yml --env-file .env.production up -d"
    echo ""
    echo "  6. Set up automated backups (crontab -e):"
    echo "     0 3 * * * $APP_DIR/deploy/backup.sh >> /var/log/mlm-backup.log 2>&1"
    echo ""
    echo "  7. Configure GitHub Actions secrets:"
    echo "     VPS_HOST     = $(curl -s ifconfig.me)"
    echo "     VPS_USER     = root (or deploy user)"
    echo "     VPS_SSH_KEY  = contents of ~/.ssh/id_ed25519"
    echo ""
fi

echo "==> Setup complete!"
