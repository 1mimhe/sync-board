# 03 — API Design

## 1. API Conventions

### Base URL
```
Production:  https://api.syncboard.app/api
Development: http://localhost:3000/api
```
> **Versioning:** the API is served under `/api`. If breaking changes ever require
> versioning, NestJS URI versioning can be enabled and clients migrated to
> `/api/v1/...`.

### Authentication & Cookies

| Concern | Contract |
|---------|----------|
| Access token | `Authorization: Bearer <access_token>` header |
| Refresh token | HTTP-only cookie `refreshToken` — **never** in JSON bodies (see `06-auth-and-rbac.md` § Cookie Contract) |
| Request tracing | `X-Request-Id: <uuid>` (auto-generated if not provided) |

### Rate Limit Headers

`@nestjs/throttler` guards the auth endpoints. Clients should honor `429` +
`Retry-After` responses with exponential backoff.

### Standard Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-08-08T12:00:00.000Z",
    "requestId": "req_a1b2c3d4"
  }
}
```

**Paginated:**
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "cursor": "550e8400-e29b-41d4-a716-446655440000",
      "hasMore": true
    }
  },
  "meta": { ... }
}
```

The cursor is the **last item's `id`** (plain UUID — no base64 encoding). Clients pass it back
as `?cursor=<uuid>&limit=20`. `total` is intentionally omitted: counting on every page defeats
the purpose of cursor pagination. `hasMore` is derived server-side by fetching `limit + 1` rows.

> [!IMPORTANT]
> **Cursor-based pagination is the standard strategy.** All list endpoints accept
> `?cursor=<uuid>&limit=20` and return `{ items, pagination: { cursor, hasMore } }`.
> One historical exception (offset-style comments listing) is documented inline where
> it appears.

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "WORKSPACE_NOT_FOUND",
    "message": "Workspace with slug 'my-team' was not found",
    "statusCode": 404,
    "details": {}
  },
  "meta": { ... }
}
```

<details>
<summary><strong>💡 Why cursor-based pagination over offset?</strong></summary>

**Offset pagination** (`?page=5&limit=20`) breaks when data changes:
- Insert a new row → page 5 now has a duplicate from page 4.
- Performance degrades: `OFFSET 10000` still scans 10,000 rows.

**Cursor pagination** (`?cursor=<uuid>&limit=20`) uses the last item's ID as anchor:
- Consistent results regardless of inserts/deletes.
- Uses indexed `WHERE id > cursor_value` — constant performance.
- Trade-off: No "jump to page 10" — only next/previous.

</details>

### Authentication & Rate Limit Headers
```
Authorization: Bearer <access_token>
X-Request-Id: <uuid>               (auto-generated if not provided)
```

### Standard HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful GET, PUT, PATCH |
| `201` | Created | Successful POST that creates a resource |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Validation error, malformed JSON |
| `401` | Unauthorized | Missing/invalid/expired JWT |
| `403` | Forbidden | Valid JWT but insufficient role/permissions |
| `404` | Not Found | Resource doesn't exist or user has no access |
| `409` | Conflict | Duplicate resource (e.g., slug already taken) |
| `422` | Unprocessable Entity | Semantically invalid request |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unhandled server error |

---

## 2. Auth Endpoints

### 2.1 Registration & Login

#### `POST /api/auth/register`
Register a new user with email and password.

```json
// Request
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "displayName": "John Doe"
}

// Response 201
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "displayName": "John Doe",
      "avatarUrl": null,
      "isEmailVerified": false,
      "createdAt": "2026-08-08T12:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbG...",
      "expiresIn": 900
    }
  }
}
// Note: refreshToken is sent exclusively in the HTTP-Only cookie
// Note: a welcome email with a single-use verification link (24h) is sent to
//       the address; until verified, mutating requests return 403
//       EMAIL_NOT_VERIFIED (see 06-auth-and-rbac.md §6)
```

**Validation:**
- `email`: Valid email format, max 255 chars, unique
- `password`: Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special char
- `displayName`: 2-100 chars, trimmed

---

#### `POST /api/auth/login`
Authenticate with email and password.

```json
// Request
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}

// Response 200
{
  "success": true,
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbG...",
      "expiresIn": 900
    }
  }
}
// Note: refreshToken is set exclusively as an HTTP-Only cookie
// (cookie name `refreshToken`) — never returned in the JSON body.
```

**Error Responses:**
- `401` — Invalid email or password (never reveal which one is wrong)
- `429` — Too many login attempts (throttled per IP)

---

#### `POST /api/auth/refresh`
Exchange the refresh-token cookie for a new access token. **No request body** — the refresh
token is read from the HTTP-only cookie. Rotates the token: a new cookie is set on every call.

```json
// Request: no body; cookie `refreshToken` sent automatically

// Response 200
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "expiresIn": 900
  }
}
// Note: new refreshToken is set in the HTTP-Only cookie
```

**Error Responses:**
- `401 TOKEN_INVALID` — unknown cookie value
- `401 REFRESH_TOKEN_EXPIRED` — rotation chain expired
- `401 TOKEN_REUSE_DETECTED` — replayed token; entire rotation family revoked

---

#### `POST /api/auth/logout`
Revoke the current session's refresh token and clear the cookie. 🔒 Requires authentication.
No request body — reads the cookie.

```json
// Response 204 (No Content)
```

---

#### `POST /api/auth/logout-all`
Revoke ALL refresh tokens for the current user (logout from all devices). 🔒 Requires authentication.

```json
// Response 204 (No Content)
```

---

### 2.2 Google OAuth

#### `GET /api/auth/google`
Redirect to Google OAuth consent screen.

**Query Params:**
- `redirect`: Optional client redirect URL after auth

**Response:** `302 Redirect` → Google OAuth

---

#### `GET /api/auth/google/callback`
Google OAuth callback. Exchanges code for tokens, creates/links user account.

**Response:** `302 Redirect` → Client app with tokens in URL fragment or sets HTTP-only cookies.

---

### 2.3 Profile

#### `GET /api/auth/me` 🔒
Get current user profile.

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "avatarUrl": "https://...",
    "isEmailVerified": true,
    "googleId": "google_123",
    "lastLoginAt": "2026-08-08T12:00:00Z",
    "createdAt": "2026-08-08T12:00:00Z",
    "updatedAt": "2026-08-08T12:00:00Z"
  }
}
```

---

#### `PATCH /api/auth/me` 🔒
Update current user profile.

```json
// Request (all fields optional)
{
  "displayName": "Jane Doe",
  "avatarUrl": "https://..."
}

// Response 200 — updated user object
```

---

#### `PATCH /api/auth/me/password` 🔒
Change password.

```json
// Request
{
  "currentPassword": "OldP@ss123",
  "newPassword": "NewSecureP@ss456"
}

// Response 204
```

---

### 2.4 Password Recovery

#### `POST /api/auth/forgot-password`
Request a password reset email. Always returns 200 to prevent user enumeration.

```json
// Request
{
  "email": "user@example.com"
}

// Response 200
{
  "success": true,
  "data": {
    "message": "If that email exists in our system, a password reset link has been sent."
  }
}
```

---

#### `POST /api/auth/reset-password`
Reset password using the single-use token received via email.

```json
// Request
{
  "token": "reset_token_abc123",
  "newPassword": "NewSecureP@ss456"
}

// Response 200
{
  "success": true,
  "data": {
    "message": "Password reset successfully. Please log in with your new password."
  }
}
```

---

### 2.5 Email Verification

Unverified users may log in and browse, but every mutating request outside the
self-service endpoints returns `403 EMAIL_NOT_VERIFIED` (see
`06-auth-and-rbac.md` §6 for the full capability matrix).

#### `POST /api/auth/verify-email`
Verify the email address with the single-use token from the verification email.
Public endpoint — no session required and intentionally **not** wrapped in
`AnonymousGuard`: registration auto-logs-in the user, so the same browser
legitimately carries a refresh cookie when the link is clicked. Identity is
proven by possession of the single-use token (replay-safe, atomically
consumed); abuse is bounded by rate limiting and the 256-bit token entropy.

```json
// Request
{
  "token": "verify_token_abc123"
}

// Response 200
{
  "success": true,
  "data": {
    "message": "Email verified successfully."
  }
}
// 401 TOKEN_INVALID — token unknown, expired (>24h), or already used
```

---

#### `POST /api/auth/resend-verification` 🔒
Resend the verification email to the current user (rate-limited).

```json
// Response 204 — verification email queued (if not already verified)
// 409 EMAIL_ALREADY_VERIFIED — the email is already verified
```

---

## 3. Workspace Endpoints

All workspace endpoints (except create & slug lookup) are scoped via the `:workspaceId` path
parameter. There is no workspace header — membership is resolved from the path + JWT.

> **Email verification:** unverified users can accept invitations and perform
> read-only (GET) requests, but mutating requests (create workspace, invite,
> edit boards/cards/comments, uploads) fail with `403 EMAIL_NOT_VERIFIED`
> until they verify their email.

#### `POST /api/workspaces` 🔒
Create a new workspace. Creator becomes Owner.

```json
// Request
{
  "name": "My Team",
  "description": "Our product team workspace"
}

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Team",
    "slug": "my-team",
    "description": "Our product team workspace",
    "ownerId": "uuid",
    "role": "owner",
    "createdAt": "2026-08-08T12:00:00Z"
  }
}
```

**Notes:** `slug` is auto-generated from `name`, de-duplicated with suffix if taken.

---

#### `GET /api/workspaces` 🔒
List workspaces the current user is a member of.

```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "My Team",
      "slug": "my-team",
      "role": "owner",
      "memberCount": 5,
      "createdAt": "..."
    }
  ]
}
```

---

#### `GET /api/workspaces/:workspaceId` 🔒 `[member+]`
Get workspace details by ID.

---

#### `GET /api/workspaces/slug/:slug` 🔒 `[member+]`
Get workspace details by unique URL slug.

> [!NOTE]
> **Route ordering:** this route is registered *before* `GET /workspaces/:id`,
> otherwise the `:workspaceId` param route matches first and slug lookups fail
> validation with a confusing 400.

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Team",
    "slug": "my-team",
    "description": "Our product team workspace",
    "ownerId": "uuid",
    "role": "member",
    "memberCount": 5,
    "createdAt": "..."
  }
}
```

---

#### `PATCH /api/workspaces/:workspaceId` 🔒 `[admin+]`
Update workspace name/description.

#### `DELETE /api/workspaces/:workspaceId` 🔒 `[owner]`
Archive (soft-delete) workspace.

#### `POST /api/workspaces/:workspaceId/leave` 🔒 `[member+]`
Leave a workspace (self-removal). Uses POST because leaving is an action, not resource deletion.
- **Rules:** Sole owner must transfer ownership before leaving (returns `422 Unprocessable Entity`).

#### `POST /api/workspaces/:workspaceId/transfer-ownership` 🔒 `[owner]`
Transfer workspace ownership to another member.

```json
// Request
{
  "newOwnerId": "target-user-uuid"
}

// Response 200 — updated membership object with owner role
```

---

### 3.1 Workspace Members

#### `GET /api/workspaces/:workspaceId/members` 🔒 `[member+]`
List all members with their roles.

```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "member-uuid",
      "userId": "user-uuid",
      "displayName": "John Doe",
      "email": "john@example.com",
      "avatarUrl": "...",
      "role": "admin",
      "joinedAt": "..."
    }
  ]
}
```

---

#### `PATCH /api/workspaces/:workspaceId/members/:memberId` 🔒 `[admin+]`
Update a member's role.

```json
// Request
{
  "role": "admin"
}
```

**Rules:**
- Cannot change owner's role.
- Admin cannot promote to owner.
- Only owner can promote to admin.

---

#### `DELETE /api/workspaces/:workspaceId/members/:memberId` 🔒 `[admin+]`
Remove a member from workspace.

---

### 3.2 Workspace Invitations

#### `POST /api/workspaces/:workspaceId/invitations` 🔒 `[admin+]`
Invite a user by email.

```json
// Request
{
  "email": "newmember@example.com",
  "role": "member"
}

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "newmember@example.com",
    "role": "member",
    "status": "pending",
    "expiresAt": "2026-08-15T12:00:00Z"
  }
}
```

---

#### `GET /api/workspaces/:workspaceId/invitations` 🔒 `[admin+]`
List pending invitations.

#### `DELETE /api/workspaces/:workspaceId/invitations/:invitationId` 🔒 `[admin+]`
Revoke a pending invitation.

#### `POST /api/invitations/:token/accept` 🔒
Accept an invitation by token. Creates workspace membership.

**Full flow (including not-yet-registered users):**
1. Invited user opens the invitation link → client validates the token via the API.
   - If the email is **already registered**: prompt login, then call this endpoint.
   - If **not registered**: redirect to sign-up preserving the token (e.g. `/register?invite=<token>`).
2. On successful registration, the server **auto-accepts all pending invitations matching the
   new account's email** (indexed by `idx_invitations_email_pending`) and returns them in the
   register response as `joinedWorkspaces`.
3. `POST /invitations/:token/accept` remains for users who registered before clicking the link.

**Error Responses:**
- `404 INVITATION_NOT_FOUND`
- `422 INVITATION_EXPIRED` / `422 INVITATION_REVOKED`
- `409 ALREADY_A_MEMBER`

---

## 4. Board Endpoints

#### `POST /api/workspaces/:workspaceId/boards` 🔒 `[member+]`
Create a new board.

```json
// Request
{
  "title": "Sprint 23",
  "description": "August sprint board",
  "backgroundColor": "#1A1A2E"
}

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "workspaceId": "uuid",
    "title": "Sprint 23",
    "description": "August sprint board",
    "backgroundColor": "#1A1A2E",
    "isStarred": false,
    "createdBy": "uuid",
    "lists": [],
    "createdAt": "..."
  }
}
```

---

#### `GET /api/workspaces/:workspaceId/boards` 🔒 `[member+]`
List all active boards in workspace. Includes per-user `isStarred` boolean based on `user_starred_boards`.

**Query Params:**
- `starred`: boolean — filter starred only for current user
- `cursor`: string — pagination cursor
- `limit`: number — default 20, max 50

---

#### `GET /api/workspaces/:workspaceId/boards/archived` 🔒 `[member+]`
List archived boards (paginated, cursor-based). Returns only `archivedAt!=null && deletedAt==null`. Deleted boards (`deletedAt!=null`) are not retrievable.

**Query:** `cursor` (last `id`), `limit` (default 20, max 50)

```json
// Response 200 — PaginatedResult<Board>
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "workspaceId": "uuid",
        "title": "Old Sprint Board",
        "archivedAt": "2026-08-20T10:00:00Z",
        "deletedAt": null
      }
    ],
    "pagination": { "cursor": "uuid-or-null", "hasMore": true }
  }
}
```

---

#### `GET /api/boards/:boardId` 🔒 `[member+]`
Get board with all lists and cards (full board load). Includes per-user `isStarred` status.

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Sprint 23",
    "isStarred": true,
    "lists": [
      {
        "id": "uuid",
        "title": "To Do",
        "rank": "a",
        "cards": [
          {
            "id": "uuid",
            "title": "Implement auth",
            "rank": "a",
            "dueDate": "2026-08-15T00:00:00Z",
            "isComplete": false,
            "assignees": [
              { "id": "uuid", "displayName": "John", "avatarUrl": "..." }
            ],
            "labels": [
              { "id": "uuid", "name": "Backend", "color": "#E74C3C" }
            ],
            "commentCount": 3,
            "attachmentCount": 1
          }
        ]
      }
    ],
    "labels": [
      { "id": "uuid", "name": "Backend", "color": "#E74C3C" },
      { "id": "uuid", "name": "Frontend", "color": "#3498DB" }
    ]
  }
}
```

---

#### `PATCH /api/boards/:boardId` 🔒 `[member+]`
Update board title, description, color.

#### `DELETE /api/boards/:boardId` 🔒 `[admin+]`
Archive board (`archived_at = now()`). Hidden from `GET /boards` and `GET /boards/:id` (filters `deletedAt:null`).

#### `PATCH /api/boards/:boardId/unarchive` 🔒 `[member+]`
Restore an archived board (`archived_at = NULL`). Broadcasts `board:unarchived`. Fails if already deleted.

#### `DELETE /api/workspaces/:workspaceId/boards/:boardId/permanent` 🔒 `[owner|admin]`
Permanent delete (sets `deleted_at = now()`). Can be called **directly** on active boards or on archived boards — emits `board:deleted` (workspace + board rooms). Deleted boards are **not retrievable, not restorable, not listed**.

---

### 4.1 Per-User Board Starring

#### `POST /api/boards/:boardId/star` 🔒 `[member+]`
Star a board for the authenticated user (inserts into `user_starred_boards`).

```json
// Response 200
{
  "success": true,
  "data": {
    "boardId": "uuid",
    "isStarred": true,
    "starredAt": "2026-08-08T12:00:00Z"
  }
}
```

---

#### `DELETE /api/boards/:boardId/star` 🔒 `[member+]`
Unstar a board for the authenticated user (deletes from `user_starred_boards`).

```json
// Response 200
{
  "success": true,
  "data": {
    "boardId": "uuid",
    "isStarred": false
  }
}
```

---

### 4.2 Lists

#### `POST /api/boards/:boardId/lists` 🔒 `[member+]`
Create a list. Rank is auto-calculated (appended after last list).

```json
// Request
{ "title": "In Progress" }

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "boardId": "uuid",
    "title": "In Progress",
    "rank": "n"
  }
}
```

---

#### `PATCH /api/boards/:boardId/lists/:listId` 🔒 `[member+]`
Update list title.

#### `PATCH /api/boards/:boardId/lists/:listId/move` 🔒 `[member+]`
Move (reorder) a list.

```json
// Request
{
  "afterListId": "uuid-of-list-to-place-after",  // null = move to first position
  "beforeListId": "uuid-of-list-to-place-before"  // null = move to last position
}
```

#### `DELETE /api/boards/:boardId/lists/:listId` 🔒 `[member+]`
Archive list (`archived_at = now()`). Cards remain but list hidden from board content.

#### `PATCH /api/boards/:boardId/lists/:listId/unarchive` 🔒 `[member+]`
Restore an archived list (`archived_at = NULL`). Broadcasts `list:unarchived`.

#### `GET /api/workspaces/:workspaceId/boards/:boardId/lists/archived` 🔒 `[member+]`
List archived lists (paginated, `archivedAt!=null && deletedAt==null`), `cursor`/`limit`. Each `ListResponseDto` now includes `deletedAt`.

#### `DELETE /api/workspaces/:workspaceId/boards/:boardId/lists/:listId/permanent` 🔒 `[owner|admin]`
Permanent delete (sets `deleted_at`). Can be direct — emits `list:deleted`. Not retrievable.

---

### 4.3 Cards

#### `POST /api/boards/:boardId/lists/:listId/cards` 🔒 `[member+]`
Create a card.

```json
// Request
{
  "title": "Implement JWT authentication",
  "description": { "type": "doc", "content": [...] },
  "dueDate": "2026-08-15T00:00:00Z",
  "assigneeIds": ["uuid1", "uuid2"],
  "labelIds": ["uuid1"]
}
```

---

#### `GET /api/cards/:cardId` 🔒 `[member+]`
Get full card details (including description, comments, attachments).

---

#### `PATCH /api/cards/:cardId` 🔒 `[member+]`
Update card fields (title, description, dueDate, isComplete, assignees, labels).

---

#### `PATCH /api/cards/:cardId/move` 🔒 `[member+]`
Move card to a different position or list.

```json
// Request
{
  "targetListId": "uuid",  // omit if same list
  "afterCardId": "uuid",   // null = first position
  "beforeCardId": "uuid"   // null = last position
}
```

---

#### `DELETE /api/cards/:cardId` 🔒 `[member+]`
Archive card (`archived_at = now()`).

#### `GET /api/workspaces/:workspaceId/boards/:boardId/cards/archived` 🔒 `[member+]`
List archived cards (paginated, `cursor`/`limit`, `archivedAt!=null && deletedAt==null`). Response `PaginatedResult<CardWithDetailsResponseDto>` with `deletedAt`.

#### `PATCH /api/cards/:cardId/unarchive` 🔒 `[member+]`
Restore an archived card. Requires its list to still be active (`422` otherwise). Broadcasts `card:unarchived`.

#### `DELETE /api/workspaces/:workspaceId/boards/:boardId/cards/:cardId/permanent` 🔒 `[owner|admin]`
Permanent delete (sets `deleted_at`). Can be direct — emits `card:deleted`. Not retrievable.

---

### 4.4 Card Comments

#### `POST /api/cards/:cardId/comments` 🔒 `[member+]`
#### `GET /api/cards/:cardId/comments` 🔒 `[member+]`
#### `PATCH /api/comments/:commentId` 🔒 `[author]`
#### `DELETE /api/comments/:commentId` 🔒 `[author|admin+]`

> **@mentions:** comment content may reference users as `@<email>`. On creation the server
> parses mentions against workspace members; matched members receive a `comment_mentioned`
> notification via the async pipeline. Parsing is non-blocking and never
> fails the request.

---

### 4.5 Card Checklists

#### `POST /api/cards/:cardId/checklists` 🔒 `[member+]`
Create a checklist on a card. Rank auto-appended via Lexorank.

```json
// Request
{ "title": "Definition of Done" }

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "cardId": "uuid",
    "title": "Definition of Done",
    "rank": "a",
    "items": []
  }
}
```

---

#### `PATCH /api/cards/:cardId/checklists/:checklistId` 🔒 `[member+]`
Rename a checklist (`{ "title": "..." }`).

#### `DELETE /api/cards/:cardId/checklists/:checklistId` 🔒 `[member+]`
Hard-delete a checklist **and its items** (system data — no soft delete; cascade).

#### `POST /api/cards/:cardId/checklists/:checklistId/items` 🔒 `[member+]`
Add an item to a checklist.

```json
// Request
{ "content": "Unit tests written" }

// Response 201 → ChecklistItemResponseDto
```

---

#### `PATCH /api/cards/:cardId/checklists/:checklistId/items/:itemId` 🔒 `[member+]`
Toggle done or edit content: `{ "content": "...", "isDone": true }`.

#### `DELETE /api/cards/:cardId/checklists/:checklistId/items/:itemId` 🔒 `[member+]`
Remove an item.

---

### 4.6 Labels

Labels belong to the workspace and have a many-to-many relationship with cards.

#### `POST /api/workspaces/:workspaceId/labels` 🔒 `[member+]`
Create a label in the workspace.
- Request body: `{ "name"?: string, "color": "#hex", "cardId"?: string }`
- If optional `cardId` is provided, the newly created label is automatically attached to that card.

#### `GET /api/workspaces/:workspaceId/labels` 🔒 `[viewer+]`
List all labels in the workspace.

#### `GET /api/workspaces/:workspaceId/labels/:labelId/cards` 🔒 `[viewer+]`
Retrieve all active cards across any board in the workspace tagged with this label.

#### `PATCH /api/workspaces/:workspaceId/labels/:labelId` 🔒 `[member+]`
Update label name or color.

#### `DELETE /api/workspaces/:workspaceId/labels/:labelId` 🔒 `[member+]`
Delete a label (cascades removal from card labels).

---

## 5. Document Endpoints

#### `POST /api/workspaces/:workspaceId/documents` 🔒 `[member+]`
Create a new standalone document or linked document.

```json
// Request
{
  "title": "Sprint 23 Retrospective",
  "parentCardId": "uuid"  // optional link to a card
}
```

---

#### `GET /api/workspaces/:workspaceId/documents` 🔒 `[member+]`
List workspace documents.

**Query Params:**
- `search`: Full-text search on `preview_text` (matches within the first 20,000 characters of document body; see `02-database-design.md`)
- `cursor` / `limit`: Pagination

---

#### `GET /api/documents/:documentId` 🔒 `[member+]`
Get document metadata. Content state is synced via WebSocket (Yjs CRDT).

#### `PATCH /api/documents/:documentId` 🔒 `[member+]`
Update document title.

#### `DELETE /api/documents/:documentId` 🔒 `[admin+]`
Archive document.

---

### 5.1 Card Documents

#### `GET /api/cards/:cardId/documents` 🔒 `[member+]`
Get documents linked to a specific card (`parent_card_id = :cardId`).

```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Technical Spec",
      "parentCardId": "card-uuid",
      "createdBy": "user-uuid",
      "createdAt": "2026-08-08T12:00:00Z"
    }
  ]
}
```

---

#### `POST /api/cards/:cardId/documents` 🔒 `[member+]`
Create a document directly attached to a card.

```json
// Request
{
  "title": "Card Technical Specification"
}

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "workspaceId": "uuid",
    "title": "Card Technical Specification",
    "parentCardId": "card-uuid",
    "createdBy": "user-uuid",
    "createdAt": "2026-08-08T12:00:00Z"
  }
}
```

---

### 5.2 Document Snapshots

#### `POST /api/documents/:documentId/snapshots` 🔒 `[member+]`
Create a named snapshot of current Yjs state.

#### `GET /api/documents/:documentId/snapshots` 🔒 `[member+]`
List snapshots for a document.

#### `POST /api/documents/:documentId/snapshots/:snapshotId/restore` 🔒 `[admin+]`
Restore document to a historical snapshot.

---

## 6. Activity Endpoints

#### `GET /api/workspaces/:workspaceId/activity` 🔒 `[member+]`
Get activity feed for workspace.

**Query Params:**
- `entityType`: Filter by entity (`card`, `board`, `document`, `list`, `workspace`, `comment`)
- `entityId`: Filter by specific entity UUID
- `actorId`: Filter by user UUID
- `cursor` / `limit`: Pagination

---

## 7. Notification Endpoints

#### `GET /api/notifications` 🔒
Get notifications for current user.

**Query Params:**
- `unreadOnly`: boolean (default: false)
- `cursor` / `limit`: Pagination

#### `PATCH /api/notifications/:notificationId/read` 🔒
Mark a notification as read.

#### `POST /api/notifications/read-all` 🔒
Mark all notifications as read.

#### `GET /api/notifications/unread-count` 🔒
Get unread notification count (cached in Redis).

---

## 8. File Endpoints

#### `POST /api/files/presigned-upload` 🔒 `[member+]`
Get a presigned S3 URL for direct upload from the client. Creates a `file_attachments` record with status `'pending'`.

```json
// Request
{
  "fileName": "screenshot.png",
  "mimeType": "image/png",
  "fileSize": 245760,
  "entityType": "card",
  "entityId": "uuid"
}

// Response 200
{
  "success": true,
  "data": {
    "fileId": "uuid",
    "uploadUrl": "https://syncboard-files.s3.amazonaws.com/...",
    "s3Key": "workspaces/{wsId}/cards/{cardId}/uuid-screenshot.png",
    "expiresIn": 3600
  }
}
```

---

#### `POST /api/files/:fileId/confirm` 🔒 `[member+]`
Confirm S3 upload completion. Changes status from `'pending'` to `'completed'`.

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "originalName": "screenshot.png",
    "mimeType": "image/png",
    "fileSize": 245760,
    "status": "completed",
    "createdAt": "2026-08-08T12:00:00Z"
  }
}
```

---

#### `GET /api/files/:fileId/download` 🔒 `[member+]`
Get a presigned S3 download URL.

---

#### `GET /api/cards/:cardId/attachments` 🔒 `[member+]`
List file attachments for a specific card.

---

#### `DELETE /api/files/:fileId` 🔒 `[author|admin+]`
Soft-delete (`archived_at`) or purge file attachment.

---

## 9. Health & System

#### `GET /health`
Health check (no auth required).

> [!NOTE]
> This endpoint is **exempt from the standard response envelope** — it returns the raw
> `@nestjs/terminus` format below so load balancers and orchestrators can probe it reliably.

```json
{
  "status": "ok",
  "checks": {
    "database": { "status": "up", "responseTime": "3ms" },
    "redis": { "status": "up", "responseTime": "1ms" },
    "rabbitmq": { "status": "up", "responseTime": "2ms" },
    "disk": { "status": "up", "freeSpace": "15.2 GB" },
    "memory": { "status": "up", "heapUsed": "128 MB" }
  },
  "uptime": "4d 12h 30m"
}
```

---

## 10. Endpoint Summary Table

| Method | Path | Auth | Min Role | Description |
|--------|------|------|----------|-------------|
| POST | `/auth/register` | ❌ | — | Register user |
| POST | `/auth/login` | ❌ | — | Login |
| POST | `/auth/refresh` | ❌ | — | Refresh tokens |
| POST | `/auth/logout` | ✅ | — | Logout |
| POST | `/auth/logout-all` | ✅ | — | Logout all devices |
| POST | `/auth/forgot-password` | ❌ | — | Request password reset email |
| POST | `/auth/reset-password` | ❌ | — | Reset password via token |
| GET | `/auth/google` | ❌ | — | Google OAuth redirect |
| GET | `/auth/google/callback` | ❌ | — | Google OAuth callback |
| GET | `/auth/me` | ✅ | — | Get profile |
| PATCH | `/auth/me` | ✅ | — | Update profile |
| PATCH | `/auth/me/password` | ✅ | — | Change password |
| POST | `/workspaces` | ✅ | — | Create workspace |
| GET | `/workspaces` | ✅ | — | List user workspaces |
| GET | `/workspaces/:id` | ✅ | member | Get workspace by ID |
| GET | `/workspaces/slug/:slug` | ✅ | member | Get workspace by slug |
| PATCH | `/workspaces/:id` | ✅ | admin | Update workspace |
| DELETE | `/workspaces/:id` | ✅ | owner | Archive workspace |
| POST | `/workspaces/:id/leave` | ✅ | member | Leave workspace |
| POST | `/workspaces/:id/transfer-ownership` | ✅ | owner | Transfer ownership |
| GET | `/workspaces/:id/members` | ✅ | member | List members |
| PATCH | `/workspaces/:id/members/:mid` | ✅ | admin | Change member role |
| DELETE | `/workspaces/:id/members/:mid` | ✅ | admin | Remove member |
| POST | `/workspaces/:id/invitations` | ✅ | admin | Send invitation |
| GET | `/workspaces/:id/invitations` | ✅ | admin | List invitations |
| DELETE | `/workspaces/:id/invitations/:iid` | ✅ | admin | Revoke invitation |
| POST | `/invitations/:token/accept` | ✅ | — | Accept invitation |
| POST | `/workspaces/:id/boards` | ✅ | member | Create board |
| GET | `/workspaces/:id/boards` | ✅ | member | List active boards |
| GET | `/boards/:id` | ✅ | member | Get full board |
| PATCH | `/boards/:id` | ✅ | member | Update board |
| DELETE | `/boards/:id` | ✅ | admin | Archive board |
| PATCH | `/boards/:id/unarchive` | ✅ | member | Restore archived board |
| DELETE | `/workspaces/:wid/boards/:bid/permanent` | ✅ | owner/admin | Permanent delete board (direct or archived) |
| GET | `/workspaces/:wid/boards/archived` | ✅ | member | List archived boards (paginated) |
| POST | `/boards/:id/star` | ✅ | member | Star board (per-user) |
| DELETE | `/boards/:id/star` | ✅ | member | Unstar board (per-user) |
| POST | `/boards/:id/lists` | ✅ | member | Create list |
| PATCH | `/boards/:id/lists/:lid` | ✅ | member | Update list |
| PATCH | `/boards/:id/lists/:lid/move` | ✅ | member | Move list |
| DELETE | `/boards/:id/lists/:lid` | ✅ | member | Archive list |
| PATCH | `/boards/:id/lists/:lid/unarchive` | ✅ | member | Restore archived list |
| GET | `/workspaces/:wid/boards/:bid/lists/archived` | ✅ | member | List archived lists (paginated) |
| DELETE | `/workspaces/:wid/boards/:bid/lists/:lid/permanent` | ✅ | owner/admin | Permanent delete list (direct or archived) |
| POST | `/boards/:id/lists/:lid/cards` | ✅ | member | Create card |
| GET | `/cards/:id` | ✅ | member | Get card details |
| PATCH | `/cards/:id` | ✅ | member | Update card |
| PATCH | `/cards/:id/move` | ✅ | member | Move card |
| DELETE | `/cards/:id` | ✅ | member | Archive card |
| PATCH | `/cards/:id/unarchive` | ✅ | member | Restore archived card |
| GET | `/workspaces/:wid/boards/:bid/cards/archived` | ✅ | member | List archived cards (paginated) |
| DELETE | `/workspaces/:wid/boards/:bid/cards/:cid/permanent` | ✅ | owner/admin | Permanent delete card (direct or archived) |
| POST | `/cards/:id/comments` | ✅ | member | Add card comment |
| GET | `/cards/:id/comments` | ✅ | member | List comments |
| PATCH | `/comments/:id` | ✅ | author | Update comment |
| DELETE | `/comments/:id` | ✅ | author/admin | Delete comment |
| POST | `/cards/:id/checklists` | ✅ | member | Create checklist |
| PATCH | `/cards/:id/checklists/:cid` | ✅ | member | Rename checklist |
| DELETE | `/cards/:id/checklists/:cid` | ✅ | member | Delete checklist |
| POST | `/cards/:id/checklists/:cid/items` | ✅ | member | Add checklist item |
| PATCH | `/cards/:id/checklists/:cid/items/:iid` | ✅ | member | Toggle/edit item |
| DELETE | `/cards/:id/checklists/:cid/items/:iid` | ✅ | member | Remove item |
| POST | `/boards/:id/labels` | ✅ | member | Create label |
| PATCH | `/boards/:id/labels/:lid` | ✅ | member | Update label |
| DELETE | `/boards/:id/labels/:lid` | ✅ | admin | Delete label |
| POST | `/workspaces/:id/documents` | ✅ | member | Create document |
| GET | `/workspaces/:id/documents` | ✅ | member | List documents |
| GET | `/documents/:id` | ✅ | member | Get doc metadata |
| PATCH | `/documents/:id` | ✅ | member | Update doc title |
| DELETE | `/documents/:id` | ✅ | admin | Archive document |
| GET | `/cards/:id/documents` | ✅ | member | List card documents |
| POST | `/cards/:id/documents` | ✅ | member | Create card document |
| POST | `/documents/:id/snapshots` | ✅ | member | Create snapshot |
| GET | `/documents/:id/snapshots` | ✅ | member | List snapshots |
| POST | `/documents/:id/snapshots/:sid/restore` | ✅ | admin | Restore snapshot |
| GET | `/workspaces/:id/activity` | ✅ | member | Get activity feed |
| GET | `/notifications` | ✅ | — | Get user notifications |
| PATCH | `/notifications/:id/read` | ✅ | — | Mark notification read |
| POST | `/notifications/read-all` | ✅ | — | Mark all read |
| GET | `/notifications/unread-count` | ✅ | — | Get unread count |
| POST | `/files/presigned-upload` | ✅ | member | Request upload URL |
| POST | `/files/:id/confirm` | ✅ | member | Confirm S3 upload |
| GET | `/files/:id/download` | ✅ | member | Request download URL |
| GET | `/cards/:id/attachments` | ✅ | member | List card attachments |
| DELETE | `/files/:id` | ✅ | author/admin | Delete attachment |
| GET | `/health` | ❌ | — | Health check |

### 10.1 Card Enrichment endpoints

Base: `/api/workspaces/:wid/boards/:bid`. All cursor pages return `{ items, pagination }`.

| Method | Path | Role | Notes |
|--------|------|------|-------|
| PATCH | `/cards/:id/priority` | member | `{ priority: lowest\|low\|medium\|high\|urgent }` → `card.priority_changed` |
| PATCH | `/cards/:id/status` | member | `{ status: not_started\|active\|done\|closed }` → `card.status_changed` (derives `isComplete`) |
| POST | `/cards/:parentId/subcards` | member | Create subcard (same board, depth ≤ 2) → 201 |
| POST | `/cards/:parentId/subcards/:subId` | member | Attach existing → 204 |
| DELETE | `/cards/:subId/parent` | member | Detach → 204 |
| GET | `/cards/:id/with-subcards` | viewer | Parent + active subcards + rollup `{total,done,estimateSum,loggedSum}` |
| POST | `/cards/:id/checklists/:cid/items/:iid/promote` | member | Checklist item → subcard → 201 |
| POST | `/cards/:id/links` | member | `{ toCardId, type: relates_to\|blocks\|blocked_by\|duplicates }` → 201 |
| GET | `/cards/:id/links` | viewer | `{ outgoing, incoming }` (`blocked_by` mirrored, not stored twice) |
| DELETE | `/cards/:id/links/:linkId` | member | → 204 |
| GET | `/cards/:id/blocking` | viewer | Cards blocking this card (source not done/closed) |
| PATCH | `/cards/:id/estimate` | member | `{ estimateMinutes: 0..100000 }` |
| POST | `/cards/:id/time` | member | `{ minutes: 1..1440, note? ≤500 }` → 201, `card.time_logged` |
| GET | `/cards/:id/time` | viewer | Tracking `{ estimate, logged, remaining }` + entries (cursor) |
| GET | `/cards/:id/comments/:cid/replies` | viewer | One-level thread (unbounded small, unpaginated) |
| GET/POST | `/workspaces/:wid/field-defs` | viewer/admin+write | Custom field defs |
| GET/PUT | `.../cards/:id/fields[/:fieldId]` | viewer/member+write | Field values |
| GET/POST/DELETE | `/workspaces/:wid/templates[/:id]` | viewer/member+/admin | Templates; `POST .../:id/instantiate/lists/:lid` → 201 |
| GET | `.../boards/:bid/views/calendar?from&to` | viewer | `dueDate` range ≤366d, cursor |
| GET | `.../boards/:bid/views/timeline` | viewer | `createdAt` order, cursor |
| GET | `.../boards/:bid/views/table?status&priority&assigneeId` | viewer | Flat filtered page |
