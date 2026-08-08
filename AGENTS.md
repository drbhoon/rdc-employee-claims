# Deployment environment notes

- On the production Ubuntu Docker host, `.env` is a symlink to `.env.docker` and intentionally does not provide a usable `DATABASE_URL` for host-side Prisma commands.
- `docker-compose.yml` constructs `DATABASE_URL` inside the `claims-app` container from `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. The hostname `claims-db` is reachable only on the Docker network.
- Do not diagnose an empty host `DATABASE_URL` as a missing or deleted database. First verify the running `claims-app` and `claims-db` containers.
- Do not run host-side `npx prisma migrate ...` with the container URL. Production migrations run through `docker-entrypoint.sh` when the rebuilt `claims-app` container starts.
- Before a production migration, create and validate a PostgreSQL dump. Then build with `docker compose build claims-app`, verify the migration is present in the image, and deploy with `docker compose up -d claims-app`.
- This project is pinned to Prisma 5.22.0. Do not use an unpinned Prisma 7 CLI or rewrite the datasource configuration unless the project is deliberately upgraded.
