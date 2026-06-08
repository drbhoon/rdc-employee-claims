#!/bin/sh
set -e

npx prisma migrate deploy

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  npx prisma db seed
fi

exec "$@"
