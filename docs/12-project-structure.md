# 12 — Project Structure

This doc is the map of the repository layout: where modules, shared code,
infra, and specs live, and the placement rules that keep them consistent.

## 0. Module Layout (aggregator pattern)

```
src/modules/
├── auth/                          # single module + utils/auth-cookies.util.ts
├── workspace/
│   ├── workspace.module.ts        # aggregator
│   ├── guards/workspace-member.constants.ts
│   └── services/
│       ├── workspace.service.ts       # CRUD only
│       ├── membership.service.ts      # members, roles, leave, transfer
│       └── invitation.service.ts      # invite / accept / revoke
├── board/
│   ├── board.module.ts            # aggregator — imports + re-exports sub-modules
│   ├── utils/board-access.util.ts
│   ├── core/                      # board CRUD + starring
│   ├── list/
│   ├── card/
│   │   └── utils/card-status.util.ts
│   ├── card-fields/               # custom field defs + values
│   │   └── utils/custom-field-validator.util.ts
│   ├── card-time/                 # estimates + time logs
│   ├── comment/
│   │   └── utils/mention-parser.util.ts
│   ├── attachment/                # card attachments
│   │   ├── dto/index.ts
│   │   └── interfaces/attachment.interfaces.ts
│   ├── label/
│   ├── checklist/
│   │   └── events/checklist-events.constants.ts
│   ├── views/                     # calendar/timeline/table (controllers/, services/, repositories/)
│   │   └── dto/index.ts
│   └── realtime/                  # BoardGateway (handlers + relay split),
│       ├── dto/index.ts
│       └── events/ws-events.constants.ts
├── activity/                      # ActivityRepository + ActivityListener
│   └── interfaces/activity.interfaces.ts
├── mail/                          # MailerService + templates
│   ├── utils/mail-payload.util.ts
│   └── interfaces/index.ts
├── document/
│   ├── constants/document.constants.ts
│   └── interfaces/document.interfaces.ts
├── notification/
│   ├── dto/index.ts
│   ├── interfaces/notification-message.interface.ts
│   ├── constants/notification-routing.constants.ts
│   ├── mappers/notification.mapper.ts
│   └── utils/notification-payload.util.ts
└── file/
    └── interfaces/file.interfaces.ts
```

### 0.1 Placement rules

```
src/common/
├── constants/ws-rate-limit.constants.ts
├── decorators/ws-rate-limit.interface.ts
├── guards/rbac.constants.ts
├── guards/email-verified.constants.ts
├── interfaces/request-with-user.interface.ts
├── interfaces/index.ts
├── constants/index.ts
├── rabbitmq/rabbitmq.types.ts
├── rabbitmq/interfaces/consume-context.interface.ts
├── utils/retry.util.ts
└── utils/validation.util.ts

frontend/src/
├── types/{api,auth,workspace,board,card,document,activity}.types.ts
├── types/index.ts
├── constants/{api,storage-keys,socket}.constants.ts + index.ts
└── utils/{card,api}.utils.ts + index.ts
```

Rules:

1. **Constants** live in `constants/` or `*.constants.ts` — never at the top of a
   guard / listener / repository / decorator. Factory functions (e.g.
   `getRefreshTokenCookieOptions`) live in `utils/`, not `*.constants.ts`.
2. **Interfaces/types** live in `interfaces/` — never at the top of a repository
   (`Activity*`, `DocumentMetadata`), event file (`AttachmentEventTarget`), or
   decorator (`WsRateLimitOptions`, `RequestWithUser`).
3. **Pure functions** live in `utils/` — never in `services/` (`*.util.ts` under
   `services/`), `shared/` (renamed to `utils/`), or `dto/` (mapper in DTO).
4. **Events:** `events/*.events.ts` holds payload classes only;
   `events/*-events.constants.ts` holds the name map (checklist fixed).
5. **Barrels everywhere:** every `dto/`, `constants/`, `interfaces/` folder has an
   `index.ts` that exports *local files only* (no `CursorPaginationQueryDto`
   re-exports; import it from `common/dto` directly).
6. Each sub-feature folder = one NestJS module:
   {sub-feature}.module.ts, controllers/, services/, repositories/, dto/,
   events/{sub-feature}.events.ts (+ {sub-feature}-events.constants.ts), __tests__/
   Max depth 3 (board/<slice>/<role>). Optional only: interfaces/, mappers/,
   utils/, constants/, gateways/ + guards/ (realtime only).

<details>
<summary><strong>💡 Why aggregator + sub-feature folders over flat modules?</strong></summary>

Flat feature folders mix 8+ concerns in one module file — every card, list, or
comment change collides. Sub-feature folders own their vertical slice while the
aggregator re-exports only the cross-domain surface, keeping extraction seams
clean. Max depth 3 prevents nesting sprawl. See `07-module-specifications.md` for
the event-decoupling rationale that makes this split safe.

</details>

## 1. Full Directory Tree

```
sync-board/
├── .env.example
├── prisma.config.ts                   # Prisma 7 config: datasource URL, migrations path
├── eslint.config.mjs                  # Flat ESLint config
├── .prettierrc                        # Prettier rules
├── docker-compose.yml                 # Local infra: PostgreSQL + Redis + RabbitMQ + MinIO + MailHog
│
├── .github/                           # CI + dependency automation
│   └── workflows/
│       ├── ci.yml                    # GitHub Actions CI/CD pipeline (lint, unit tests, coverage, build)
│       └── dependabot.yml            # Automated dependency updates
│
├── docker/                            # Container + proxy + DB infra
│   ├── nginx/
│   │   ├── nginx.conf                # Reverse proxy & SSL configuration
│   │   └── certs/                    # SSL certificates (dev: self-signed)
│   ├── postgres/
│   │   ├── primary/
│   │   │   ├── postgresql.conf       # Primary database configuration
│   │   │   └── pg_hba.conf           # Client authentication
│   │   └── replica/
│   │       ├── setup-replica.sh      # Streaming replica setup script
│   │       └── init-replication.sh   # Replication slot initialization
│   └── rabbitmq/
│       ├── rabbitmq.conf             # RabbitMQ server configuration
│       └── definitions.json          # Pre-defined exchanges and queues
│
├── prisma/
│   ├── schema.prisma                 # Prisma ORM schema definition
│   └── migrations/                   # SQL migration history (see 02 §6)
│
├── src/
│   ├── main.ts                       # Application bootstrap & global pipes/interceptors
│   ├── app.module.ts                 # Root application module
│   ├── app.controller.ts             # Root info / welcome controller
│   ├── app.controller.spec.ts        # Root controller spec
│   ├── app.service.ts                # Root application service
│   │
│   ├── common/                       # Shared infrastructure & utilities
│   │   ├── config/
│   │   │   ├── config.module.ts      # NestJS ConfigModule registration
│   │   │   ├── config.schema.ts      # Joi schema validation for environment variables
│   │   │   └── config.constants.ts   # Configuration token constants
│   │   ├── database/
│   │   │   ├── prisma.module.ts      # Global Prisma database module
│   │   │   ├── prisma.service.ts     # PrismaClient lifecycle wrapper
│   │   │   └── __tests__/
│   │   │       └── prisma.service.spec.ts
│   │   ├── redis/
│   │   │   ├── redis.module.ts       # Global Redis module
│   │   │   ├── redis.service.ts      # ioredis client wrapper with key prefixing
│   │   │   ├── redis-io.adapter.ts   # Socket.IO Redis pub/sub adapter
│   │   │   └── __tests__/
│   │   │       ├── redis.service.spec.ts
│   │   │       └── redis-io.adapter.spec.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts    # @CurrentUser() HTTP parameter decorator
│   │   │   ├── ws-user.decorator.ts         # @WsUser() WebSocket data decorator
│   │   │   └── ws-rate-limit.decorator.ts   # @WsRateLimit() metadata decorator
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts          # JWT bearer token & blacklist verification
│   │   │   ├── anonymous.guard.ts         # Prevents authenticated users from guest routes
│   │   │   ├── rbac.guard.ts              # Hierarchical workspace role checking
│   │   │   ├── ws-auth.guard.ts           # WebSocket handshake & message JWT validation
│   │   │   ├── ws-rate-limit.guard.ts     # Sliding-window rate limit guard for WebSockets
│   │   │   └── __tests__/
│   │   │       ├── jwt-auth.guard.spec.ts
│   │   │       ├── anonymous.guard.spec.ts
│   │   │       ├── rbac.guard.spec.ts
│   │   │       ├── ws-auth.guard.spec.ts
│   │   │       └── ws-rate-limit.guard.spec.ts
│   │   ├── filters/
│   │   │   ├── all-exceptions.filter.ts   # Global standard HTTP exception filter
│   │   │   ├── ws-exception.filter.ts     # Global WebSocket error filter
│   │   │   └── __tests__/
│   │   │       ├── all-exceptions.filter.spec.ts
│   │   │       └── ws-exception.filter.spec.ts
│   │   ├── interceptors/
│   │   │   ├── response.interceptor.ts       # Standard { success, data, meta } response envelope
│   │   │   ├── correlation-id.interceptor.ts # X-Request-Id header & request tracing
│   │   │   └── __tests__/
│   │   │       ├── response.interceptor.spec.ts
│   │   │       └── correlation-id.interceptor.spec.ts
│   │   ├── pipes/
│   │   │   ├── ws-validation.pipe.ts         # WebSocket payload validation pipe
│   │   │   └── __tests__/
│   │   │       └── ws-validation.pipe.spec.ts
│   │   ├── utils/
│   │   │   ├── hash.util.ts               # SHA-256 token hashing utility
│   │   │   ├── pagination.util.ts         # Cursor & limit pagination calculation
│   │   │   ├── ws-validation.util.ts      # WebSocket payload validation helper
│   │   │   └── __tests__/
│   │   │       ├── hash.util.spec.ts
│   │   │       ├── pagination.util.spec.ts
│   │   │       └── ws-validation.util.spec.ts
│   │   ├── exceptions/
│   │   │   ├── app.exception.ts           # AppException, EntityNotFoundException, BusinessRuleException
│   │   │   └── __tests__/
│   │   │       └── app.exception.spec.ts
│   │   └── interfaces/
│   │       ├── pagination.interface.ts
│   │       ├── response.interface.ts
│   │       ├── request-with-workspace-member.interface.ts
│   │       └── ws.interface.ts
│   │
│   ├── health/                               # System health monitoring
│   │   ├── health.module.ts
│   │   ├── health.controller.ts              # @nestjs/terminus health endpoint
│   │   ├── prisma-health.indicator.ts        # PostgreSQL SELECT 1 probe
│   │   ├── redis-health.indicator.ts         # Redis PING probe
│   │   └── __tests__/
│   │       ├── health.controller.spec.ts
│   │       ├── prisma-health.indicator.spec.ts
│   │       └── redis-health.indicator.spec.ts
│   │
│   ├── modules/
│   │   ├── auth/                             # Authentication & User Management
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.constants.ts
│   │   │   ├── controllers/
│   │   │   │   └── auth.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt-token.service.ts
│   │   │   │   ├── password.service.ts
│   │   │   │   └── token-blacklist.service.ts
│   │   │   ├── repositories/
│   │   │   │   ├── user.repository.ts
│   │   │   │   └── refresh-token.repository.ts
│   │   │   ├── strategies/
│   │   │   │   └── google.strategy.ts
│   │   │   ├── tasks/
│   │   │   │   └── token-cleanup.task.ts
│   │   │   ├── events/
│   │   │   │   └── auth.events.ts
│   │   │   ├── interfaces/
│   │   │   │   ├── auth-response.interface.ts
│   │   │   │   └── jwt-payload.interface.ts
│   │   │   ├── dto/
│   │   │   │   ├── index.ts
│   │   │   │   ├── register.dto.ts
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── token-pair.dto.ts
│   │   │   │   ├── change-password.dto.ts
│   │   │   │   ├── forgot-password.dto.ts
│   │   │   │   ├── reset-password.dto.ts
│   │   │   │   ├── update-profile.dto.ts
│   │   │   │   ├── user-response.dto.ts
│   │   │   │   ├── auth-response.dto.ts
│   │   │   │   ├── message-response.dto.ts
│   │   │   │   └── google-auth-url-response.dto.ts
│   │   │   └── __tests__/
│   │   │       ├── controllers/
│   │   │       │   └── auth.controller.spec.ts
│   │   │       ├── services/
│   │   │       │   ├── auth.service.spec.ts
│   │   │       │   ├── jwt-token.service.spec.ts
│   │   │       │   ├── password.service.spec.ts
│   │   │       │   └── token-blacklist.service.spec.ts
│   │   │       ├── repositories/
│   │   │       │   ├── user.repository.spec.ts
│   │   │       │   └── refresh-token.repository.spec.ts
│   │   │       ├── strategies/
│   │   │       │   └── google.strategy.spec.ts
│   │   │       └── tasks/
│   │   │           └── token-cleanup.task.spec.ts
│   │   │
│   │   ├── workspace/                        # Multi-Tenant Workspace & Member Management
│   │   │   ├── workspace.module.ts
│   │   │   ├── controllers/
│   │   │   │   └── workspace.controller.ts
│   │   │   ├── services/
│   │   │   │   └── workspace.service.ts
│   │   │   ├── repositories/
│   │   │   │   ├── workspace.repository.ts
│   │   │   │   ├── workspace-member.repository.ts
│   │   │   │   └── workspace-invitation.repository.ts
│   │   │   ├── guards/
│   │   │   │   ├── workspace-member.guard.ts
│   │   │   │   └── ws-workspace-member.guard.ts
│   │   │   ├── guards/
│   │   │   │   ├── workspace-member.guard.ts
│   │   │   │   └── ws-workspace-member.guard.ts
│   │   │   ├── decorators/
│   │   │   │   └── workspace-auth.decorator.ts
│   │   │   ├── events/
│   │   │   │   └── workspace.events.ts
│   │   │   ├── interfaces/
│   │   │   │   └── workspace.interfaces.ts
│   │   │   ├── dto/
│   │   │   │   ├── index.ts
│   │   │   │   ├── create-workspace.dto.ts
│   │   │   │   ├── update-workspace.dto.ts
│   │   │   │   ├── invite-member.dto.ts
│   │   │   │   ├── accept-invitation.dto.ts
│   │   │   │   ├── update-member-role.dto.ts
│   │   │   │   ├── transfer-ownership.dto.ts
│   │   │   │   ├── workspace-response.dto.ts
│   │   │   │   ├── workspace-member-response.dto.ts
│   │   │   │   └── workspace-invitation-response.dto.ts
│   │   │   └── __tests__/
│   │   │       ├── controllers/
│   │   │       │   └── workspace.controller.spec.ts
│   │   │       ├── services/
│   │   │       │   └── workspace.service.spec.ts
│   │   │       ├── repositories/
│   │   │       │   ├── workspace.repository.spec.ts
│   │   │       │   ├── workspace-member.repository.spec.ts
│   │   │       │   └── workspace-invitation.repository.spec.ts
│   │   │       ├── guards/
│   │   │       │   ├── workspace-member.guard.spec.ts
│   │   │       │   └── ws-workspace-member.guard.spec.ts
│   │   │       └── decorators/
│   │   │           └── workspace-auth.decorator.spec.ts
│   │   │
│   │   ├── board/                            # Kanban Boards, Lists, Cards & Real-Time Sync
│   │   │   ├── board.module.ts
│   │   │   ├── board.constants.ts
│   │   │   ├── controllers/
│   │   │   │   ├── board.controller.ts
│   │   │   │   ├── list.controller.ts
│   │   │   │   ├── card.controller.ts
│   │   │   │   ├── card-attachment.controller.ts
│   │   │   │   └── card-comment.controller.ts
│   │   │   ├── gateways/
│   │   │   │   └── board.gateway.ts
│   │   │   ├── services/
│   │   │   │   ├── board.service.ts
│   │   │   │   ├── list.service.ts
│   │   │   │   ├── card.service.ts
│   │   │   │   ├── card-attachment.service.ts
│   │   │   │   ├── card-comment.service.ts
│   │   │   │   ├── lexorank.service.ts
│   │   │   │   ├── presence.service.ts
│   │   │   │   └── ws-rate-limiter.service.ts
│   │   │   ├── repositories/
│   │   │   │   ├── board.repository.ts
│   │   │   │   ├── list.repository.ts
│   │   │   │   ├── card.repository.ts
│   │   │   │   ├── card-attachment.repository.ts
│   │   │   │   ├── card-comment.repository.ts
│   │   │   │   ├── label.repository.ts
│   │   │   │   └── activity.repository.ts
│   │   │   ├── guards/
│   │   │   │   └── ws-board-access.guard.ts
│   │   │   ├── listeners/
│   │   │   │   └── activity.listener.ts
│   │   │   ├── mappers/
│   │   │   │   └── board.mapper.ts
│   │   │   ├── events/
│   │   │   │   ├── board.events.ts
│   │   │   │   └── board-events.constants.ts
│   │   │   ├── interfaces/
│   │   │   │   ├── board.interfaces.ts
│   │   │   │   └── gateway.interfaces.ts
│   │   │   ├── dto/
│   │   │   │   ├── index.ts
│   │   │   │   ├── ws-messages.dto.ts
│   │   │   │   ├── board/
│   │   │   │   ├── list/
│   │   │   │   ├── card/
│   │   │   │   ├── comment/
│   │   │   │   ├── attachment/
│   │   │   │   ├── label/
│   │   │   │   └── common/
│   │   │   └── __tests__/
│   │   │       ├── controllers/
│   │   │       │   ├── board.controller.spec.ts
│   │   │       │   ├── list.controller.spec.ts
│   │   │       │   ├── card.controller.spec.ts
│   │   │       │   ├── card-attachment.controller.spec.ts
│   │   │       │   └── card-comment.controller.spec.ts
│   │   │       ├── gateways/
│   │   │       │   └── board.gateway.spec.ts
│   │   │       ├── services/
│   │   │       │   ├── board.service.spec.ts
│   │   │       │   ├── list.service.spec.ts
│   │   │       │   ├── card.service.spec.ts
│   │   │       │   ├── card-attachment.service.spec.ts
│   │   │       │   ├── card-comment.service.spec.ts
│   │   │       │   ├── lexorank.service.spec.ts
│   │   │       │   ├── presence.service.spec.ts
│   │   │       │   └── ws-rate-limiter.service.spec.ts
│   │   │       ├── repositories/
│   │   │       │   ├── board.repository.spec.ts
│   │   │       │   ├── list.repository.spec.ts
│   │   │       │   ├── card.repository.spec.ts
│   │   │       │   ├── card-attachment.repository.spec.ts
│   │   │       │   ├── card-comment.repository.spec.ts
│   │   │       │   ├── label.repository.spec.ts
│   │   │       │   └── activity.repository.spec.ts
│   │   │       ├── guards/
│   │   │       │   └── ws-board-access.guard.spec.ts
│   │   │       ├── listeners/
│   │   │       │   └── activity.listener.spec.ts
│   │   │       └── mappers/
│   │   │           └── board.mapper.spec.ts
│   │   │
│   │   ├── activity/                         # Activity Log Module
│   │   │   └── activity.module.ts
│   │   ├── document/                         # Collaborative CRDT Document Module
│   │   │   └── document.module.ts
│   │   ├── notification/                     # Real-time In-App Notification Module
│   │   │   └── notification.module.ts
│   │   └── file/                             # S3 File Attachment Module
│   │       └── file.module.ts
│   │
├── test/
│   ├── app.e2e-spec.ts                       # E2E test entry
│   ├── jest-e2e.json                         # E2E Jest config
│   └── manual/
│       └── test-ws-client.ts                 # Manual WebSocket testing client
│
├── docs/                                     # Architecture & Engineering Specifications
│   ├── 01-architecture-overview.md
│   ├── 02-database-design.md
│   ├── 03-api-design.md
│   ├── 04-websocket-events.md
│   ├── 05-realtime-engine.md
│   ├── 06-auth-and-rbac.md
│   ├── 07-module-specifications.md
│   ├── 08-message-queue-design.md
│   ├── 09-infrastructure-devops.md
│   ├── 10-testing-strategy.md
│   ├── 11-security-checklist.md
│   ├── 12-project-structure.md
│   ├── 13-error-handling-logging.md
│   └── test-cases/                           # Domain test case catalogs & behavioral specifications
│
├── .env.example
├── docker-compose.yml
├── package.json
└── tsconfig.json
```
