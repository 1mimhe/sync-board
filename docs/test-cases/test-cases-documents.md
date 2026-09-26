# Documents & CRDT — Test Cases

> **Base URL:** `http://localhost:3000/api`
> **Module:** `src/modules/document`
> **Controllers:**
> - `DocumentController` — `/workspaces/:workspaceId/documents` (create, list/search, get, rename, archive)
> - `CardDocumentsController` — `/workspaces/:workspaceId/cards/:cardId/documents` (list by card, unpaginated)
> - `BoardDocumentsController` — `/workspaces/:workspaceId/boards/:boardId/documents` (list docs attached to board cards)
> - `DocumentSnapshotController` — `/workspaces/:workspaceId/documents/:documentId/snapshots` (create, list, restore)
>
> **Realtime:** `DocumentGateway` — `doc:join` / `doc:update` / `doc:awareness` / `doc:leave` (`DOC_WS` @ `src/modules/document/realtime/doc-ws-events.constants.ts`).
>
> **Automated Specs:** `test/e2e/documents.e2e-spec.ts` (CRUD, listing, search, snapshots, RBAC, validation) and `test/ws/documents-collab.ws-spec.ts` (join, relay, presence, saved).
> **Setup:** Alice (Owner), Bob (Admin), Carol (Member), Dave (Viewer), Eve (Outsider) in workspace W; Card C1 for linked docs.

---

## Table of Contents

1. [Create Document (`DocumentController`)](#1-create-document)
2. [Get & Rename & Archive (`DocumentController`)](#2-get--rename--archive)
3. [Listing — Cursor Pagination (`DocumentController`)](#3-listing--cursor-pagination)
4. [Search — Full-text over preview (`DocumentController`)](#4-search--full-text-over-preview)
5. [Card-linked Listing (`CardDocumentsController`)](#5-card-linked-listing)
6. [Snapshots (`DocumentSnapshotController`)](#6-snapshots)
7. [Persistence & Lifecycle Edge](#7-persistence--lifecycle-edge)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [Combined & End-to-End Scenarios](#9-combined--end-to-end-scenarios)

---

## 1. Create Document

### 1.1 `POST /workspaces/:workspaceId/documents`

**Guards:** `WorkspaceAuth('owner','admin','member')` (`DocumentController:52`)
**DTO:** `CreateDocumentDto` — `title` (string, 0–500, optional; defaults to `"Untitled"` when omitted), `parentCardId` (UUID v4, optional, must be active card in same workspace via `DocumentRepository.cardExistsInWorkspace`)

#### 1.1.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|--------------|-----------------|-------------------|
| 1 | Create standalone with title | `{ "title": "Sprint retro notes" }` | `201` | `DocumentResponseDto { id, workspaceId: W, title, parentCardId: null, createdBy: Alice, status: "active", createdAt, updatedAt }`; `yjsState` absent (mapper); event `document.created` emitted with `boardId: null` |
| 2 | Create with title 1 char | `{ "title": "X" }` | `201` | Created |
| 3 | Create with title 500 chars | `{ "title": "<500 chars>" }` | `201` | Created at max boundary |
| 4 | Omit title → defaults | `{}` | `201` | `title === "Untitled"` |
| 5 | Undefined vs empty string | `{ "title": "" }` vs omitted | `201` / `201` | `""` stored as empty string (DTO `@Length(0,500)` allows empty; default only on omission) — divergent from board `1..200` |
| 6 | Create card-linked | `{ "title": "Card Linked", "parentCardId": "C1" }` | `201` | `parentCardId === C1`; event `boardId` resolved via `findBoardIdByCard` |
| 7 | Card-linked + omitted title | `{ "parentCardId": "C1" }` | `201` | `title "Untitled"` + linked |

#### 1.1.2 Validation Errors (400 `VALIDATION_ERROR`)

| # | Test Case | Request Body | Expected Status | Expected Error |
|---|-----------|--------------|-----------------|----------------|
| 1 | Title > 500 chars | `{ "title": "<501 chars>" }` | `400` | `title must be shorter than or equal to 500 characters` |
| 2 | Title non-string | `{ "title": 42 }` | `400` | `title must be a string` |
| 3 | parentCardId non-UUID | `{ "parentCardId": "not-uuid" }` | `400` | `parentCardId must be a UUID` |
| 4 | parentCardId wrong UUID version | `{ "parentCardId": "00000000-0000-1000-8000-000000000000" }` v1 | `400` | UUID v4 constraint |
| 5 | Extra whitelisted field | `{ "title": "x", "hack": 1 }` | `400` | `forbidNonWhitelisted` → property `hack` should not exist |
| 6 | WorkspaceId param non-UUID | `POST /workspaces/not-uuid/documents` | `400` | `ParseUUIDPipe` failure |
| 7 | Description analogue | N/A | — | No extra fields; DTO has only 2 props |

#### 1.1.3 Authorization & Entity Errors

| # | Test Case | Expected Status | Expected Error |
|---|-----------|-----------------|----------------|
| 1 | No Authorization header | `401` | `TOKEN_INVALID` |
| 2 | Invalid JWT | `401` | `TOKEN_INVALID` |
| 3 | Non-member Eve | `403` | `FORBIDDEN` (`WorkspaceMemberGuard`) |
| 4 | Viewer Dave canNOT create | `403` | `FORBIDDEN` (requires member weight ≥10; viewer=0) |
| 5 | Member Carol CAN create | `201` | Allowed — state probe GET shows doc |
| 6 | Admin Bob CAN create | `201` | Allowed |
| 7 | parentCardId non-existent | `404` | `CARD_NOT_FOUND` (`verifyCardInWorkspace`) |
| 8 | parentCardId archived card | `404` | `CARD_NOT_FOUND` (query filters `archivedAt: null`) |
| 9 | parentCardId in WS2 foreign workspace | `404` | `CARD_NOT_FOUND` (card ∉ W; cross-workspace leak probe) |
| 10 | parentCardId from different workspace but workspaceId param matches foreign doc guard | `404` | Scoped via card → board → workspace chain (`repositories/document.repository.ts:121`) |

---

## 2. Get & Rename & Archive

### 2.1 Get Document — `GET /workspaces/:workspaceId/documents/:documentId`

**Guards:** `WorkspaceAuth('owner','admin','member','viewer')` (`DocumentController:113`)

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Get active doc (owner) | `200` | `DocumentResponseDto`; no `yjsState` / `previewText` |
| 2 | Viewer Dave can read | `200` | Read allowed |
| 3 | Non-existent UUID | `404` | `DOCUMENT_NOT_FOUND` |
| 4 | Archived doc GET | `404` | `DOCUMENT_NOT_FOUND` (`findActiveById` filters `status active`) |
| 5 | Invalid documentId format | `400` | `ParseUUIDPipe` |
| 6 | Workspace mismatch — doc from WS2 fetched via W URL | `200` currently (controller ignores `workspaceId` param after guard; `services/document.service.ts:83` `findById` not scoped). **Catalog notes actual: should be 404 when scoped fix lands.** E2E must probe this as IDOR check |
| 7 | Outsiders Eve → 403 | `403` | `FORBIDDEN` (member guard on workspace) |

### 2.2 Rename — `PATCH /workspaces/:workspaceId/documents/:documentId`

**Guards:** `WorkspaceAuth('owner','admin','member')` (`DocumentController:142`)
**DTO:** `RenameDocumentDto` — `title` (string, 1–500, required, `@Length(1,500)`)

#### 2.2.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|--------------|-----------------|-------------------|
| 1 | Rename title | `{ "title": "Renamed" }` | `200` | `DocumentResponseDto` with new title; `updatedAt` bumped; event `document.renamed` (`DOCUMENT_EVENTS.renamed`) |
| 2 | Title trimmed? | `{ "title": "  padded  " }` | `200` | Stored verbatim (no trim transform on DTO unlike board) — document actual |
| 3 | State verification | after rename, `GET :id` | `200` | Persisted title matches |

#### 2.2.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status | Expected Error |
|---|-----------|--------------|-----------------|----------------|
| 1 | Empty body | `{}` | `400` | `title should not be empty` |
| 2 | Empty string title | `{ "title": "" }` | `400` | `Length 1..500` violation |
| 3 | Title >500 chars | `{ "title": "<501>" }` | `400` | maxLength |
| 4 | Title non-string | `{ "title": 123 }` | `400` | `title must be a string` |
| 5 | Extra field | `{ "title": "x", "extra": 1 }` | `400` | forbidNonWhitelisted |

#### 2.2.3 Authorization & Edge

| # | Test Case | Expected Status | Expected Error |
|---|-----------|-----------------|----------------|
| 1 | Viewer Dave rename | `403` | `FORBIDDEN` |
| 2 | Outsider | `403` | `FORBIDDEN` |
| 3 | Non-existent id | `404` | `DOCUMENT_NOT_FOUND` |
| 4 | Rename archived doc | `404` | `DOCUMENT_NOT_FOUND` (`findById` pre-check) |
| 5 | Invalid docId format | `400` | ParseUUIDPipe |

### 2.3 Archive — `DELETE /workspaces/:workspaceId/documents/:documentId`

**Guards:** `WorkspaceAuth('owner','admin','member')` (`DocumentController:178`) — weaker than board archive (board requires owner/admin only)

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Archive active doc (member) | `204` | No content; `status → archived`; event `document.archived`; activity row `entityType=document action=archived` |
| 2 | Owner can archive | `204` | Allowed |
| 3 | Viewer cannot archive | `403` | `FORBIDDEN` |
| 4 | Outsider cannot archive | `403` | `FORBIDDEN` |
| 5 | Non-existent id | `404` | `DOCUMENT_NOT_FOUND` |
| 6 | Archive already-archived | `404` | `DOCUMENT_NOT_FOUND` (second DELETE maps to missing active) |
| 7 | GET after archive → 404 | `404` | `DOCUMENT_NOT_FOUND` |
| 8 | Patch rename after archive → 404 | `404` | `DOCUMENT_NOT_FOUND` |
| 9 | Archived excluded from lists/search | `200` list without it | Not in `findPage` / `searchPage` (`status active` filter) |

---

## 3. Listing — Cursor Pagination

### `GET /workspaces/:workspaceId/documents` (no `search` param)

**Guards:** `WorkspaceAuth('owner','admin','member','viewer')` (`DocumentController:81`)
**Query:** `SearchDocumentsDto extends CursorPaginationQueryDto` (`dto/search-documents.dto.ts:6`) — `cursor` (optional UUID v4), `limit` (optional int 1–50, default 20 @ `services/document.service.ts:103`), `search` omitted.

**Implementation:** `DocumentService.listInWorkspace` → `DocumentRepository.findPage` (`repositories/document.repository.ts:60`) — `orderBy updatedAt desc, id desc`, `take limit+1`, `cursor {id} skip 1` branch; `buildCursorPagination` slices (`common/utils/pagination.util.ts`).

| # | Test Case | Query Params | Expected Status | Expected Response |
|---|-----------|--------------|-----------------|-------------------|
| 1 | Default pagination (no params) | — | `200` | `{ items: DocumentResponseDto[], pagination: { cursor: string|null, hasMore: boolean } }`; `items.length ≤ 20`; envelope `success:true` |
| 2 | Cursor walk full | seed 25 docs → `?limit=20` then `?limit=20&cursor=<p1.cursor>` | `200` each | p1 `hasMore true`, `cursor` = last id, 20 items; p2 remaining ≥5, `hasMore false`, no dupes across pages; items ordered `updatedAt desc, id desc` |
| 3 | Limit boundaries | `?limit=1` / `?limit=50` | `200` | Respects limit; 50 is max |
| 4 | Limit overflow 51 | `?limit=51` | `400` | `VALIDATION_ERROR` — `limit must not be greater than 50` |
| 5 | Limit 0 | `?limit=0` | `400` | `Min 1` |
| 6 | Limit non-int / NaN | `?limit=abc` | `400` | validation error |
| 7 | Unknown cursor tolerance (valid UUID not in page) | `?cursor=<valid-but-unknown uuid>` | **Documented actual: `500` Prisma P2025** (no catch in `findPage:68` `cursor:{id}`). When fix lands, should be first-page fallback or `CURSOR_NOT_FOUND`. E2E must assert actual code and link issue | `500` (current) / `200` first-page when patched |
| 8 | Garbage cursor format | `?cursor=not-uuid` | `400` | `VALIDATION_ERROR` — `cursor must be a UUID` (`IsUUID 4`) |
| 9 | Empty workspace | workspace with 0 docs | `200` | `{ items: [], pagination: { cursor: null, hasMore: false } }` |
| 10 | Archived docs excluded | archive one doc then list | `200` | Archived id absent |
| 11 | Foreign workspace isolation | W2 docs never leak into W listing | `200` | Scoped by `where workspaceId` |
| 12 | Response hygiene | any list response | `200` | No item has `yjsState` nor `previewText`; only `DocumentResponseDto` fields |
| 13 | Extra query param rejected | `?foo=bar` | `400` | `forbidNonWhitelisted` |

---

## 4. Search — Full-text over preview

**Path:** same `GET /workspaces/:workspaceId/documents?search=&cursor=&limit=`; **branch** `if (search.trim()) rows=searchPage` else `findPage` (`services/document.service.ts:107`). **Search index:** `DocumentRepository.searchPage` raw SQL `to_tsvector('english', COALESCE(preview_text,'')) @@ plainto_tsquery('english', term)` (`repositories/document.repository.ts:88`), ordered `updatedAt desc, id desc`, `LIMIT limit+1`. `preview_text` populated only after debounced `DocumentManagerService.persistNow` (`services/document-manager.service.ts:195` `SAVE_DEBOUNCE_MS 5000`, slice `PREVIEW_MAX_LENGTH 20000` @ `constants/document.constants.ts:10`).

### 4.1 Happy Path

| # | Test Case | Steps | Expected Status | Expected Response |
|---|-----------|-------|-----------------|-------------------|
| 1 | Search hits preview after save | join doc via WS (`DOC_WS.JOIN`), `doc:update` with text containing unique token `alphahedgehog`, await `doc:saved` (≤15s), then `GET ?search=alphahedgehog` | `200` | Doc appears in `items`; other unrelated term absent |
| 2 | Search empty before debounce | `doc:update` without waiting for `doc:saved` then immediate GET | `200` | Empty (preview not yet flushed) — hand-wavy negative case clarifies debounce window |
| 3 | Whitespace-only search trim | `GET ?search=   ` | `200` | Falls through to `findPage` branch (treated as empty) |
| 4 | Case / stemming insensitive | search `Authentication` finds preview `authenticating` | `200` | Hit (english `to_tsvector`) |

### 4.2 Isolation & Hygiene

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Archived doc never returned by search | `200` | Archived id absent even when term matches |
| 2 | Foreign workspace doc never returned | `200` | W2 doc with same token absent from W search |
| 3 | Title-only not indexed | doc title `UniqueTitleWord`, empty preview → `GET ?search=UniqueTitleWord` | `200` | No hit (title not in `preview_text` vector) |
| 4 | Cursor with search — **known limitation**: `searchPage` ignores `cursor` param (no SQL filter) → `?search=foo&cursor=...` returns duplicated first page. **E2E must assert actual dupes** and link fix issue. When cursor support lands, paginate correctly |
| 5 | Response hygiene for search | `200` | Same as listing: no `yjsState` / `previewText` |

### 4.3 Validation

| # | Test Case | Query Params | Expected Status | Expected Error |
|---|-----------|--------------|-----------------|----------------|
| 1 | Search >200 chars | `?search=<201 chars>` | `400` | `VALIDATION_ERROR` `@Length(0,200)` |
| 2 | Cursor+search garbage | `?search=foo&cursor=bad` | `400` | `cursor must be a UUID` |
| 3 | Limit 51 with search | `?search=foo&limit=51` | `400` | `limit must not be greater than 50` |

---

## 5. Card-linked Listing

### `GET /workspaces/:workspaceId/cards/:cardId/documents`

**Controller:** `CardDocumentsController` (`card-documents.controller.ts:18`) — unpaginated, newest activity first.
**Guards:** `WorkspaceAuth('owner','admin','member','viewer')` (`:26`)
**Service:** `DocumentService.listByCard` verifies `cardExistsInWorkspace` else `CARD_NOT_FOUND`.

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | List docs of card C1 (happy) | `200` | `DocumentResponseDto[]` only those with `parentCardId === C1`, ordered `updatedAt desc` |
| 2 | Empty card (no linked docs) | `200` | `[]` |
| 3 | Non-existent cardId | `404` | `CARD_NOT_FOUND` |
| 4 | Archived card's docs | `404` | `CARD_NOT_FOUND` (card filter `archivedAt:null` blocks) — linked docs not reachable via dead card |
| 5 | Foreign-workspace card C in WS2 fetched via W URL | `404` | `CARD_NOT_FOUND` (scoping via `card → list → board → workspace` chain) |
| 6 | Viewer can read card docs | `200` | Allowed |
| 7 | Outsider / non-member | `403` | `FORBIDDEN` (workspace member guard on `:workspaceId`) |
| 8 | Response hygiene | `200` | No `yjsState` / `previewText` |

---

### 5.2 `GET /workspaces/:workspaceId/boards/:boardId/documents`

**Controller:** `BoardDocumentsController` (`board-documents.controller.ts:18`) — lists all active documents attached to any card on the board, newest activity first, with `parentCard: { id, title }`.
**Guards:** `WorkspaceAuth('owner','admin','member','viewer')` (`:24`)
**Service:** `DocumentService.listByBoard` queries active documents whose `parentCard.list.boardId === boardId`.

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | List board docs (happy) | `200` | `DocumentResponseDto[]` with `parentCardId` and `parentCard: { id, title }` |
| 2 | Empty board (no linked docs on cards) | `200` | `[]` |
| 3 | Archived cards/lists excluded | `200` | Documents from archived cards or lists are filtered out |
| 4 | Viewer can read board docs | `200` | Allowed |
| 5 | Outsider / non-member | `403` | `FORBIDDEN` (workspace member guard on `:workspaceId`) |
| 6 | Response hygiene | `200` | No `yjsState` / `previewText` |

---

## 6. Snapshots

### 6.1 Create — `POST /workspaces/:workspaceId/documents/:documentId/snapshots`

**Guards:** `WorkspaceAuth('owner','admin','member')` (`DocumentSnapshotController:44`)
**DTO:** `CreateSnapshotDto` — `name` (string, 0–200, optional; stored as `snapshotName` null when omitted) (`dto/create-snapshot.dto.ts:11`)
**Logic:** `SnapshotService.create` — verify `findActiveById` else 404, `manager.getOrLoad` then `isEmpty` check → `DOCUMENT_EMPTY 422` else capture `getStateBytes` and `createSnapshot` emitting `document.snapshot_created`.

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|--------------|-----------------|-------------------|
| 1 | Create snapshot (doc has content) | `{ "name": "Before big rewrite" }` after WS edit + `doc:saved` | `201` | `SnapshotResponseDto { id, documentId, snapshotName, createdBy, createdAt }`; bytes = current merged state (metadata only HTTP but verified via later restore parity) |
| 2 | Create with omitted name | `{}` | `201` | `snapshotName: null` |
| 3 | Create with empty string name | `{ "name": "" }` | `201` | `snapshotName: ""` (Length 0 allowed) — document actual |
| 4 | Empty doc → BusinessRule | `{ "name": "v1" }` on fresh doc with no content | `422` | `DOCUMENT_EMPTY` — `Nothing to snapshot yet` |
| 5 | Transition: after typing + `doc:saved`, retry same doc → 201 | — | `201` | Empty guard lifted after content present |
| 6 | Successive snapshots order | create 2 snapshots sequentially | `201` each | Second has later `createdAt` |
| 7 | Archived document → 404 | `POST .../archivedId/snapshots` | `404` | `DOCUMENT_NOT_FOUND` (`findActiveById`) |
| 8 | Non-existent documentId | `POST .../0000.../snapshots` | `404` | `DOCUMENT_NOT_FOUND` |
| 9 | Invalid documentId format | `POST .../not-uuid/snapshots` | `400` | ParseUUIDPipe |

#### Validation (400)

| # | Test Case | Request Body | Expected Status | Expected Error |
|---|-----------|--------------|-----------------|----------------|
| 1 | Name >200 chars | `{ "name": "<201>" }` | `400` | `name must be shorter than or equal to 200 characters` |
| 2 | Name non-string | `{ "name": 42 }` | `400` | `name must be a string` |
| 3 | Extra field | `{ "name": "x", "hack": 1 }` | `400` | forbidNonWhitelisted |

#### Authorization

| # | Test Case | Expected Status | Expected Error |
|---|-----------|-----------------|----------------|
| 1 | Viewer create snapshot | `403` | `FORBIDDEN` |
| 2 | Member CAN create (unlike restore) | `201` | Member allowed — divergence from restore strictness |
| 3 | Outsider | `403` | `FORBIDDEN` |
| 4 | No token | `401` | `TOKEN_INVALID` |

### 6.2 List — `GET /workspaces/:workspaceId/documents/:documentId/snapshots`

**Guards:** `WorkspaceAuth('owner','admin','member','viewer')` (`DocumentSnapshotController:80`)
**Logic:** `findSnapshots` ordered `createdAt desc`; metadata only (no `yjsState`).

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | List after 2 creates | `200` | `SnapshotResponseDto[]` length 2, newest first (first element `createdAt` ≥ second) |
| 2 | Empty history (no snapshots) | `200` | `[]` |
| 3 | Metadata only | `200` | No item has `yjsState` |
| 4 | History count matches creates | `200` | Length equals creations |
| 5 | Archived doc list — actual | `200` | Currently lists snapshots even if doc archived (no active check in `SnapshotService.list`). **E2E asserts actual: 200 with items; links issue for hardening** |
| 6 | Viewer can list | `200` | Allowed |
| 7 | Outsider | `403` | `FORBIDDEN` |
| 8 | Non-existent documentId still lists? | `200` | Empty (no check) — document actual; could be 404 when scoped |

### 6.3 Restore — `POST /workspaces/:workspaceId/documents/:documentId/snapshots/:snapshotId/restore`

**Guards:** `WorkspaceAuth('owner','admin')` (`DocumentSnapshotController:109`) — stricter than create (member excluded)
**Logic:** `SnapshotService.restore` — `findSnapshotById(snapshotId, documentId)` scoped else `DocumentSnapshot_NOT_FOUND 404`; `manager.replaceState(bytes)` immediate `persistNow` (`services/document-manager.service.ts:146`); returns fresh `findActiveById`.

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Owner restore | `200` | `DocumentResponseDto` (active doc); manager state replaced (`getStateBytes` equals snapshot bytes); `GET :documentId` reflects restored state via preview after next `doc:saved`? E2E state probe |
| 2 | Admin restore | `200` | Allowed |
| 3 | Member restore | `403` | `FORBIDDEN` |
| 4 | Viewer restore | `403` | `FORBIDDEN` |
| 5 | Outsider restore | `403` | `FORBIDDEN` |
| 6 | Non-existent snapshotId | `404` | `DocumentSnapshot_NOT_FOUND` |
| 7 | Snapshot from other document | `404` | `DocumentSnapshot_NOT_FOUND` (scoped query `documentId`) |
| 8 | Invalid snapshotId format | `400` | ParseUUIDPipe |
| 9 | Restore after doc archived → actual | `404` or crash | Currently `findActiveById` returns null then cast `as Document` — E2E must assert actual `404` or document actual error; links hardening issue |
| 10 | Peers receive fresh state (WS) | WS doc room 2 peers joined → REST restore → both peers receive converged state via next `doc:update` diff or immediate `doc:saved` room frame | WS combined row (`test-cases-realtime-ws.md §4.11`) |
| 11 | Response hygiene after restore | `200` | No `yjsState` / `previewText` |

### 6.4 Snapshot Isolation & Cascade

| # | Case | Expected |
|---|------|----------|
| 6.4.1 | Cascade on hard delete | `DocumentSnapshot` FK `onDelete:Cascade` (`schema.prisma:407`); after `DELETE FROM documents`, snapshots vanish. **Soft archive (`status archived`) keeps snapshots** — archive ≠ purge. `Snapshot isolation` row clarifies: verify after hard purge runbook, not after `DELETE :id` archive |
| 6.4.2 | List after archive | As 6.2.5 — snapshots persist; `GET :id` archived → 404 but snapshot history still `200` (actual) |

---

## 7. Persistence & Lifecycle Edge

> Automated test coverage: Unit tests in `src/modules/document/__tests__/services/document-manager.service.spec.ts` (using Jest fake timers), WebSocket integration via `doc:saved` event probes, and runtime lifecycle assertions.

| # | Type | Case | Steps / Assertion | Expected |
|---|------|------|-------------------|----------|
| 7.1 | Unit+WS | Debounce save | WS edits → `update` dirty → single `saveState` within ~5s window (`SAVE_DEBOUNCE_MS 5000` @ `constants/document.constants.ts:6`) via `jest.useFakeTimers` unit; E2E: edits → `doc:saved { savedAt }` within ≤15s to all peers in room; `updatedAt` bump visible via `GET :id` after save | One row change; exactly one `DOCUMENT_EVENTS.saved` → `DOC_WS.SAVED` (`realtime/document.gateway.ts:242`) per burst |
| 7.2 | Unit | Failed save retry | stub `documentRepository.saveState` throw → `persistNow` logs error, `isDirty` stays true (`services/document-manager.service.ts:178`), next schedule retries | Saved eventually; no data loss beyond retry cycle |
| 7.3 | Unit | Idle unload | `connections.size === 0 && lastActivity < now - IDLE_UNLOAD_MS 5min` (`65`); `@Cron(EVERY_MINUTE)` `unloadIdle:225` persists dirty first then `ydoc.destroy()` + delete map entry | Memory freed; next `getOrLoad` rehydrates from DB |
| 7.4 | Unit+Manual | Graceful shutdown | `onModuleDestroy:247` flushes every dirty doc before `docs.clear()` | Sigterm bounded loss → only unpersisted window (<5s) |
| 7.5 | Unit | Load-once hydration | concurrent `Promise.all([getOrLoad, getOrLoad])` reuses same `Y.Doc`; `findWithState` called ≤1 time; persisted `yjsState` applied once via `Y.applyUpdate` (`services/document-manager.service.ts:46`) | No double-apply corruption |
| 7.6 | Unit+Integration | previewText truncation | `extractPlainText(...).slice(0, PREVIEW_MAX_LENGTH 20000)` (`215`); insert >20k chars → `saveState preview.length === 20000` without error; search finds word at pos 19_999, misses word at 20_001 | Caps loss; search bounded to preview |
| 7.7 | Integration | Activity feed rows | `create` / `archive` emit `document.created` / `document.archived` handled by `ActivityModule` → `activity_events entityType=document` (`07-module-specifications.md §4`, `DocumentActivityListener`). `GET /workspaces/:workspaceId/boards/:boardId/activities` or workspace feed contains rows; rename does NOT log (intentional). Board-scoped feed uses `boardId` nullable — create with `boardId` appears in board+workspace feeds, archive hardcodes `boardId null` so only workspace feed | Audit rows present; payload `entityId=documentId`, `entityTitle=title` |

---

## 8. Cross-Cutting Concerns

### 8.1 Response Envelope

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | All success responses wrapped | `{ success:true, data: T, meta: { timestamp: ISO, requestId: string } }` (`common/interceptors/response.interceptor.ts`) — pagination shape `{ items, pagination:{cursor, hasMore}}` (no `total`) |
| 2 | All error responses wrapped | `{ success:false, error:{ code, message, statusCode, details, timestamp, requestId } }` (`common/filters/all-exceptions.filter.ts`) |
| 3 | Error `code` exact | `CARD_NOT_FOUND`, `DOCUMENT_NOT_FOUND`, `DOCUMENT_EMPTY`, `DocumentSnapshot_NOT_FOUND`, `VALIDATION_ERROR`, `FORBIDDEN`, `TOKEN_INVALID` (enum from `docs/13-error-handling-logging.md`) |
| 4 | RequestId unique per request | Header `X-Request-Id` echoed |

### 8.2 Authentication & Authorization

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | Missing `Authorization` | `401 TOKEN_INVALID` on all doc endpoints |
| 2 | Expired / malformed JWT | `401 TOKEN_INVALID` |
| 3 | Blacklisted JWT (post-logout) | `401 TOKEN_REVOKED` |
| 4 | Invalid UUID path params (`workspaceId`, `documentId`, `snapshotId`, `cardId`) | `400` `ParseUUIDPipe` |
| 5 | Email not verified guard | `403` / `401` per `EmailVerifiedGuard` (verified via `createVerifiedUser` helper) |

### 8.3 RBAC Matrix

> Weights `owner=100 > admin=50 > member=10 > viewer=0` (`common/guards/rbac.guard.ts`). Document archive deliberately allows member (unlike board archive owner/admin only) — divergence noted.

| Action | Owner | Admin | Member | Viewer | Outsider |
|--------|------:|------:|-------:|-------:|---------:|
| `POST /documents` (create) | ✅ | ✅ | ✅ | ❌ 403 | ❌ 403 |
| `GET /documents` (list) | ✅ | ✅ | ✅ | ✅ | ❌ 403 |
| `GET /documents?search` | ✅ | ✅ | ✅ | ✅ | ❌ 403 |
| `GET /documents/:id` | ✅ | ✅ | ✅ | ✅ | ❌ 403 |
| `PATCH /documents/:id` (rename) | ✅ | ✅ | ✅ | ❌ 403 | ❌ 403 |
| `DELETE /documents/:id` (archive) | ✅ | ✅ | ✅ | ❌ 403 | ❌ 403 |
| `GET /cards/:cardId/documents` | ✅ | ✅ | ✅ | ✅ | ❌ 403 |
| `POST …/snapshots` (create) | ✅ | ✅ | ✅ | ❌ 403 | ❌ 403 |
| `GET …/snapshots` (list) | ✅ | ✅ | ✅ | ✅ | ❌ 403 |
| `POST …/snapshots/:id/restore` | ✅ | ✅ | ❌ 403 | ❌ 403 | ❌ 403 |

Boundary probe: lowest allowed role ✅ / one step lower ❌ per endpoint — drives `it.each` RBAC sweeps per `e2e-test-generation.md:118`.

### 8.4 Data Integrity & Edge Cases

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | Archive hides from list+search | `archivedAt` via `status archived`; `findPage`/`searchPage` filter excludes |
| 2 | Archive does NOT hard-delete snapshots | `DocumentSnapshot` persists until hard purge (cascade only on `DELETE FROM documents`) |
| 3 | Snapshot restore is immediate persist | `replaceState` → `persistNow` (`services/document-manager.service.ts:146`) |
| 4 | Fresh doc never appears in search | `preview_text` is null/empty until `doc:saved` |
| 5 | Search title-only not found | FTS only over `preview_text`, not indexed title |
| 6 | Pagination stable under writes | Cursor `updatedAt desc, id desc` ordering; no dupes/misses per walk (documented for non-search) |
| 7 | Workspace isolation | No listing/search/cardDocs/snapshot leak across workspaces; IDOR probe §2.1.6 asserts actual |

---

## 9. Combined & End-to-End Scenarios

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 9.1 | Golden journey | Alice create W → add Bob member → Alice create board/list/card C1 → Carol create standalone doc + card-linked doc on C1 → Carol WS `doc:join` → `doc:update "hello"` → await `doc:saved` → `GET ?search=hello` hit → snapshot `name:"checkpoint"` → continue WS typing → owner restore → WS peers converge on restored state → archive doc → listing/search/cardDocs exclude → snapshot list still shows history | Every REST step's state probe (`GET :id` / list) equals client state; `doc:saved` fires once per debounce burst; restore state wins |
| 9.2 | Offline merge + restore storm | Two WS clients A/B joined; A types lorem ×100, B concurrently restores snapshot mid-edit | Restore state wins initially; subsequent `doc:update` frames apply atop restored doc without corruption (CRDT guarantee); no `error` frames beyond rate limits |
| 9.3 | Cross-workspace isolation sweep | WS2 token hits all W-resource routes (list/search/get/cardDocs/snapshots/restore) | Uniform 403/404, never data leak; same for WS `doc:join` with mismatched `workspaceId` → `DOCUMENT_ACCESS_DENIED` / `DOCUMENT_NOT_FOUND` |
| 9.4 | Response envelope integrity under cursor+search | Walk paginated list while new doc inserted | No dupes on pure cursor walk; search+cursor dupes documented as known limitation |
| 9.5 | Sanitization/encoding round-trip | Doc title with emoji / `><script>` + snapshot name emoji | Stored and rendered faithfully; emoji preserved |
| 9.6 | preview truncation stress | Insert 20_001 char payload via Yjs, save, search boundary words | `previewText` length 20_000; boundary hit/miss as §7.6 |

