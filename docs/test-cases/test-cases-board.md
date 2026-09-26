# Board Module — Manual Test Cases

> **Base URL:** `http://localhost:3000/api`
> **Module:** `src/modules/board`
> **Controllers (verified against `src/modules/board/*/controllers/`):**
> - `BoardController` — `/workspaces/:workspaceId/boards` (CRUD, star, unarchive, activities)
> - `ListController` — `/workspaces/:workspaceId/boards/:boardId/lists` (CRUD, move, unarchive)
> - `CardController` — `/workspaces/:workspaceId/boards/:boardId` (cards CRUD, move, unarchive, assignees, labels)
> - `CardAttachmentController` — `…/cards/:cardId/attachments` (REST link/file metadata and attachment management)
> - `CardCommentController` — `…/cards/:cardId/comments` (cursor pagination)
> - `LabelController` — `/workspaces/:workspaceId/boards/:boardId` (labels CRUD)
> - `ChecklistController` — `…/cards/:cardId/checklists` (CRUD + items)

> **Automated E2E Test Suite:** `test/e2e/board.e2e-spec.ts` (boards, lists, cards, labels, checklists, comments, attachments, star, activities, RBAC, and validation sweeps).

---

## Table of Contents

1. [Board CRUD (`BoardController`)](#1-board-crud)
2. [Board Labels (`BoardController`)](#2-board-labels)
3. [Board Starring (`BoardController`)](#3-board-starring)
4. [Board Activities (`BoardController`)](#4-board-activities)
5. [Lists (`ListController`)](#5-lists)
6. [Cards (`CardController`)](#6-cards)
7. [Card Assignees (`CardController`)](#7-card-assignees)
8. [Card Labels (`CardController`)](#8-card-labels)
9. [Card Attachments (`CardAttachmentController`)](#9-card-attachments)
10. [Card Comments (`CardCommentController`)](#10-card-comments)
11. [Cross-Cutting Concerns](#11-cross-cutting-concerns)
12. [Card Checklists (ChecklistController)](#12-card-checklists)

---

## 1. Board CRUD

### 1.1 Create Board — `POST /workspaces/:workspaceId/boards`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `CreateBoardDto` — `title` (string, 1–200, trimmed, required), `description` (string, ≤1000, optional), `backgroundColor` (hex `#RRGGBB`, optional, regex `/^#[0-9A-Fa-f]{6}$/`)

#### 1.1.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Create board with title only | `{ "title": "Sprint Planning" }` | `201` | Returns `{ id, workspaceId, title, description: null, backgroundColor: null, createdBy, createdAt, updatedAt, archivedAt: null }` |
| 2 | Create board with all fields | `{ "title": "Q4 Board", "description": "Quarterly roadmap", "backgroundColor": "#1A1A2E" }` | `201` | All fields populated as sent |
| 3 | Title is trimmed | `{ "title": "  Sprint  " }` | `201` | `title` stored as `"Sprint"` |
| 4 | Title min-length (1 char) | `{ "title": "X" }` | `201` | Board created with single-char title |
| 5 | Title max-length (200 chars) | `{ "title": "<200 char string>" }` | `201` | Board created with max title |
| 6 | Description max-length (1000) | `{ "title": "B", "description": "<1000 chars>" }` | `201` | Board created |
| 7 | Hex color lowercase | `{ "title": "B", "backgroundColor": "#aabbcc" }` | `201` | Color stored as `#aabbcc` |

#### 1.1.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 1 | Empty body | `{}` | `400` | `VALIDATION_ERROR` — title is required |
| 2 | Missing title | `{ "description": "No title" }` | `400` | title validation errors |
| 3 | Title empty string | `{ "title": "" }` | `400` | `title must be longer than or equal to 1 characters` |
| 4 | Title > 200 chars | `{ "title": "<201 chars>" }` | `400` | `title must be shorter than or equal to 200 characters` |
| 5 | Description > 1000 chars | `{ "title": "B", "description": "<1001 chars>" }` | `400` | maxLength violation on description |
| 6 | Non-hex backgroundColor | `{ "title": "B", "backgroundColor": "red" }` | `400` | `backgroundColor must be a valid hex color e.g. #1A1A2E` |
| 7 | Short hex (< 7 chars) | `{ "title": "B", "backgroundColor": "#FFF" }` | `400` | minLength violation |
| 8 | Long hex (> 7 chars) | `{ "title": "B", "backgroundColor": "#AABBCCDD" }` | `400` | maxLength violation |
| 9 | Hex without # prefix | `{ "title": "B", "backgroundColor": "AABBCC" }` | `400` | regex failure |
| 10 | Non-string title | `{ "title": 42 }` | `400` | `title must be a string` |

#### 1.1.3 Authorization Errors

| # | Test Case | Expected Status | Expected Error |
|---|-----------|-----------------|----------------|
| 1 | No Authorization header | `401` | `TOKEN_INVALID` |
| 2 | Invalid JWT token | `401` | `TOKEN_INVALID` |
| 3 | User is not a workspace member | `403` | `FORBIDDEN` |
| 4 | User has `viewer` role in workspace | `403` | `FORBIDDEN` (viewers cannot create) |
| 5 | Invalid workspaceId format (non-UUID) | `400` | ParseUUIDPipe validation failure |

---

### 1.2 List Boards — `GET /workspaces/:workspaceId/boards`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member', 'viewer')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | List boards (workspace has boards) | `200` | Array of `BoardResponseDto[]`, only active (non-archived) boards |
| 2 | List boards (workspace has no boards) | `200` | Empty array `[]` |
| 3 | Archived boards are excluded | `200` | After archiving a board, it no longer appears in list |
| 4 | Viewer role can read boards | `200` | Viewers granted read access |
| 5 | Non-member gets 403 | `403` | `FORBIDDEN` |

---

### 1.3 Get Board With Content — `GET /workspaces/:workspaceId/boards/:boardId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member', 'viewer')`
**Query Params:** `BoardContentQueryDto` (pagination for lists and cards)

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Get board by ID (happy path) | `200` | `BoardWithContentResponseDto` — board + nested `lists[].cards[]`, `labels[]`, `isStarred` |
| 2 | Non-existent boardId | `404` | `BOARD_NOT_FOUND` |
| 3 | BoardId belongs to different workspace | `404` | Board scoped to workspace |
| 4 | Archived board access | `404` | Archived boards not retrievable |
| 5 | Invalid boardId (non-UUID) | `400` | ParseUUIDPipe failure |
| 6 | Query with custom pagination | `200` | Respects `listPage`, `listLimit`, `cardLimit` params |
| 7 | Viewer can read board details | `200` | Viewer role has read access |

---

### 1.4 Update Board — `PATCH /workspaces/:workspaceId/boards/:boardId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `UpdateBoardDto` — same fields as `CreateBoardDto`, all optional

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Update title only | `{ "title": "Renamed" }` | `200` | Updated `BoardResponseDto` with new title |
| 2 | Update description | `{ "description": "Updated desc" }` | `200` | Description changed |
| 3 | Update backgroundColor | `{ "backgroundColor": "#0F172A" }` | `200` | Color changed |
| 4 | Update all fields | `{ "title": "X", "description": "Y", "backgroundColor": "#ABCDEF" }` | `200` | All updated |
| 5 | Empty update body | `{}` | `200` | No changes (no-op update) |
| 6 | Clear description (null) | `{ "description": null }` | `200` | Description set to null |
| 7 | Non-existent boardId | N/A | `404` | `BOARD_NOT_FOUND` |
| 8 | Viewer cannot update | N/A | `403` | `FORBIDDEN` |
| 9 | Invalid hex color | `{ "backgroundColor": "#GGG" }` | `400` | Regex validation error |

---

### 1.5 Archive Board — `DELETE /workspaces/:workspaceId/boards/:boardId`

**Guards:** `WorkspaceAuth('owner', 'admin')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Archive board (owner) | `204` | No content; board's `archivedAt` timestamp populated |
| 2 | Archive board (admin) | `204` | Admin has archive permission |
| 3 | Member cannot archive | `403` | `FORBIDDEN` |
| 4 | Viewer cannot archive | `403` | `FORBIDDEN` |
| 5 | Non-existent boardId | `404` | `BOARD_NOT_FOUND` |
| 6 | Archive already-archived board | `404` or idempotent `204` | Depends on implementation |

---

### 1.6 Unarchive Board — `PATCH /workspaces/:workspaceId/boards/:boardId/unarchive`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Restore archived board | `200` | `BoardResponseDto` with `archivedAt: null` |
| 2 | Unarchive non-archived board | `200` or `422` | Idempotent restore or error |
| 3 | Non-existent boardId | `404` | `BOARD_NOT_FOUND` |
| 4 | Viewer cannot unarchive | `403` | `FORBIDDEN` |

---

## 2. Board Labels

### 2.1 Create Label — `POST /workspaces/:workspaceId/boards/:boardId/labels`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `CreateLabelDto` — `name` (string, ≤50, optional), `color` (hex `#RRGGBB`, required, regex `/^#[0-9A-Fa-f]{6}$/`)

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Create label with name + color | `{ "name": "Bug", "color": "#EF4444" }` | `201` | `BoardLabelResponseDto { id, workspaceId, boardId, name, color, createdAt }` |
| 2 | Color-only label (no name) | `{ "color": "#22C55E" }` | `201` | Label with `name: null` |
| 3 | Invalid hex color | `{ "color": "blue" }` | `400` | `color must be a valid hex color` |
| 4 | Missing color (required) | `{ "name": "P1" }` | `400` | color validation error |
| 5 | Name > 50 chars | `{ "name": "<51 chars>", "color": "#FFFFFF" }` | `400` | maxLength violation |
| 6 | Non-existent boardId | N/A | `404` | Board not found |
| 7 | Viewer cannot create | N/A | `403` | `FORBIDDEN` |

### 2.2 List Labels — `GET /workspaces/:workspaceId/boards/:boardId/labels`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member', 'viewer')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | List labels (board has labels) | `200` | Array of `BoardLabelResponseDto[]` |
| 2 | List labels (no labels) | `200` | Empty array `[]` |
| 3 | Viewer can read labels | `200` | Viewer has read access |

### 2.3 Update Label — `PATCH /workspaces/:workspaceId/boards/:boardId/labels/:labelId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `UpdateLabelDto` — partial of `CreateLabelDto`

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Update name | `{ "name": "Critical" }` | `200` | Updated label |
| 2 | Update color | `{ "color": "#3B82F6" }` | `200` | Updated color |
| 3 | Update both | `{ "name": "P0", "color": "#DC2626" }` | `200` | Both changed |
| 4 | Non-existent labelId | N/A | `404` | Label not found |
| 5 | Invalid hex color | `{ "color": "xyz" }` | `400` | Regex validation |

### 2.4 Delete Label — `DELETE /workspaces/:workspaceId/boards/:boardId/labels/:labelId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Delete existing label | `204` | No content |
| 2 | Delete non-existent labelId | `404` | Label not found |
| 3 | Viewer cannot delete | `403` | `FORBIDDEN` |

---

## 3. Board Starring

### 3.1 Star Board — `POST /workspaces/:workspaceId/boards/:boardId/star`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member', 'viewer')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Star a board | `204` | No content; per-user bookmark persisted |
| 2 | Star already-starred board (idempotent) | `204` | No error; remains starred |
| 3 | Non-existent boardId | `404` | Board not found |
| 4 | All roles can star (including viewer) | `204` | Viewer has star permission |

### 3.2 Unstar Board — `DELETE /workspaces/:workspaceId/boards/:boardId/star`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member', 'viewer')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Unstar a starred board | `204` | Star removed |
| 2 | Unstar already-unstarred board (idempotent) | `204` | No error |
| 3 | Non-existent boardId | `404` | Board not found |

---

## 4. Board Activities

### 4.1 Get Activities — `GET /workspaces/:workspaceId/boards/:boardId/activities`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member', 'viewer')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Activities after board create + update | `200` | Array of `ActivityResponseDto[]` with `action: "created"` and `action: "updated"` entries |
| 2 | Activity contains user info | `200` | Each entry has `user: { id, displayName, avatarUrl }` |
| 3 | Activity fields include entityType, entityId, entityTitle | `200` | Correct entity metadata |
| 4 | Empty board (no activity) | `200` | At least "created" entry present |
| 5 | Non-existent boardId | `404` | Board not found |
| 6 | Viewer can read activities | `200` | Read access for all roles |

---

## 5. Lists

### 5.1 Create List — `POST /workspaces/:workspaceId/boards/:boardId/lists`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `CreateListDto` — `title` (string, 1–200, trimmed, required)

#### 5.1.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Create list | `{ "title": "To Do" }` | `201` | `ListResponseDto { id, boardId, title, position (LexoRank), createdAt, updatedAt, archivedAt: null }` |
| 2 | Create second list | `{ "title": "In Progress" }` | `201` | Position ordered after first list |
| 3 | Create third list | `{ "title": "Done" }` | `201` | Position ordered after second |
| 4 | Title trimmed | `{ "title": "  Backlog  " }` | `201` | `title` stored as `"Backlog"` |
| 5 | Min-length title (1 char) | `{ "title": "X" }` | `201` | Created |
| 6 | Max-length title (200 chars) | `{ "title": "<200 chars>" }` | `201` | Created |

#### 5.1.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 1 | Empty body | `{}` | `400` | title required |
| 2 | Empty title | `{ "title": "" }` | `400` | minLength violation |
| 3 | Title > 200 chars | `{ "title": "<201 chars>" }` | `400` | maxLength violation |
| 4 | Non-string title | `{ "title": 123 }` | `400` | `title must be a string` |

#### 5.1.3 Authorization Errors

| # | Test Case | Expected Status | Expected Error |
|---|-----------|-----------------|----------------|
| 1 | Viewer cannot create lists | `403` | `FORBIDDEN` |
| 2 | Non-member gets 403 | `403` | `FORBIDDEN` |

---

### 5.2 Update List — `PATCH /workspaces/:workspaceId/boards/:boardId/lists/:listId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `UpdateListDto` — partial of `CreateListDto`

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Update list title | `{ "title": "Doing" }` | `200` | `ListResponseDto` with updated title |
| 2 | Title trimmed on update | `{ "title": "  Review  " }` | `200` | `title` = `"Review"` |
| 3 | Empty update body (no-op) | `{}` | `200` | No changes |
| 4 | Non-existent listId | N/A | `404` | List not found |
| 5 | Invalid title (empty) | `{ "title": "" }` | `400` | minLength violation |

---

### 5.3 Move/Reorder List — `PATCH /workspaces/:workspaceId/boards/:boardId/lists/:listId/move`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `MoveListDto` — `prevRank` (string, ≤255, optional), `nextRank` (string, ≤255, optional)

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Move list to first position (no prevRank) | `{ "nextRank": "<rank of current first>" }` | `200` | `ListResponseDto` with updated `position` before first |
| 2 | Move list to last position (no nextRank) | `{ "prevRank": "<rank of current last>" }` | `200` | Position after last |
| 3 | Move list between two lists | `{ "prevRank": "<rankA>", "nextRank": "<rankB>" }` | `200` | Position between A and B |
| 4 | Empty body (rank recalculation) | `{}` | `200` | Position recalculated |
| 5 | Non-existent listId | N/A | `404` | List not found |

---

### 5.4 Archive List — `DELETE /workspaces/:workspaceId/boards/:boardId/lists/:listId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Archive an existing list | `204` | No content; `archivedAt` timestamp set |
| 2 | Non-existent listId | `404` | List not found |
| 3 | Viewer cannot archive | `403` | `FORBIDDEN` |
| 4 | Archive list with cards inside | `204` | List archived (cards belong to list) |

---

### 5.5 Unarchive List — `PATCH /workspaces/:workspaceId/boards/:boardId/lists/:listId/unarchive`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Restore archived list | `200` | `ListResponseDto` with `archivedAt: null` |
| 2 | Unarchive non-archived list | `200` or `422` | Idempotent or error |
| 3 | Non-existent listId | `404` | List not found |

---

## 6. Cards

### 6.1 Create Card — `POST /workspaces/:workspaceId/boards/:boardId/lists/:listId/cards`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `CreateCardDto` — `title` (string, 1–500, trimmed, required), `description` (JSON object, optional), `dueDate` (ISO 8601, optional), `coverImageUrl` (string, ≤2000, optional), `assigneeIds` (UUID[], optional), `labelIds` (UUID[], optional)

#### 6.1.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Create card with title only | `{ "title": "Implement auth" }` | `201` | `CardWithDetailsResponseDto { id, boardId, listId, title, description: null, position (LexoRank), dueDate: null, isComplete: false, coverImageUrl: null, createdBy, createdAt, updatedAt, archivedAt: null, assignees: [], labels: [], attachments: [], comments: [] }` |
| 2 | Create card with all fields | `{ "title": "Deploy", "description": {"type":"doc","content":[]}, "dueDate": "2026-12-31T23:59:59Z", "coverImageUrl": "https://cdn.example.com/cover.png", "assigneeIds": ["<userId>"], "labelIds": ["<labelId>"] }` | `201` | All fields populated |
| 3 | Title trimmed | `{ "title": "  Card  " }` | `201` | `title` = `"Card"` |
| 4 | CoverImageUrl trimmed | `{ "title": "C", "coverImageUrl": "  https://x.com  " }` | `201` | URL trimmed |
| 5 | Min-length title | `{ "title": "X" }` | `201` | Created |
| 6 | Max-length title (500 chars) | `{ "title": "<500 chars>" }` | `201` | Created |
| 7 | Multiple assignees | `{ "title": "T", "assigneeIds": ["<user1>", "<user2>"] }` | `201` | Two assignees attached |
| 8 | Multiple labels | `{ "title": "T", "labelIds": ["<label1>", "<label2>"] }` | `201` | Two labels attached |

#### 6.1.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 1 | Empty body | `{}` | `400` | title required |
| 2 | Empty title | `{ "title": "" }` | `400` | `title must be longer than or equal to 1 characters` |
| 3 | Title > 500 chars | `{ "title": "<501 chars>" }` | `400` | maxLength violation |
| 4 | Invalid dueDate | `{ "title": "C", "dueDate": "not-a-date" }` | `400` | `dueDate must be a valid ISO 8601 date string` |
| 5 | coverImageUrl > 2000 chars | `{ "title": "C", "coverImageUrl": "<2001 chars>" }` | `400` | maxLength violation |
| 6 | Invalid assigneeIds (non-UUID) | `{ "title": "C", "assigneeIds": ["not-uuid"] }` | `400` | UUID validation |
| 7 | Invalid labelIds (non-UUID) | `{ "title": "C", "labelIds": ["not-uuid"] }` | `400` | UUID validation |
| 8 | Description not object | `{ "title": "C", "description": "plain text" }` | `400` | `description must be an object` |
| 9 | Non-existent listId | N/A | `404` | List not found |

#### 6.1.3 Authorization Errors

| # | Test Case | Expected Status | Expected Error |
|---|-----------|-----------------|----------------|
| 1 | Viewer cannot create cards | `403` | `FORBIDDEN` |
| 2 | Non-member gets 403 | `403` | `FORBIDDEN` |

---

### 6.2 Get Card Details — `GET /workspaces/:workspaceId/boards/:boardId/cards/:cardId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member', 'viewer')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Get card (happy path) | `200` | `CardWithDetailsResponseDto` with nested assignees, labels, attachments, comments |
| 2 | Non-existent cardId | `404` | Card not found |
| 3 | CardId from different board | `404` | Card scoped to board |
| 4 | Viewer can read card details | `200` | Read access |

---

### 6.3 Update Card — `PATCH /workspaces/:workspaceId/boards/:boardId/cards/:cardId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `UpdateCardDto` — extends `PartialType(CreateCardDto)` + `isComplete` (boolean, optional)

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Update title | `{ "title": "Renamed card" }` | `200` | `CardResponseDto` with new title |
| 2 | Update description | `{ "description": {"type":"doc","content":[{"type":"paragraph"}]} }` | `200` | Description updated |
| 3 | Set due date | `{ "dueDate": "2026-06-30T12:00:00Z" }` | `200` | Due date set |
| 4 | Clear due date | `{ "dueDate": null }` | `200` | Due date removed |
| 5 | Mark as complete | `{ "isComplete": true }` | `200` | `isComplete: true` |
| 6 | Mark as incomplete | `{ "isComplete": false }` | `200` | `isComplete: false` |
| 7 | Set cover image | `{ "coverImageUrl": "https://cdn.example.com/new.png" }` | `200` | Cover image set |
| 8 | Clear cover image | `{ "coverImageUrl": null }` | `200` | Cover removed |
| 9 | Non-existent cardId | N/A | `404` | Card not found |
| 10 | Viewer cannot update | N/A | `403` | `FORBIDDEN` |
| 11 | Invalid isComplete (string) | `{ "isComplete": "yes" }` | `400` | `isComplete must be a boolean` |

---

### 6.4 Move/Reorder Card — `PATCH /workspaces/:workspaceId/boards/:boardId/cards/:cardId/move`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `MoveCardDto` — `targetListId` (UUID, required), `prevRank` (string, ≤255, optional), `nextRank` (string, ≤255, optional)

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Move card to same list (reorder) | `{ "targetListId": "<same-list>", "prevRank": "<rank>" }` | `200` | `CardResponseDto` with updated position |
| 2 | Move card to different list | `{ "targetListId": "<other-list>" }` | `200` | Card's `listId` changed, position calculated |
| 3 | Move to first position | `{ "targetListId": "<list>", "nextRank": "<first-card-rank>" }` | `200` | Card placed before first |
| 4 | Move to last position | `{ "targetListId": "<list>", "prevRank": "<last-card-rank>" }` | `200` | Card placed after last |
| 5 | Move between two cards | `{ "targetListId": "<list>", "prevRank": "<A>", "nextRank": "<B>" }` | `200` | Position between A and B |
| 6 | Missing targetListId | `{ "prevRank": "x" }` | `400` | `targetListId` required |
| 7 | Invalid targetListId (non-UUID) | `{ "targetListId": "not-uuid" }` | `400` | UUID validation error |
| 8 | Non-existent targetListId | `{ "targetListId": "<fake-uuid>" }` | `400` or `404` | Invalid destination list |
| 9 | Non-existent cardId | N/A | `404` | Card not found |
| 10 | Viewer cannot move cards | N/A | `403` | `FORBIDDEN` |

---

### 6.5 Archive Card — `DELETE /workspaces/:workspaceId/boards/:boardId/cards/:cardId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Archive an existing card | `204` | No content; `archivedAt` timestamp set |
| 2 | Non-existent cardId | `404` | Card not found |
| 3 | Viewer cannot archive | `403` | `FORBIDDEN` |
| 4 | Archived card excluded from list view | `200` on board GET | Card no longer in board content |

---

### 6.6 Unarchive Card — `PATCH /workspaces/:workspaceId/boards/:boardId/cards/:cardId/unarchive`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Restore archived card | `200` | `CardResponseDto` with `archivedAt: null` |
| 2 | Unarchive non-archived card | `200` or `422` | Idempotent or error |
| 3 | Non-existent cardId | `404` | Card not found |
| 4 | Viewer cannot unarchive | `403` | `FORBIDDEN` |

---

## 7. Card Assignees

### 7.1 Add Assignee — `POST /workspaces/:workspaceId/boards/:boardId/cards/:cardId/assignees/:targetUserId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Assign workspace member to card | `204` | No content; user appears in card's assignees |
| 2 | Assign self to card | `204` | Self-assignment succeeds |
| 3 | Assign already-assigned user (idempotent) | `204` or `409` | Idempotent or conflict |
| 4 | Assign non-workspace-member | `404` or `422` | Target user must be workspace member |
| 5 | Non-existent cardId | `404` | Card not found |
| 6 | Non-existent targetUserId | `404` | User not found |
| 7 | Invalid targetUserId (non-UUID) | `400` | ParseUUIDPipe failure |
| 8 | Viewer cannot assign | `403` | `FORBIDDEN` |

### 7.2 Remove Assignee — `DELETE /workspaces/:workspaceId/boards/:boardId/cards/:cardId/assignees/:targetUserId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Remove assigned user | `204` | No content; user removed from card's assignees |
| 2 | Remove non-assigned user | `204` or `404` | Idempotent or not found |
| 3 | Non-existent cardId | `404` | Card not found |
| 4 | Viewer cannot remove | `403` | `FORBIDDEN` |

---

## 8. Card Labels

### 8.1 Attach Label — `POST /workspaces/:workspaceId/boards/:boardId/cards/:cardId/labels/:labelId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Attach board label to card | `204` | No content; label appears in card details |
| 2 | Attach already-attached label (idempotent) | `204` or `409` | Idempotent or conflict |
| 3 | Attach label from different board | `404` or `422` | Label must belong to same board |
| 4 | Non-existent labelId | `404` | Label not found |
| 5 | Non-existent cardId | `404` | Card not found |
| 6 | Viewer cannot attach labels | `403` | `FORBIDDEN` |

### 8.2 Detach Label — `DELETE /workspaces/:workspaceId/boards/:boardId/cards/:cardId/labels/:labelId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Detach label from card | `204` | No content; label removed from card |
| 2 | Detach non-attached label | `204` or `404` | Idempotent or not found |
| 3 | Non-existent labelId | `404` | Label not found |
| 4 | Viewer cannot detach labels | `403` | `FORBIDDEN` |

---

## 9. Card Attachments

### 9.1 Create Attachment — `POST /workspaces/:workspaceId/boards/:boardId/cards/:cardId/attachments`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `CreateCardAttachmentDto` — `type` (enum `file|image|link`, default `file`, optional), `url` (string, 1–2000, required), `name` (string, 1–255, required), `mimeType` (string, ≤100, optional), `fileSize` (integer, ≥0, optional), `coverUrl` (string, ≤2000, optional)

#### 9.1.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Create link attachment | `{ "type": "link", "url": "https://figma.com/file/xyz", "name": "Design File" }` | `201` | `CardAttachmentResponseDto { id, cardId, type: "link", url, name, mimeType: null, fileSize: null, coverUrl: null, uploadedBy, createdAt }` |
| 2 | Create file attachment (all fields) | `{ "type": "file", "url": "https://cdn.example.com/doc.pdf", "name": "Spec.pdf", "mimeType": "application/pdf", "fileSize": 1048576, "coverUrl": "https://cdn.example.com/thumb.png" }` | `201` | All fields populated |
| 3 | Create image attachment | `{ "type": "image", "url": "https://cdn.example.com/photo.png", "name": "Screenshot" }` | `201` | `type: "image"` |
| 4 | Default type = file (omitted) | `{ "url": "https://x.com/a.zip", "name": "Archive" }` | `201` | `type: "file"` (default) |
| 5 | URL and name trimmed | `{ "url": "  https://x.com  ", "name": "  My File  " }` | `201` | Trimmed values stored |

#### 9.1.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 1 | Empty body | `{}` | `400` | url and name required |
| 2 | Missing url | `{ "name": "X" }` | `400` | url required |
| 3 | Missing name | `{ "url": "https://x.com" }` | `400` | name required |
| 4 | URL > 2000 chars | `{ "url": "<2001 chars>", "name": "X" }` | `400` | maxLength violation |
| 5 | Name > 255 chars | `{ "url": "https://x.com", "name": "<256 chars>" }` | `400` | maxLength violation |
| 6 | Empty URL | `{ "url": "", "name": "X" }` | `400` | minLength violation |
| 7 | Empty name | `{ "url": "https://x.com", "name": "" }` | `400` | minLength violation |
| 8 | Invalid type enum | `{ "type": "video", "url": "https://x.com", "name": "X" }` | `400` | `type must be a valid enum value` |
| 9 | mimeType > 100 chars | `{ "url": "https://x.com", "name": "X", "mimeType": "<101 chars>" }` | `400` | maxLength violation |
| 10 | Negative fileSize | `{ "url": "https://x.com", "name": "X", "fileSize": -1 }` | `400` | `fileSize must not be less than 0` |
| 11 | Non-integer fileSize | `{ "url": "https://x.com", "name": "X", "fileSize": 3.14 }` | `400` | `fileSize must be an integer number` |
| 12 | coverUrl > 2000 chars | `{ "url": "https://x.com", "name": "X", "coverUrl": "<2001 chars>" }` | `400` | maxLength violation |
| 13 | Non-existent cardId | N/A | `404` | Card not found |

#### 9.1.3 Authorization Errors

| # | Test Case | Expected Status | Expected Error |
|---|-----------|-----------------|----------------|
| 1 | Viewer cannot create attachment | `403` | `FORBIDDEN` |
| 2 | Non-member gets 403 | `403` | `FORBIDDEN` |

---

### 9.2 List Attachments — `GET /workspaces/:workspaceId/boards/:boardId/cards/:cardId/attachments`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member', 'viewer')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | List attachments (card has attachments) | `200` | Array of `CardAttachmentResponseDto[]` |
| 2 | List attachments (no attachments) | `200` | Empty array `[]` |
| 3 | Viewer can list attachments | `200` | Read access |
| 4 | Non-existent cardId | `404` | Card not found |

---

### 9.3 Update Attachment — `PATCH /workspaces/:workspaceId/boards/:boardId/cards/:cardId/attachments/:attachmentId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `UpdateCardAttachmentDto` — partial of `CreateCardAttachmentDto`

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Update name | `{ "name": "Updated File Name" }` | `200` | `CardAttachmentResponseDto` with updated name |
| 2 | Update URL | `{ "url": "https://new.example.com/file.pdf" }` | `200` | URL changed |
| 3 | Update type | `{ "type": "image" }` | `200` | Type changed |
| 4 | Update multiple fields | `{ "name": "New", "url": "https://x.com", "mimeType": "image/png" }` | `200` | All updated |
| 5 | Empty update body | `{}` | `200` | No-op |
| 6 | Non-existent attachmentId | N/A | `404` | Attachment not found |
| 7 | Viewer cannot update | N/A | `403` | `FORBIDDEN` |

---

### 9.4 Delete Attachment — `DELETE /workspaces/:workspaceId/boards/:boardId/cards/:cardId/attachments/:attachmentId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Delete existing attachment | `204` | No content; permanently deleted |
| 2 | Delete non-existent attachmentId | `404` | Attachment not found |
| 3 | Viewer cannot delete | `403` | `FORBIDDEN` |
| 4 | Verify attachment removed from card details | `200` on GET card | Attachment no longer in card's attachments list |

---

## 10. Card Comments

### 10.1 Create Comment — `POST /workspaces/:workspaceId/boards/:boardId/cards/:cardId/comments`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `CreateCommentDto` — `content` (string, 1–5000, trimmed, required)

#### 10.1.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Create comment | `{ "content": "This looks good!" }` | `201` | `CardCommentResponseDto { id, cardId, content, author: { id, displayName, avatarUrl }, createdAt, updatedAt }` |
| 2 | Content trimmed | `{ "content": "  Hello  " }` | `201` | `content` = `"Hello"` |
| 3 | Min-length content (1 char) | `{ "content": "X" }` | `201` | Created |
| 4 | Max-length content (5000 chars) | `{ "content": "<5000 chars>" }` | `201` | Created |
| 5 | Multiple comments on same card | Multiple POSTs | `201` each | Each has unique ID |

#### 10.1.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 1 | Empty body | `{}` | `400` | content required |
| 2 | Empty content | `{ "content": "" }` | `400` | `content must be longer than or equal to 1 characters` |
| 3 | Content > 5000 chars | `{ "content": "<5001 chars>" }` | `400` | maxLength violation |
| 4 | Non-string content | `{ "content": 123 }` | `400` | `content must be a string` |

#### 10.1.3 Authorization Errors

| # | Test Case | Expected Status | Expected Error |
|---|-----------|-----------------|----------------|
| 1 | Viewer cannot comment | `403` | `FORBIDDEN` |
| 2 | Non-existent cardId | `404` | Card not found |

---

### 10.2 List Comments (Paginated) — `GET /workspaces/:workspaceId/boards/:boardId/cards/:cardId/comments`

**Query Params:** `PaginationQueryDto` — `page` (int, ≥1, default 1), `limit` (int, 1–100, default 20)

> [!NOTE]
> **Legacy pagination.** Comments currently use offset pagination; the project standard is
> cursor-based (`?cursor=<uuid>&limit=`) — see docs/03-api-design.md. These cases describe
> current behavior and must be rewritten when the cursor migration lands.

| # | Test Case | Query Params | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | List with defaults | None | `200` | `{ items: CardCommentResponseDto[], meta: { page, limit, total, totalPages } }` |
| 2 | Custom page/limit | `?page=1&limit=5` | `200` | Paginated response with ≤5 items |
| 3 | Page beyond total | `?page=999` | `200` | Empty items, meta reflects total |
| 4 | Invalid page (< 1) | `?page=0` | `400` | Validation error |
| 5 | Invalid limit (> 100) | `?limit=200` | `400` | `limit must not be greater than 100` |
| 6 | Invalid limit (< 1) | `?limit=0` | `400` | `limit must not be less than 1` |
| 7 | Non-integer page | `?page=abc` | `400` | Validation error |
| 8 | Viewer can list comments | None | `200` | Read access |
| 9 | Non-existent cardId | None | `404` | Card not found |

---

### 10.3 Update Comment — `PATCH /workspaces/:workspaceId/boards/:boardId/cards/:cardId/comments/:commentId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`
**DTO:** `UpdateCommentDto` — partial of `CreateCommentDto`

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1 | Update own comment | `{ "content": "Updated text" }` | `200` | `CardCommentResponseDto` with updated content and `updatedAt` changed |
| 2 | Update another user's comment | `{ "content": "Hijack" }` | `403` | `FORBIDDEN` — only author can edit |
| 3 | Non-existent commentId | N/A | `404` | Comment not found |
| 4 | Invalid content (empty) | `{ "content": "" }` | `400` | minLength violation |
| 5 | Content > 5000 chars | `{ "content": "<5001 chars>" }` | `400` | maxLength violation |
| 6 | Viewer cannot update | N/A | `403` | `FORBIDDEN` |

---

### 10.4 Delete Comment — `DELETE /workspaces/:workspaceId/boards/:boardId/cards/:cardId/comments/:commentId`

**Guards:** `WorkspaceAuth('owner', 'admin', 'member')`

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 1 | Delete own comment | `204` | No content; comment soft-deleted |
| 2 | Delete another user's comment | `403` | `FORBIDDEN` — only author can delete |
| 3 | Workspace owner/admin deletes any comment | `204` or `403` | Depends on ownership policy implementation |
| 4 | Non-existent commentId | `404` | Comment not found |
| 5 | Viewer cannot delete | `403` | `FORBIDDEN` |
| 6 | Verify deleted comment excluded from list | `200` on GET comments | Deleted comment not in paginated response |

---

## 11. Cross-Cutting Concerns

### 11.1 Response Envelope

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | All success responses wrapped | `{ success: true, data: T, meta: { timestamp, requestId } }` |
| 2 | All error responses wrapped | `{ success: false, error: { code, message, statusCode, details, timestamp, requestId } }` |
| 3 | RequestId is unique per request | UUID format `req_xxxx` |

### 11.2 Authentication & Authorization

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | Missing Authorization header | `401` — `TOKEN_INVALID` on all endpoints |
| 2 | Expired JWT | `401` — token expired |
| 3 | Blacklisted JWT (post-logout) | `401` — `TOKEN_REVOKED` |
| 4 | Invalid UUID path params | `400` — ParseUUIDPipe validation |
| 5 | Non-member accessing any board endpoint | `403` — `FORBIDDEN` |

### 11.3 RBAC Matrix

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| Create board | ✅ | ✅ | ✅ | ❌ |
| List boards | ✅ | ✅ | ✅ | ✅ |
| Get board details | ✅ | ✅ | ✅ | ✅ |
| Update board | ✅ | ✅ | ✅ | ❌ |
| Archive board | ✅ | ✅ | ❌ | ❌ |
| Unarchive board | ✅ | ✅ | ✅ | ❌ |
| Star/Unstar board | ✅ | ✅ | ✅ | ✅ |
| Create/Update/Delete labels | ✅ | ✅ | ✅ | ❌ |
| List labels | ✅ | ✅ | ✅ | ✅ |
| View activities | ✅ | ✅ | ✅ | ✅ |
| Create/Update/Move/Archive list | ✅ | ✅ | ✅ | ❌ |
| Create/Update/Move/Archive card | ✅ | ✅ | ✅ | ❌ |
| Get card details | ✅ | ✅ | ✅ | ✅ |
| Add/Remove assignees | ✅ | ✅ | ✅ | ❌ |
| Attach/Detach card labels | ✅ | ✅ | ✅ | ❌ |
| Create/Update/Delete attachments | ✅ | ✅ | ✅ | ❌ |
| List attachments | ✅ | ✅ | ✅ | ✅ |
| Create/Update/Delete comments | ✅ | ✅ | ✅ | ❌ |
| List comments | ✅ | ✅ | ✅ | ✅ |

### 11.4 Data Integrity & Edge Cases

| # | Test Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | Delete label that is attached to cards | Label removed from all cards; cascade detach |
| 2 | Archive list containing cards | List archived; cards remain linked |
| 3 | Archive card, then unarchive list | Card remains archived independently |
| 4 | Move card to archived list | `400` or `404` — invalid target |
| 5 | Create card in archived board's list | `404` — board/list not found |
| 6 | Board operations after workspace archived | `404` — workspace not found |
| 7 | Concurrent star/unstar same board | Idempotent behavior |
| 8 | Activity generated on card move across lists | Activity entry with `fromListId` / `toListId` |
| 9 | Activity generated on card create/update/archive | Audit trail reflects all mutations |
| 10 | LexoRank ordering maintained after multiple moves | Position strings correctly ordered |
| 11 | Pagination meta.totalPages calculation | `Math.ceil(total / limit)` |
| 12 | Empty pagination (0 items) | `{ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }` |

---

## 12. Card Checklists

### 12.1 Checklist CRUD — `POST|PATCH|DELETE /cards/:cardId/checklists[/:checklistId]`
| # | Case | Expected |
|---|------|----------|
| 12.1.1 | Create with title | 201; rank appended; items: [] |
| 12.1.2 | Create on archived/foreign card | 404 |
| 12.1.3 | Rename | 200; event checklist.updated broadcast |
| 12.1.4 | Delete cascades items | 204; items gone (hard delete) |

### 12.2 Items
| # | Case | Expected |
|---|------|----------|
| 12.2.1 | Add item | 201; appended rank; parent progress changes |
| 12.2.2 | Toggle isDone / edit content | 200; persisted |
| 12.2.3 | Remove item | 204 |
| 12.2.4 | Item of foreign checklist | 404 |
| 12.2.5 | Content limits | >500 chars → 400; empty after sanitize → 400 |

### 12.3 Realtime & ordering
- toggling in tab A updates B without reload (`checklist:*` frames);
- Lexorank reorder via drag persists across reload;
- WS catalog rows: `test-cases-realtime-ws.md` §2.8.

## 13. Combined & End-to-End Scenarios

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 13.1 | Full board journey | create board→lists→cards→move→comment→label→assign→star→archive→unarchive→delete | every step's REST + WS counterpart fires exactly once per action; final GET equals client state |
| 13.2 | Archive cascade UX | archive list w/ cards | cards hidden everywhere; unarchive list keeps cards archived until individually restored |
| 13.3 | Cross-workspace isolation sweep | workspace X token hits all Y-resource routes | uniform 403/404, never data leak; identical for WS joins |
| 13.4 | Pagination integrity under writes | walk comments cursor while new comments arrive | no dupes/misses guaranteed by cursor semantics (documented behavior) |
| 13.5 | Sanitization round-trip | comment `<img src=x onerror=alert(1)>hi` + label name with emoji | stored/rendered content stripped-but-faithful; emoji preserved |
| 13.6 | Rank rebalance trigger | force near-exhaustion ranks (script) then insert | midpoint grows or rebalance runs; ordering stays correct |
