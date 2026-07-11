# Deployment

Production runs four pieces via `docker-compose.prod.yml`: **Postgres**, **Redis**, **api** (NestJS, ×2 replicas), and **web** (static build served by nginx, which also reverse-proxies `/api` and `/socket.io` to the api service).

## 1. Prerequisites
- A host with Docker + Docker Compose.
- Managed or self-hosted **S3** (or MinIO) and an **SMTP** provider.
- DNS pointing at the host; TLS terminated by your edge (Caddy/Traefik/ALB) in front of the `web` container, or add certs to nginx.

## 2. Environment
Create `.env.prod` (never commit it) from `.env.example`, with production values:

```
NODE_ENV=production
FRONTEND_URL=https://app.yourdomain.com
DATABASE_URL=postgresql://teamboard:STRONG_PW@postgres:5432/teamboard?schema=public
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=<64+ random chars>
JWT_REFRESH_SECRET=<64+ random chars>
ENCRYPTION_KEY=<32+ random chars>          # encrypts Google refresh tokens
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=teamboard-prod
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_FORCE_PATH_STYLE=false                   # true for MinIO
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="TeamBoard <no-reply@yourdomain.com>"
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://app.yourdomain.com/api/integrations/google/callback
```
Also set `POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB` (compose reads them for the db + backup services).

## 3. Build & run
```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```
The api container runs `prisma migrate deploy` on start (see `docker/api-entrypoint.sh`) before serving — migrations are applied automatically on each release.

## 4. Production checklist
- **Secrets**: long random `JWT_*` + `ENCRYPTION_KEY`; rotate periodically. Rotating `JWT_REFRESH_SECRET` invalidates all sessions.
- **CORS / cookies**: `FRONTEND_URL` must be the real origin; set `NODE_ENV=production` so refresh cookies are `Secure`. Serve over HTTPS.
- **Trust proxy**: behind nginx/edge, the api sees proxied IPs — throttler keys on them; ensure `X-Forwarded-For` is forwarded (nginx.conf does).
- **WebSockets**: the client uses `transports: ['websocket']`, so the Socket.IO **Redis adapter** handles fan-out across the 2 api replicas without sticky sessions. (If you re-enable long-polling, add sticky sessions at the edge.)
- **Healthchecks**: api `GET /api/health`, postgres `pg_isready`, redis `redis-cli ping` — all wired with restart policies.
- **Backups**: the `postgres-backup` service writes a daily gzipped `pg_dump` to `./backups` and prunes >14 days. Copy these off-host.
- **Sentry**: add a DSN + `@sentry/node` (api) and `@sentry/react` (web) — `ErrorBoundary` and the global exception filter are the hook points.

## 5. Rollback
Migrations use `prisma migrate deploy` (forward-only). To roll back:
1. Redeploy the previous image tag (`teamboard-api:<prev-sha>`).
2. If a migration must be reverted, restore the latest pre-deploy backup:
   ```bash
   gunzip -c backups/teamboard-YYYY-MM-DD.sql.gz | \
     docker compose -f docker-compose.prod.yml exec -T postgres psql -U teamboard teamboard
   ```
   Take a fresh `pg_dump` immediately before every release so a clean restore point always exists.

## 6. CI/CD
`.github/workflows/ci.yml` runs lint → typecheck → unit + e2e (against ephemeral Postgres/Redis) → build, then builds both Docker images on `main`. Add a deploy job (SSH `docker compose pull && up -d`, or push images to a registry and deploy on your platform) with your environment's credentials.
