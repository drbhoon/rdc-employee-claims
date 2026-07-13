#!/bin/sh
set -e

NGINX_SITE_NAME="${NGINX_SITE_NAME:-claims.rdcc.ai}"
NGINX_LIMIT_CONFIG="${NGINX_LIMIT_CONFIG:-deploy/nginx/upload-limit.conf}"
NGINX_CONF_D_DIR="${NGINX_CONF_D_DIR:-/etc/nginx/conf.d}"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "Docker Compose is not installed." >&2
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

$COMPOSE down
$COMPOSE up -d --build

if [ "${SKIP_NGINX_RELOAD:-false}" = "true" ]; then
  echo "Skipping Nginx config because SKIP_NGINX_RELOAD=true"
  exit 0
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "Nginx is not installed on this server; Docker deployment completed."
  exit 0
fi

if [ ! -f "$NGINX_LIMIT_CONFIG" ]; then
  echo "Nginx upload-limit config not found: $NGINX_LIMIT_CONFIG" >&2
  exit 1
fi

$SUDO install -d "$NGINX_CONF_D_DIR"
$SUDO install -m 0644 "$NGINX_LIMIT_CONFIG" "$NGINX_CONF_D_DIR/rdc-claims-upload-limit.conf"
$SUDO nginx -t
$SUDO systemctl reload nginx

echo "Deployment complete."
