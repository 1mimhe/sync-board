# 09 — Infrastructure & DevOps

## 1. Container Topology

| Service | Container | Host Port | Role | Health Check |
|---|---|---|---|---|
| **PostgreSQL Primary** | `syncboard-postgres` | `5432` | Primary relational database (ACID writes) | `pg_isready -U syncuser -d syncboard` |
| **PostgreSQL Replica** | *(full profile)* | `5433` | Read-only streaming replica | `pg_isready -U syncuser` |
| **PgBouncer** | *(full profile)* | `6432` | Transaction-mode connection pooler | Port check |
| **Redis** | `syncboard-redis` | `6379` | Cache, pub/sub, presence, token blacklisting | `redis-cli ping` |
| **RabbitMQ** | `syncboard-rabbitmq` | `5672` / `15672` | AMQP message broker & management dashboard | `rabbitmq-diagnostics ping` |
| **MinIO** | `syncboard-minio` | `9000` / `9001` | S3-compatible object storage & console | HTTP `/minio/health/live` |
| **MailHog** | `syncboard-mailhog` | `1025` / `8025` | Local SMTP capture & web inbox | HTTP `/api/v2/messages` |
| **db-init** | *(one-shot)* | — | Schema push, SQL files, optional seed | `service_completed_successfully` |
| **minio-init** | *(one-shot)* | — | Creates `syncboard-files` bucket | `service_completed_successfully` |
| **App** | *(app/full profile)* | `3000` | NestJS production runtime | `GET /api/health` |
| **Frontend** | *(full profile)* | — | React SPA served by Nginx | — |
| **Nginx** | *(full profile)* | `80` | Edge reverse proxy | HTTP probe |

### Compose Profiles

| Command | What starts |
|---|---|
| `docker compose up -d` | Backing services only (Postgres, Redis, RabbitMQ, MinIO, MailHog) |
| `docker compose --profile app up -d` | + db-init, minio-init, app (NestJS production; seeds demo data by default) |
| `docker compose --profile full up -d` | + frontend, nginx, postgres-replica, pgbouncer (seeds demo data by default) |
| `RUN_SEED=false docker compose --profile app up -d` | Same as `app`, without demo data seeding |
| `RUN_SEED=false docker compose --profile full up -d` | Same as `full`, without demo data seeding |

---

## 2. Container Build Pipeline (Multi-Stage)

The `Dockerfile` uses six stages:

```
[1. base]         Node.js 20 Alpine + dumb-init + openssl + psql client
       │
[2. dependencies] npm ci + prisma generate  ← cached layer
       │
       ├──► [3. development]  Full sources + --watch reload
       │
       ├──► [4. build]        tsc compilation + npm prune --production
       │          │
       │    [6. production]   Minimal ~150MB image
       │                      ├── Non-root user nestjs (UID 1001)
       │                      ├── dist/ + prod node_modules
       │                      ├── entrypoint.sh (JWT key auto-generation)
       │                      └── dumb-init PID 1
       │
       └──► [5. migration]    prisma + psql — used by db-init container only
```

### Key Controls
- **Non-root execution**: `nestjs` user (UID 1001)
- **Signal handling**: `dumb-init` as PID 1 forwards `SIGTERM`/`SIGINT` to Node.js
- **Layer caching**: dependencies isolated from source — only re-runs on `package-lock.json` changes
- **JWT keys**: `docker/entrypoint.sh` generates an RSA-2048 pair into a named volume (`app_keys`) on first boot

---

## 3. Reverse Proxy & Edge Routing

Nginx routes all traffic on `:80`:

| Route | Upstream | Notes |
|---|---|---|
| `/api/health` | `app:3000` | No access log, no rate limit |
| `/api/auth/*` | `app:3000` | Rate limit: `10r/m` (burst 5) |
| `~* /files/presigned-upload$` | `app:3000` | Rate limit: `10r/m` (burst 5) |
| `/api/*` | `app:3000` | Rate limit: `100r/m` (burst 20) |
| `/socket.io/*` | `app:3000` | HTTP/1.1 Upgrade, 24h timeout, `ip_hash` sticky |
| `/*` | `frontend:80` | React SPA catch-all |

### Security Headers (all responses)
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 4. CI/CD Pipeline

```
[Push / Pull Request]
        │
        ▼
   [1. Lint & Types]    ESLint + tsc --noEmit + npm audit
        │
        ▼
   [2. Unit Tests]      Jest (100% coverage gate)
        │
        ▼
   [3. Integration]     Ephemeral Postgres + Redis + RabbitMQ + MailHog
                        prisma db push → activity-partitions.sql → custom-indexes.sql → e2e
        │
        ▼
   [4. Docker Build]    Build backend (target: production) & frontend SPA
        │
        ▼
   [5. Registry Push]   Docker Hub: `<dockerhub_user>/sync-board:latest` + `-frontend:latest`
                        GHCR:       `ghcr.io/<repo>:latest` + `-frontend:latest`
```

> [!TIP]
> Pushing to Docker Hub is triggered when `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets are added to your repository settings. If not set, it pushes to GitHub Container Registry (`ghcr.io`) by default.

---

## 5. Environment Variables

> [!NOTE]
> Redis is configured via `REDIS_HOST` / `REDIS_PORT`, not a `REDIS_URL`.
> In production, RS256 key files are **required** (`JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH`).
> The `docker/entrypoint.sh` generates them automatically from within Docker.

See [`.env.example`](../.env.example) for the full reference with inline documentation.

---

## 6. PostgreSQL Streaming Replication (full profile)

- **WAL streaming**: Primary runs with `wal_level=replica`, streams changes over a dedicated `replicator` role connection.
- **Physical replication slot** (`replica_slot_1`): Ensures primary retains WAL until the replica acknowledges, preventing sync loss during restarts.
- **Hot standby**: Replica initialises via `pg_basebackup -R` and serves read queries via `DATABASE_REPLICA_URL`.

---

## 7. Health Monitoring

Terminus probes at `GET /api/health`:

| Indicator | Target | Criteria |
|---|---|---|
| Database | PostgreSQL | Prisma ping within threshold |
| Redis | Redis 7 | Ping-pong response |
| RabbitMQ | RabbitMQ 3.13 | Active channel check |
| Disk | Root filesystem | Usage < 90% |
| Memory | Node.js heap | < 300 MB |

---

## 8. Useful Commands

```bash
# ── Local dev (infra only) ────────────────────────────────────────────────
docker compose up -d                          # start backing services
docker compose ps                             # check health status
docker compose logs -f app                    # tail app logs

# ── Full stack (app + frontend + nginx) ──────────────────────────────────
docker compose --profile full up -d
RUN_SEED=false docker compose --profile full up -d  # skip demo data seeding

# ── Database ─────────────────────────────────────────────────────────────
docker compose exec postgres-primary psql -U syncuser -d syncboard
docker compose exec app npx prisma studio     # browser-based DB explorer

# ── Redis ────────────────────────────────────────────────────────────────
docker compose exec redis redis-cli

# ── Rebuild after Dockerfile changes ─────────────────────────────────────
docker compose --profile full up -d --build

# ── Teardown (WARNING: removes all data volumes) ─────────────────────────
docker compose --profile full down -v
```
