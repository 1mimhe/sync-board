# SyncBoard

A real-time collaborative task and document platform — Kanban boards with drag-and-drop
ordering, CRDT-based collaborative editing, and multi-tenant workspaces. Built as a
**modular monolith** in NestJS/TypeScript, designed so that every module boundary matches a
potential future service boundary.

---

## Features

- **Workspaces & RBAC** — multi-tenant workspaces with a four-level role hierarchy
  (owner / admin / member / viewer) enforced per request, never from stale token claims.
- **Kanban boards** — lists and cards ordered by **Lexorank** fractional indexing, so moving a
  card writes exactly one row instead of re-indexing a list. Supports soft-delete archiving,
  restoring, and permanent hard-deletion.
- **Unified Workspace Labels** — workspace-wide labels attachable to cards across boards, with
  real-time card tagging and cross-board tagged cards exploration.
- **Collaborative documents** — rich-text and markdown editing over **Yjs CRDT**, live cursors
  and awareness, merged server-side, debounced persistence to PostgreSQL, snapshot versioning.
- **Real-time engine** — Socket.IO rooms per board/document/user, Redis-backed presence with
  heartbeats and stale sweeps, live cursors, and a Redis adapter for horizontal scaling.
- **Frontend SPA Client** — modern React 19, TypeScript, Vite, Socket.IO client, Yjs editor,
  and sleek glassmorphism UI located in `frontend/`.
- **Authentication** — JWT access tokens (RS256), refresh tokens delivered as HTTP-only
  cookies with **rotation chains and reuse detection**, Google OAuth, Redis token blacklist.
- **Activity audit trail** — append-only activity events written through domain-event listeners,
  isolated from request paths by design.
- **Planned (Phase 6–7)** — RabbitMQ pipeline with outbox-style reliability and DLQs,
  notifications with @mentions, S3 presigned two-phase uploads, CI/CD and deployment.

## Architecture

```
Client (React 19 SPA) ──▶ Nginx ──▶ REST (NestJS controllers)
                                └──▶ WebSocket (Socket.IO gateways)
                                                │
        Application core: auth · workspace · board · document ·
                          activity · notification · file · mail
                                                │
    PostgreSQL ── Redis ── RabbitMQ (planned) ── S3 (planned)
```

Modules communicate through exported services only; cross-module side effects (activity logs,
notifications, broadcasts) are triggered by internal domain events (`card.created`,
`workspace.member_added`) so producers never depend on consumers.

## Design decisions worth reading about

Each of these has a dedicated doc with the reasoning — the "why" behind the code:

| Decision | Why | Doc |
|----------|-----|-----|
| Modular monolith over microservices | single deployable discipline now, clean extraction seams later | `01-architecture-overview.md` |
| Lexorank ordering | O(1) writes on drag-and-drop vs O(n) re-indexing | `02-database-design.md` §3.4 |
| Partial + GIN indexes | smaller indexes, faster soft-delete-aware queries; added as raw SQL since Prisma cannot express them | `02-database-design.md` §4–6 |
| Refresh rotation chain + family revocation | replayed revoked token proves theft → revoke the whole session family (Auth0-style) | `06-auth-and-rbac.md` §3 |
| HTTP-only cookie for refresh tokens | keeps tokens out of JavaScript reach; SameSite choice documented with its CSRF trade-off | `06-auth-and-rbac.md` cookie contract |
| CRDT (Yjs) for documents, last-write-wins for board actions | character-level merges must not lose keystrokes; discrete card moves don't need a CRDT | `05-realtime-engine.md` §5 |
| Redis dual-key presence | heartbeat is an O(log N) ZSET touch — no JSON parsing on the hot path | `04-websocket-events.md` presence notes |
| Cursor pagination everywhere | stable pages under concurrent inserts; offset is banned project-wide | `03-api-design.md` §1 |
| Time-partitioned activity log | append-only growth needs cheap retention (DROP partition, not DELETE) | `02-database-design.md` §3.6 |
| DTO-layer sanitization | validation pipes normalize input once; services receive clean data | `CODE_STANDARDS.md` §6 |

## Technology stack

| Layer | Technology |
|-------|------------|
| Backend runtime / framework | Node.js 20, NestJS 11, TypeScript strict mode |
| Frontend client | React 19, TypeScript, Vite, Socket.IO client, Yjs |
| Database | PostgreSQL 16, Prisma ORM, migrations with hand-written partial/GIN SQL |
| Cache & realtime infra | Redis 7 (ioredis), Socket.IO + `@socket.io/redis-adapter` |
| Auth | Passport.js, JWT RS256, Google OAuth 2.0, bcrypt |
| Ordering | lexorank |
| API docs | OpenAPI via `@nestjs/swagger` (`/api/docs`) |
| Logging | Pino structured JSON with request correlation IDs and redaction |
| Testing | Jest unit suite at a 100% coverage gate, Supertest E2E, socket.io-client WS tests |
| Tooling | Docker Compose (PostgreSQL, Redis, RabbitMQ, MailHog), GitHub Actions (planned Phase 7) |

## Implementation status

| Phase | Scope | State |
|-------|-------|-------|
| 1 | Foundation & auth | done |
| 2 | Workspaces, boards, cards, comments, attachments | done |
| 3 | Real-time engine (rooms, presence, cursors) | done |
| 4A–4D | Hardening: migrations & indexes, rotation chain, checklists, module refactor, email service | done |
| 5 | Collaborative documents (Yjs CRDT, snapshots, live awareness) | done |
| Soft Delete | Archival & restore for boards/lists/cards + permanent deletion | done |
| Frontend | React 19 SPA client with live Kanban, collaborative doc editor, modals & tabs | done |
| 6 | RabbitMQ async pipeline, notifications, S3 files | planned |
| 7 | CI/CD, replica + PgBouncer, Nginx, deployment | planned |

## Documentation

Design documentation lives in [`docs/`](docs/). It is currently excluded from version control
(`docs` is in `.gitignore`) while implementation is in flux; when the project reaches
completion, the **design documents below will be committed**. The phase-by-phase
implementation specs and the reusable documentation kit remain working material and stay local.

| Document | Contents |
|----------|----------|
| [`01-architecture-overview.md`](docs/01-architecture-overview.md) | system topology, module boundaries, scaling decisions |
| [`02-database-design.md`](docs/02-database-design.md) | full schema, index strategy with serving queries, migration rules |
| [`03-api-design.md`](docs/03-api-design.md) | endpoint catalog, response envelope, error-code registry |
| [`04-websocket-events.md`](docs/04-websocket-events.md) | room model, event contracts, rate limits |
| [`05-realtime-engine.md`](docs/05-realtime-engine.md) | CRDT vs OT analysis, presence design, persistence strategy |
| [`06-auth-and-rbac.md`](docs/06-auth-and-rbac.md) | token lifecycle, rotation flow, permission matrix |
| [`07-module-specifications.md`](docs/07-module-specifications.md) | per-module responsibilities, interfaces, events |
| [`08-message-queue-design.md`](docs/08-message-queue-design.md) | exchanges/queues, retry and dead-letter strategy |
| [`09-infrastructure-devops.md`](docs/09-infrastructure-devops.md) | compose topology, Dockerfile, proxy config, CI pipeline |
| [`10-testing-strategy.md`](docs/10-testing-strategy.md) | test pyramid, coverage gate, edge-case taxonomy |
| [`11-implementation-roadmap.md`](docs/11-implementation-roadmap.md) | phased plan with task tables |
| [`12-security-checklist.md`](docs/12-security-checklist.md) | burn-down of security requirements with real statuses |
| [`13-project-structure.md`](docs/13-project-structure.md) | directory layout and naming conventions |
| [`14-error-handling-logging.md`](docs/14-error-handling-logging.md) | exception hierarchy, error codes, logging standards |

Supporting material: `docs/test-cases/` (manual/E2E scenario catalogs and test-generation
guides) and `docs/project-kit/` (reusable templates used to bootstrap projects like this one).

## Getting started

### 1. Start Infrastructure & Backend

```bash
cp .env.example .env             # fill values
docker compose up -d             # PostgreSQL + Redis (+ MailHog)
mkdir keys && openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
npm install
npx prisma migrate dev           # or: npx prisma migrate deploy
npm run start:dev
```

Without key files the app falls back to HS256 with `JWT_SECRET`; production builds require
RS256 key files via config validation.

### 2. Start Frontend Client

```bash
cd frontend
npm install
npm run dev                      # starts Vite dev server at http://localhost:5173
```

## API documentation

Interactive Swagger UI at **http://localhost:3000/api/docs** once the app is running.

## Testing

```bash
npm test            # unit suite, 100% coverage gate enforced in CI config
npm run test:e2e    # HTTP journeys + WebSocket suites (needs docker compose up)
cd frontend && npm run build  # verifies frontend type check & production bundle
```

Scenario catalogs and generation guides are described in `docs/test-cases/README.md`.
