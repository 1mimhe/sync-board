# 09 — Infrastructure & DevOps

## 1. Container Infrastructure Topology

SyncBoard uses Docker Compose to orchestrate local backing services and production simulation environments:

| Service | Container Name | Host Port | Role & Purpose | Health Check Probe |
|---|---|---|---|---|
| **App** | `syncboard-app` | `3000` / `9229` | NestJS application runtime & debugger | `GET /health` |
| **PostgreSQL Primary** | `syncboard-pg-primary` | `5432` | Primary relational database (ACID writes) | `pg_isready -U syncboard` |
| **PostgreSQL Replica** | `syncboard-pg-replica` | `5433` | Read-only streaming replica (`--profile full`) | `pg_isready` |
| **PgBouncer** | `syncboard-pgbouncer` | `6432` | Transaction-mode connection pooler (`--profile full`) | Port check |
| **Redis** | `syncboard-redis` | `6379` | Cache, pub/sub, presence, token blacklisting | `redis-cli ping` |
| **RabbitMQ** | `syncboard-rabbitmq` | `5672` / `15672` | AMQP message broker & management dashboard | `rabbitmq-diagnostics check_port_connectivity` |
| **Nginx** | `syncboard-nginx` | `80` / `443` | Reverse proxy, SSL, and rate limiting (`--profile full`) | HTTP probe |
| **MinIO** | `syncboard-minio` | `9000` / `9001` | S3-compatible object storage & management console | Port check |
| **MailHog** | `syncboard-mailhog` | `1025` / `8025` | Local SMTP capture server & web inbox | HTTP probe |

### Compose Profiles
* **Default (`docker compose up -d`)**: Launches core backing services (Primary Postgres, Redis, RabbitMQ, MinIO, MailHog) for lightweight local development.
* **Full Stack (`docker compose --profile full up -d`)**: Boots the complete production topology including PgBouncer pooling, Postgres read replica, and Nginx edge proxy with sticky sessions.

---

## 2. Container Build Pipeline (Multi-Stage)

The `Dockerfile` employs a multi-stage build strategy designed for minimal production footprint and container security:

```
[1. Base Layer] ────────> Node.js 20 Alpine + dumb-init
       │
[2. Dependencies] ──────> npm ci + Prisma client generation (cached layer)
       │
       ├──> [3. Development Target] ──> Full sources + live reload watchers
       │
[4. Build Stage] ───────> tsc compilation + npm prune --production
       │
[5. Production Image] ──> Minimal ~150MB image
                           ├── Non-root user: nestjs (UID 1001)
                           ├── Production node_modules + compiled dist/
                           └── dumb-init PID 1 signal forwarding
```

### Key Security & Optimization Controls
* **Non-Root Execution**: Runs under a dedicated `nestjs` system user (UID 1001) rather than `root`.
* **Signal Handling**: `dumb-init` runs as PID 1 to ensure POSIX signals (`SIGTERM`, `SIGINT`) are forwarded correctly to Node.js, enabling graceful teardown.
* **Layer Caching**: Dependencies and Prisma generation run in isolated earlier layers, avoiding reinstallation when application source code changes.

<details>
<summary><strong>💡 Why multi-stage build?</strong></summary>

| Stage | Purpose | Included in Final Image? |
|---|---|:---:|
| `base` | Alpine + dumb-init | ✅ (base layer) |
| `dependencies` | npm install + prisma generate | ❌ |
| `development` | Full source + dev deps | ❌ (separate target) |
| `build` | TypeScript compilation | ❌ |
| `production` | Only dist + prod deps | ✅ |

**Result**: Production image is ~150MB instead of ~800MB (no TypeScript compiler, no development dependencies, no raw source code).

</details>

---

## 3. Reverse Proxy & Edge Routing Architecture

Nginx terminates TLS, provides edge rate limiting, and routes traffic between REST and WebSocket protocols:

| Route Path | Target Upstream | Traffic Policies & Headers |
|---|---|---|
| `/api/` | `app_servers:3000` | Rate limit: `100r/m` (burst: 20). Injects `X-Request-Id` and client IP headers. |
| `/api/auth/` | `app_servers:3000` | Stricter rate limit: `10r/m` (burst: 5) to mitigate brute-force attacks. |
| `/socket.io/` | `app_servers:3000` | WebSocket upgrade (`Upgrade: websocket`). Session pinned via `ip_hash` upstream. |

### Edge Security Headers
* **HSTS**: `Strict-Transport-Security: max-age=63072000; includeSubDomains`
* **Clickjacking Protection**: `X-Frame-Options: SAMEORIGIN`
* **MIME Sniffing Prevention**: `X-Content-Type-Options: nosniff`
* **Cross-Site Scripting Filter**: `X-XSS-Protection: 1; mode=block`
* **Body Size Restriction**: `client_max_body_size 25M`

---

## 4. CI/CD Pipeline Architecture

The automated continuous integration workflow enforces quality checks on every pull request:

```
[Push / Pull Request]
        │
        ▼
   [1. Lint & Types] ──────> ESLint + strict TypeScript compilation (tsc --noEmit)
        │
        ▼
   [2. Unit Tests] ────────> Jest unit test suite with 100% coverage gate enforcement
        │
        ▼
   [3. Integration Tests] ──> Testcontainers (ephemeral PostgreSQL & Redis instances)
        │
        ▼
   [4. Container Build] ───> Multi-stage Docker build with GitHub Actions layer caching
        │
        ▼
   [5. Package Registry] ──> Push signed production image to GHCR (main branch only)
```

---

## 5. Environment Variables

> [!NOTE]
> Redis is configured via **`REDIS_HOST` / `REDIS_PORT`** (matching `RedisService`), not a
> `REDIS_URL`. The application fails fast at boot if no JWT signing material is provided
> (`JWT_PRIVATE_KEY_PATH`/`JWT_PUBLIC_KEY_PATH` for RS256, or `JWT_SECRET` for HS256 in dev
> only — RS256 key files are **required** in production).

```bash
# .env.example

# ---- Application ----
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
CLIENT_URL=http://localhost:3001     # CORS origin(s); comma-separated for multiple

# ---- Database ----
DATABASE_URL=postgresql://syncuser:syncpass@localhost:5432/syncboard?schema=public
DATABASE_REPLICA_URL=postgresql://syncuser:syncpass@localhost:5433/syncboard?schema=public

# ---- Redis ----
REDIS_HOST=localhost
REDIS_PORT=6379

# ---- RabbitMQ ----
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# ---- JWT ----
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
# Dev-only symmetric fallback when key files are absent:
JWT_SECRET=

# ---- Google OAuth ----
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# ---- AWS S3 ----
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=syncboard-files
AWS_REGION=us-east-1
```

---

## 6. PostgreSQL Streaming Replication

SyncBoard configures high-availability physical replication between the primary and read replica nodes:

* **WAL Streaming Protocol**: The primary PostgreSQL instance archives write-ahead logs (`wal_level = replica`) and streams changes over a dedicated replication connection (`replicator` role).
* **Physical Replication Slot**: Uses `replica_slot_1` to ensure the primary retains WAL segments until acknowledged by the replica, preventing synchronization loss during network interruptions.
* **Standby Promotion**: The replica initializes via `pg_basebackup` streaming mode and operates in `hot_standby` mode, allowing offloading of read-heavy queries via `DATABASE_REPLICA_URL`.

---

## 7. System Health Monitoring

Live health probes are exposed at `/api/health` powered by `@nestjs/terminus`:

| Indicator | Target Subsystem | Success Criteria |
|---|---|---|
| **Database** | PostgreSQL | Ping check via Prisma executes within threshold |
| **Redis** | Redis 7 | Ping-pong response confirms cache/presence connectivity |
| **RabbitMQ** | RabbitMQ 3.13 | Active channel verification confirms broker health |
| **Storage** | Root Filesystem | Disk usage under 90% capacity |
| **Memory** | Node.js Process | Heap memory footprint remains under 300MB |

---

## 8. Useful Docker Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Enter PostgreSQL shell
docker compose exec postgres-primary psql -U syncboard

# Enter Redis CLI
docker compose exec redis redis-cli

# RabbitMQ Management UI
open http://localhost:15672  # User: syncboard / Pass: syncboard_pass

# Run Prisma migrations
docker compose exec app npx prisma migrate dev

# Rebuild after Dockerfile changes
docker compose up -d --build app

# Full cleanup (removes volumes!)
docker compose down -v
```
