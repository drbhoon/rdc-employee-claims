#!/bin/sh
set -e

NGINX_SITE_NAME="${NGINX_SITE_NAME:-claims.rdcc.ai}"
NGINX_SOURCE_CONFIG="${NGINX_SOURCE_CONFIG:-deploy/nginx/claims.rdcc.ai.conf}"
NGINX_AVAILABLE_DIR="${NGINX_AVAILABLE_DIR:-/etc/nginx/sites-available}"
NGINX_ENABLED_DIR="${NGINX_ENABLED_DIR:-/etc/nginx/sites-enabled}"

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

if [ ! -f "$NGINX_SOURCE_CONFIG" ]; then
  echo "Nginx source config not found: $NGINX_SOURCE_CONFIG" >&2
  exit 1
fi

$SUDO install -d "$NGINX_AVAILABLE_DIR" "$NGINX_ENABLED_DIR"
$SUDO install -m 0644 "$NGINX_SOURCE_CONFIG" "$NGINX_AVAILABLE_DIR/$NGINX_SITE_NAME"
$SUDO ln -sf "$NGINX_AVAILABLE_DIR/$NGINX_SITE_NAME" "$NGINX_ENABLED_DIR/$NGINX_SITE_NAME"
$SUDO nginx -t
$SUDO systemctl reload nginx

echo "Deployment complete."
