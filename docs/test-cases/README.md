# Test Case Catalogs & Verification Specifications

This directory contains the domain-specific test catalogs, functional verification matrices, and edge-case specifications for the SyncBoard platform. These catalogs serve as the blueprint for automated unit tests (`*.spec.ts`), end-to-end integration tests (`test/e2e/`), WebSocket test suites (`test/ws/`), and QA verification passes.

For overall testing methodology, 100% coverage gates, and execution instructions, see [docs/10-testing-strategy.md](file:///m:/Coding/Github/sync-board/docs/10-testing-strategy.md).

---

## Domain Test Catalogs

| Catalog File | Domain Coverage | Target Endpoints & Workflows | Automated Spec References |
|---|---|---|---|
| [**`test-cases-auth.md`**](file:///m:/Coding/Github/sync-board/docs/test-cases/test-cases-auth.md) | Authentication & Sessions | Registration, password login, rotating JWT refresh tokens, Google OAuth 2.0, logout, email verification, password reset | `src/modules/auth/**/__tests__/*.spec.ts`<br>`test/e2e/auth.e2e-spec.ts` |
| [**`test-cases-workspace.md`**](file:///m:/Coding/Github/sync-board/docs/test-cases/test-cases-workspace.md) | Workspace & RBAC | Multi-tenant isolation, 4-tier roles (`owner`, `admin`, `member`, `viewer`), membership management, invitation token flows, ownership transfers | `src/modules/workspace/**/__tests__/*.spec.ts`<br>`test/e2e/workspace.e2e-spec.ts` |
| [**`test-cases-board.md`**](file:///m:/Coding/Github/sync-board/docs/test-cases/test-cases-board.md) | Boards & Kanban Engine | Boards CRUD, LexoRank $O(1)$ drag-and-drop lists/cards, labels, assignees, checklists, threaded comments with `@mentions`, card cover images | `src/modules/board/**/__tests__/*.spec.ts`<br>`test/e2e/board.e2e-spec.ts` |
| [**`test-cases-realtime-ws.md`**](file:///m:/Coding/Github/sync-board/docs/test-cases/test-cases-realtime-ws.md) | Real-Time WebSockets | Socket.IO authentication handshake, workspace/board rooms, dual-key Redis presence, cursor broadcasting, sliding-window rate limiters, auto-reconnection | `src/modules/board/realtime/__tests__/*.spec.ts`<br>`test/ws/board-realtime.ws-spec.ts` |
| [**`test-cases-documents.md`**](file:///m:/Coding/Github/sync-board/docs/test-cases/test-cases-documents.md) | Collaborative Documents & CRDT | Document CRUD, full-text preview search, card-linked docs, Yjs binary CRDT sync vectors, presence awareness cursors, snapshot creation & restoration | `src/modules/document/**/__tests__/*.spec.ts`<br>`test/e2e/documents.e2e-spec.ts`<br>`test/ws/documents-collab.ws-spec.ts` |
| [**`test-cases-notifications.md`**](file:///m:/Coding/Github/sync-board/docs/test-cases/test-cases-notifications.md) | Notifications & Async Queue | Domain event producers, RabbitMQ message dispatch, idempotent consumers, dead-letter exchange (DLX) retries, unread count caching, WS push | `src/modules/notification/**/__tests__/*.spec.ts`<br>`test/e2e/notifications.e2e-spec.ts` |
| [**`test-cases-activity.md`**](file:///m:/Coding/Github/sync-board/docs/test-cases/test-cases-activity.md) | Activity Feed & Partitioned Audit | High-volume domain event recording, cursor-paginated feeds (workspace & board level), filtering by entity/actor, PostgreSQL monthly range partitioning | `src/modules/activity/**/__tests__/*.spec.ts`<br>`test/e2e/board.e2e-spec.ts` |
| [**`test-cases-files.md`**](file:///m:/Coding/Github/sync-board/docs/test-cases/test-cases-files.md) | S3 Object Storage & Files | 2-phase presigned upload (`pending` $\to$ client PUT $\to$ `/confirm` $\to$ `completed`), MIME validation, 25MB file size caps, presigned download URLs | `src/modules/file/**/__tests__/*.spec.ts`<br>`test/e2e/files.e2e-spec.ts` |


---

## Conventions & Verification Rules

1. **Deterministic Edge Case Coverage**: Every endpoint must be validated against boundary values, invalid payloads, missing headers, authorization thresholds, and simulated infrastructure failures (Prisma exceptions, Redis timeouts, S3 errors).
2. **Stable Section Identifiers**: Catalog section identifiers (e.g., `§1.1.1`) correspond directly to automated test suites and can be referenced in spec file docstrings.
3. **Multi-Tenant Isolation**: Every data query and mutation must assert that entities cannot be accessed or altered across foreign workspace boundaries.
4. **Error Envelope Verification**: All negative scenarios assert exact error codes conforming to the unified error response format defined in [docs/13-error-handling-logging.md](file:///m:/Coding/Github/sync-board/docs/13-error-handling-logging.md).
