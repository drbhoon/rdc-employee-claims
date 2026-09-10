# Deployment environment notes

## Recognized production server and preferred deployment

- SSH login/prompt: `developer@RDC-AI-UBUNTU` (Ubuntu production host).
- Server repository: `~/projects/claims_app/rdc-employee-claims`.
- Production website: `https://claims.rdcc.ai`; production Git branch: `prod`.
- Compose services: `claims-app` and `claims-db`. Container names: `rdc-employee-claims-claims-app-1` and `rdc-employee-claims-claims-db-1`.
- For routine application-only releases with no new database migrations, give the user this short, copyable Bash block:

```bash
cd ~/projects/claims_app/rdc-employee-claims &&
git pull --ff-only origin prod &&
docker compose build claims-app &&
docker compose up -d claims-app &&
docker compose logs --tail=100 claims-app
```

- Do not put `set -e` in the user's interactive SSH shell: an error can exit the shell and appear to disconnect the server. Use `&&` to stop subsequent deployment commands without exiting the shell.
- Avoid backslash line continuations and long diagnostic/backup blocks for routine application-only releases. Do not use `deploy.sh` for this flow: it stops the Compose stack with `down`.
- Keep the migration backup requirements below for releases with new migrations; inspect the release before choosing the routine flow.
- On 10 September 2026 the user confirmed this short deployment flow succeeded for the upload-limit/IST-date fix: image built, database healthy, application container started. Browser-level verification was not supplied.
- Diagnostics supplied on that date showed 31 GiB RAM, 14 GiB available memory, 150 GB free root disk space, and 154 days uptime. These are historical readings, not current guarantees. Do not infer server exhaustion or reboot from an SSH disconnection alone.
- Prefer recognizing this environment and supplying the established command over repeating environment discovery or asking for broad diagnostics without a specific failure.

## Database and migration handling

- On the production Ubuntu Docker host, `.env` is a symlink to `.env.docker` and intentionally does not provide a usable `DATABASE_URL` for host-side Prisma commands.
- `docker-compose.yml` constructs `DATABASE_URL` inside the `claims-app` container from `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. The hostname `claims-db` is reachable only on the Docker network.
- Do not diagnose an empty host `DATABASE_URL` as a missing or deleted database. First verify the running `claims-app` and `claims-db` containers.
- Do not run host-side `npx prisma migrate ...` with the container URL. Production migrations run through `docker-entrypoint.sh` when the rebuilt `claims-app` container starts.
- Before a production migration, create and validate a PostgreSQL dump. Then build with `docker compose build claims-app`, verify the migration is present in the image, and deploy with `docker compose up -d claims-app`.
- This project is pinned to Prisma 5.22.0. Do not use an unpinned Prisma 7 CLI or rewrite the datasource configuration unless the project is deliberately upgraded.
