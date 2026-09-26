# Workspace Module — Manual Test Cases

> **Base URL:** `http://localhost:3000/api`
> **Module:** `src/modules/workspace`
> **Endpoints prefix:** `/workspaces`
> **Automated E2E Test Suite:** `test/e2e/workspace.e2e-spec.ts`
>
> **Invitation token invariant (all §12–§15 rows):** the REST `POST …/invitations` response carries
> `token` = **SHA-256 hash** of the raw token (64 hex chars, per `WorkspaceInvitationResponseDto`).
> The RAW token is delivered ONLY via the invitation email (MailHog link) and is what `POST
> /workspaces/invitations/accept` accepts. E2E specs obtain the raw token via the MailHog helper.
> `POST /workspaces/invitations/accept` returns `200 OK` (HttpCode.OK), NOT 201.

---

## Table of Contents

1. [Create Workspace (`POST /workspaces`)](#1-create-workspace)
2. [List My Workspaces (`GET /workspaces`)](#2-list-my-workspaces)
3. [Get Workspace by Slug (`GET /workspaces/slug/:slug`)](#3-get-workspace-by-slug)
4. [Get Workspace by ID (`GET /workspaces/:workspaceId`)](#4-get-workspace-by-id)
5. [Update Workspace (`PATCH /workspaces/:workspaceId`)](#5-update-workspace)
6. [Archive Workspace (`DELETE /workspaces/:workspaceId`)](#6-archive-workspace)
7. [Leave Workspace (`DELETE /workspaces/:workspaceId/leave`)](#7-leave-workspace)
8. [Transfer Ownership (`POST /workspaces/:workspaceId/transfer-ownership`)](#8-transfer-ownership)
9. [List Members (`GET /workspaces/:workspaceId/members`)](#9-list-members)
10. [Update Member Role (`PATCH /workspaces/:workspaceId/members/:memberId`)](#10-update-member-role)
11. [Remove Member (`DELETE /workspaces/:workspaceId/members/:memberId`)](#11-remove-member)
12. [Invite Member (`POST /workspaces/:workspaceId/invitations`)](#12-invite-member)
13. [List Invitations (`GET /workspaces/:workspaceId/invitations`)](#13-list-invitations)
14. [Accept Invitation (`POST /workspaces/invitations/accept`)](#14-accept-invitation)
15. [Revoke Invitation (`DELETE /workspaces/:workspaceId/invitations/:invitationId`)](#15-revoke-invitation)
16. [Cross-Cutting Concerns](#16-cross-cutting-concerns)

---

## 1. Create Workspace

**Endpoint:** `POST /workspaces`
**Guards:** `JwtAuthGuard` (no workspace role check — any authenticated user)

### 1.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1.1.1 | Create with name only | `{ "name": "Engineering Team" }` | `201 Created` | Returns `Workspace` with auto-generated `slug`, `ownerId` = current user, `archivedAt: null`. Creator added as `owner` member. |
| 1.1.2 | Create with all fields | `{ "name": "Design Team", "description": "UI/UX workspace", "avatarUrl": "https://example.com/avatar.png" }` | `201 Created` | All fields set correctly |
| 1.1.3 | Name is trimmed | `{ "name": "  Engineering  " }` | `201 Created` | Name stored as `Engineering` |
| 1.1.4 | Description is trimmed | `{ "name": "Test", "description": "  Hello  " }` | `201 Created` | Description stored as `Hello` |
| 1.1.5 | Slug auto-generated from name | `{ "name": "My Cool Workspace!" }` | `201 Created` | Slug is `my-cool-workspace` (lowercased, special chars removed, spaces to hyphens) |
| 1.1.6 | Slug handles special characters | `{ "name": "Prøject @#$ Board" }` | `201 Created` | Non-alphanumeric chars stripped; produces clean slug |
| 1.1.7 | Slug collision resolved with suffix | Workspace with slug `engineering-team` already exists | `201 Created` | Slug becomes `engineering-team-<random_hex>` |
| 1.1.8 | Max name length (100 chars) | `{ "name": "<100 chars>" }` | `201 Created` | Accepted |
| 1.1.9 | Min name length (2 chars) | `{ "name": "AB" }` | `201 Created` | Accepted |

### 1.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 1.2.1 | Missing name | `{ "description": "test" }` | `400` | name is required |
| 1.2.2 | Name too short (< 2 chars) | `{ "name": "A" }` | `400` | minLength violation |
| 1.2.3 | Name too long (> 100 chars) | `{ "name": "<101 chars>" }` | `400` | maxLength exceeded |
| 1.2.4 | Description too long (> 500 chars) | `{ "name": "OK", "description": "<501 chars>" }` | `400` | maxLength exceeded |
| 1.2.5 | Invalid avatarUrl | `{ "name": "OK", "avatarUrl": "not-a-url" }` | `400` | Must be valid URL |
| 1.2.6 | Empty body | `{}` | `400` | name is required |
| 1.2.7 | Name is whitespace only | `{ "name": "   " }` | `400` | After trim, empty → minLength violation |

### 1.3 Unauthorized

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 1.3.1 | No Bearer token | Missing `Authorization` header | `401` |

### 1.4 Slug Edge Cases

| # | Test Case | Precondition | Expected |
|---|-----------|-------------|----------|
| 1.4.1 | Name with only special chars | `{ "name": "!!!@@@###" }` | `201 Created` — falls back to slug `workspace` |
| 1.4.2 | Slug collision max retries exceeded | 3 consecutive slug collisions | `422` — `SLUG_COLLISION` business rule exception |
| 1.4.3 | Duplicate name, unique slug | Two workspaces named "Test" | Both created with different slugs |

### 1.5 Events

| # | Test Case | Expected Event |
|---|-----------|----------------|
| 1.5.1 | Workspace created event | `workspace.created` with `WorkspaceCreatedEvent(workspace, userId)` |

### 1.6 Ownership

| # | Test Case | Expected |
|---|-----------|----------|
| 1.6.1 | Creator is owner member | After create, `WorkspaceMember` with `role: owner` exists for creator |
| 1.6.2 | Creator is workspace.ownerId | `workspace.ownerId` = creator's `userId` |

---

## 2. List My Workspaces

**Endpoint:** `GET /workspaces`
**Guards:** `JwtAuthGuard`

### 2.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 2.1.1 | User with workspaces | User is member of 3 workspaces | `200 OK` | Array of 3 `WorkspaceWithRole` items, each including `role` field |
| 2.1.2 | User with no workspaces | User has no memberships | `200 OK` | Empty array `[]` |
| 2.1.3 | Archived workspaces excluded | 2 active + 1 archived | `200 OK` | Array of 2 workspaces |
| 2.1.4 | Role included per workspace | User is owner in WS1, member in WS2 | `200 OK` | WS1: `role: "owner"`, WS2: `role: "member"` |

### 2.2 Unauthorized

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 2.2.1 | No Bearer token | Missing auth header | `401` |

---

## 3. Get Workspace by Slug

**Endpoint:** `GET /workspaces/slug/:slug`
**Guards:** `JwtAuthGuard`

> [!IMPORTANT]
> This route MUST be declared BEFORE `GET /workspaces/:workspaceId` to avoid NestJS pattern matching treating `slug` as a UUID parameter.

### 3.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 3.1.1 | Get workspace by valid slug | User is a member, slug exists | `200 OK` | `WorkspaceWithRole` with correct `role` field |
| 3.1.2 | Different roles reflected | User is `admin` in workspace | `200 OK` | `role: "admin"` |

### 3.2 Not Found (404)

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 3.2.1 | Non-existent slug | Slug doesn't match any workspace | `404` |
| 3.2.2 | Archived workspace slug | Workspace is archived | `404` |

### 3.3 Forbidden (403)

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 3.3.1 | Non-member access by slug | User is not a member of the workspace | `403` |

### 3.4 Edge Cases

| # | Test Case | URL | Expected |
|---|-----------|-----|----------|
| 3.4.1 | Slug with hyphens | `GET /workspaces/slug/my-cool-workspace` | `200 OK` if exists |
| 3.4.2 | Slug with hex suffix | `GET /workspaces/slug/test-ab12cd` | `200 OK` if exists |
| 3.4.3 | Empty slug | `GET /workspaces/slug/` | `404` or route mismatch |

---

## 4. Get Workspace by ID

**Endpoint:** `GET /workspaces/:workspaceId`
**Allowed Roles:** `owner`, `admin`, `member`, `viewer` (via `@WorkspaceAuth`)

### 4.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 4.1.1 | Get workspace by ID | User is a member | `200 OK` | `WorkspaceWithRole` with `role` field |
| 4.1.2 | All roles can access | viewer, member, admin, owner | `200 OK` | Workspace details returned |

### 4.2 Not Found (404)

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 4.2.1 | Non-existent workspaceId | UUID doesn't match any workspace | `404` |
| 4.2.2 | Archived workspace | Workspace has `archivedAt` set | `404` |

### 4.3 Authorization

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 4.3.1 | Non-member | User not in workspace | `403` |
| 4.3.2 | No Bearer token | Missing auth | `401` |

### 4.4 Invalid Params

| # | Test Case | URL | Expected Status |
|---|-----------|-----|-----------------|
| 4.4.1 | Invalid UUID | `GET /workspaces/not-a-uuid` | `400` |

---

## 5. Update Workspace

**Endpoint:** `PATCH /workspaces/:workspaceId`
**Allowed Roles:** `owner`, `admin`

### 5.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 5.1.1 | Update name | `{ "name": "New Name" }` | `200 OK` | Name updated, slug regenerated to match new name |
| 5.1.2 | Update description only | `{ "description": "New desc" }` | `200 OK` | Description updated, slug unchanged |
| 5.1.3 | Update avatarUrl | `{ "avatarUrl": "https://example.com/new.png" }` | `200 OK` | Avatar updated |
| 5.1.4 | Update all fields | `{ "name": "New", "description": "Desc" }` | `200 OK` | All updated |
| 5.1.5 | Same name (no slug change) | `{ "name": "<current_name>" }` | `200 OK` | Slug remains the same (name === existing name check) |
| 5.1.6 | Empty body | `{}` | `200 OK` | No changes, workspace returned as-is |

### 5.2 Slug Regeneration

| # | Test Case | Precondition | Expected |
|---|-----------|-------------|----------|
| 5.2.1 | Name change triggers slug regen | Name changed from "Team A" to "Team B" | Slug changes to `team-b` |
| 5.2.2 | Slug collision handled | New slug already taken | Slug gets random suffix |
| 5.2.3 | Slug collision max retries | 3 consecutive collisions | `422 SLUG_COLLISION` |

### 5.3 Not Found (404)

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 5.3.1 | Non-existent workspace | UUID doesn't exist | `404` |
| 5.3.2 | Archived workspace | Workspace is archived | `404` |

### 5.4 Authorization

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 5.4.1 | Member cannot update | User is `member` | `403 Forbidden` |
| 5.4.2 | Viewer cannot update | User is `viewer` | `403 Forbidden` |
| 5.4.3 | Admin can update | User is `admin` | `200 OK` |
| 5.4.4 | Owner can update | User is `owner` | `200 OK` |

---

## 6. Archive Workspace

**Endpoint:** `DELETE /workspaces/:workspaceId`
**Allowed Roles:** `owner` only

### 6.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 6.1.1 | Archive workspace | Owner archives active workspace | `204 No Content` | `archivedAt` set to current timestamp |
| 6.1.2 | Workspace disappears from list | After archiving | — | Not returned by `GET /workspaces` |

### 6.2 Not Found

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 6.2.1 | Non-existent workspace | UUID doesn't exist | `404` |
| 6.2.2 | Already archived | Workspace already archived | `404` |

### 6.3 Authorization

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 6.3.1 | Admin cannot archive | User is `admin` | `403 Forbidden` |
| 6.3.2 | Member cannot archive | User is `member` | `403 Forbidden` |
| 6.3.3 | Viewer cannot archive | User is `viewer` | `403 Forbidden` |

---

## 7. Leave Workspace

**Endpoint:** `DELETE /workspaces/:workspaceId/leave`
**Allowed Roles:** `owner`, `admin`, `member`, `viewer`

### 7.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 7.1.1 | Member leaves workspace | User is `member` | `204 No Content` | `WorkspaceMember` record deleted. Event emitted. |
| 7.1.2 | Viewer leaves workspace | User is `viewer` | `204 No Content` | Member record removed |
| 7.1.3 | Admin leaves workspace | User is `admin` | `204 No Content` | Member record removed |
| 7.1.4 | Owner leaves (multiple owners) | 2 owners exist, one leaves | `204 No Content` | Remaining owner becomes workspace.ownerId if needed |

### 7.2 Business Rule Violations (422)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 7.2.1 | Sole owner cannot leave | User is the only `owner` | `422` | `CANNOT_LEAVE_AS_SOLE_OWNER: Sole owner must transfer ownership before leaving the workspace` |

### 7.3 Ownership Reassignment

| # | Test Case | Precondition | Expected |
|---|-----------|-------------|----------|
| 7.3.1 | workspace.ownerId reassigned | Leaving owner is `workspace.ownerId`, another owner exists | `workspace.ownerId` updated to next owner |
| 7.3.2 | Non-primary owner leaves | Leaving owner is NOT `workspace.ownerId` | `workspace.ownerId` unchanged |

### 7.4 Not Found

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 7.4.1 | Not a member | User has no membership | `403 Forbidden` (corrected 2026-08-30: `WorkspaceAuth` → `FORBIDDEN`; previously documented as 404) |

### 7.5 Events

| # | Test Case | Expected Event |
|---|-----------|----------------|
| 7.5.1 | Member removed event | `workspace.member_removed` with `WorkspaceMemberRemovedEvent(workspaceId, userId)` |

---

## 8. Transfer Ownership

**Endpoint:** `POST /workspaces/:workspaceId/transfer-ownership`
**Allowed Roles:** `owner` only

### 8.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 8.1.1 | Transfer to admin member | `{ "newOwnerId": "<adminUserId>" }` | `200 OK` | Target becomes `owner`. Current owner demoted to `admin`. `workspace.ownerId` updated. Returns updated target member. |
| 8.1.2 | Transfer to regular member | `{ "newOwnerId": "<memberUserId>" }` | `200 OK` | Same behavior — target promoted to owner |
| 8.1.3 | Transfer to viewer | `{ "newOwnerId": "<viewerUserId>" }` | `200 OK` | Viewer promoted to owner |

### 8.2 Business Rule Violations (422)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 8.2.1 | Target is not a workspace member | `newOwnerId` is not a member | `422` | `TARGET_NOT_MEMBER` |

### 8.3 Forbidden (403)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 8.3.1 | Non-owner attempts transfer | Current user is `admin` | `403` | `Only current workspace owner can transfer ownership` |

### 8.4 Validation Errors

| # | Test Case | Request Body | Expected Status |
|---|-----------|-------------|-----------------|
| 8.4.1 | Missing newOwnerId | `{}` | `400` |
| 8.4.2 | Invalid UUID | `{ "newOwnerId": "not-uuid" }` | `400` |

### 8.5 Edge Cases

| # | Test Case | Precondition | Expected |
|---|-----------|-------------|----------|
| 8.5.1 | Transfer to self | `newOwnerId` = current user | May succeed (self-transfer is a no-op role-wise) or business rule |
| 8.5.2 | Transfer is transactional | DB error mid-transfer | No partial state — both role changes roll back |

---

## 9. List Members

**Endpoint:** `GET /workspaces/:workspaceId/members`
**Allowed Roles:** `owner`, `admin`, `member`, `viewer`

### 9.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 9.1.1 | List all members | Workspace has 4 members | `200 OK` | Array of 4 `MemberWithUser` items with user details (id, email, displayName, avatarUrl) and `role`, `joinedAt` |
| 9.1.2 | Single member workspace | Only the owner | `200 OK` | Array of 1 member |
| 9.1.3 | Viewer can list members | User is `viewer` | `200 OK` | Members returned |

### 9.2 Not Found

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 9.2.1 | Non-existent workspace | UUID doesn't exist | `404` |

---

## 10. Update Member Role

**Endpoint:** `PATCH /workspaces/:workspaceId/members/:memberId`
**Allowed Roles:** `owner`, `admin`

### 10.1 Happy Path

| # | Test Case | Request Body | Precondition | Expected Status | Expected Behavior |
|---|-----------|-------------|-------------|-----------------|-------------------|
| 10.1.1 | Owner promotes member to admin | `{ "role": "admin" }` | Actor is `owner` | `200 OK` | Member role updated to `admin` |
| 10.1.2 | Owner demotes admin to member | `{ "role": "member" }` | Actor is `owner` | `200 OK` | Admin becomes member |
| 10.1.3 | Owner promotes to owner | `{ "role": "owner" }` | Actor is `owner` | `200 OK` | Member becomes co-owner |
| 10.1.4 | Admin promotes member to admin | `{ "role": "admin" }` | Actor is `admin` | `200 OK` | Member promoted |
| 10.1.5 | Admin changes member to viewer | `{ "role": "viewer" }` | Actor is `admin`, target is `member` | `200 OK` | Role changed |

### 10.2 Forbidden (403)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 10.2.1 | Admin cannot modify owner | Actor is `admin`, target is `owner` | `403` | `Admins cannot modify the role of a workspace owner` |
| 10.2.2 | Admin cannot promote to owner | Actor is `admin`, `{ "role": "owner" }` | `403` | `Only workspace owners can promote members to owner` |

### 10.3 Business Rule Violations (422)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 10.3.1 | Cannot demote sole owner | Only 1 owner, attempt to change to `member` | `422` | `CANNOT_REMOVE_OWNER: Cannot demote the sole owner` |

### 10.4 Not Found (404)

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 10.4.1 | Non-existent memberId | Member doesn't exist | `404` |
| 10.4.2 | Member from different workspace | memberId exists but in another workspace | `404` |

### 10.5 Ownership Reassignment

| # | Test Case | Precondition | Expected |
|---|-----------|-------------|----------|
| 10.5.1 | Demoting primary owner (multiple owners) | Owner is `workspace.ownerId`, 2 owners exist | `workspace.ownerId` reassigned to other owner |
| 10.5.2 | Demoting non-primary owner | Owner is NOT `workspace.ownerId` | `workspace.ownerId` unchanged |

### 10.6 Events

| # | Test Case | Expected Event |
|---|-----------|----------------|
| 10.6.1 | Role change event | `workspace.member_role_changed` with `WorkspaceMemberRoleChangedEvent(workspaceId, userId, oldRole, newRole)` |

### 10.7 Validation

| # | Test Case | Request Body | Expected Status |
|---|-----------|-------------|-----------------|
| 10.7.1 | Invalid role enum | `{ "role": "superadmin" }` | `400` |
| 10.7.2 | Missing role | `{}` | `400` |
| 10.7.3 | Invalid memberId (not UUID) | URL: `members/not-uuid` | `400` |

---

## 11. Remove Member

**Endpoint:** `DELETE /workspaces/:workspaceId/members/:memberId`
**Allowed Roles:** `owner`, `admin`

### 11.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 11.1.1 | Owner removes a member | Target is `member` | `204 No Content` | `WorkspaceMember` deleted |
| 11.1.2 | Owner removes an admin | Target is `admin` | `204 No Content` | Member removed |
| 11.1.3 | Admin removes a member | Target is `member`, actor is `admin` | `204 No Content` | Member removed |
| 11.1.4 | Admin removes a viewer | Target is `viewer` | `204 No Content` | Member removed |

### 11.2 Forbidden (403)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 11.2.1 | Admin cannot remove owner | Actor is `admin`, target is `owner` | `403` | `Admins cannot remove a workspace owner` |

### 11.3 Business Rule Violations (422)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 11.3.1 | Cannot remove sole owner | Only 1 owner exists | `422` | `CANNOT_REMOVE_OWNER` |

### 11.4 Ownership Reassignment

| # | Test Case | Precondition | Expected |
|---|-----------|-------------|----------|
| 11.4.1 | Removing primary owner (multiple owners) | Target is `workspace.ownerId`, 2 owners | `workspace.ownerId` reassigned |
| 11.4.2 | Removing non-primary owner | Target is co-owner, not `workspace.ownerId` | `workspace.ownerId` unchanged |

### 11.5 Not Found

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 11.5.1 | Non-existent memberId | Member doesn't exist | `404` |
| 11.5.2 | Member in different workspace | memberId from another workspace | `404` |

### 11.6 Events

| # | Test Case | Expected Event |
|---|-----------|----------------|
| 11.6.1 | Member removed event | `workspace.member_removed` with `WorkspaceMemberRemovedEvent(workspaceId, userId)` |

---

## 12. Invite Member

**Endpoint:** `POST /workspaces/:workspaceId/invitations`
**Allowed Roles:** `owner`, `admin`

### 12.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 12.1.1 | Owner invites with member role | `{ "email": "new@example.com", "role": "member" }` | `201 Created` | Returns `WorkspaceInvitationWithInviter` with `status: "pending"`, `expiresAt` (7 days), inviter details |
| 12.1.2 | Owner invites with admin role | `{ "email": "new@example.com", "role": "admin" }` | `201 Created` | Invitation created with admin role |
| 12.1.3 | Owner invites with viewer role | `{ "email": "new@example.com", "role": "viewer" }` | `201 Created` | Invitation created |
| 12.1.4 | Owner invites with owner role | `{ "email": "new@example.com", "role": "owner" }` | `201 Created` | Invitation created (owners can invite any role) |
| 12.1.5 | Admin invites with member role | `{ "email": "new@example.com", "role": "member" }` | `201 Created` | Invitation created |
| 12.1.6 | Admin invites with viewer role | `{ "email": "new@example.com", "role": "viewer" }` | `201 Created` | Invitation created |
| 12.1.7 | Email lowercased and trimmed | `{ "email": "  USER@Example.COM  ", "role": "member" }` | `201 Created` | Stored as `user@example.com` |
| 12.1.8 | Invite non-registered email | Email not in user table | `201 Created` | Invitation created (user doesn't need to exist) |

### 12.2 Forbidden (403)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 12.2.1 | Admin invites with owner role | Actor is `admin`, `{ "role": "owner" }` | `403` | `Admins can only invite members with role member or viewer` |
| 12.2.2 | Admin invites with admin role | Actor is `admin`, `{ "role": "admin" }` | `403` | `Admins can only invite members with role member or viewer` |

### 12.3 Business Rule Violations (422)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 12.3.1 | Email already a member | User with email is already in workspace | `422` | `ALREADY_A_MEMBER` |
| 12.3.2 | Pending invitation exists | Active pending invitation for same email + workspace | `422` | `INVITATION_ALREADY_SENT` |

### 12.4 Validation Errors (400)

| # | Test Case | Request Body | Expected Status |
|---|-----------|-------------|-----------------|
| 12.4.1 | Missing email | `{ "role": "member" }` | `400` |
| 12.4.2 | Invalid email format | `{ "email": "not-email", "role": "member" }` | `400` |
| 12.4.3 | Email too long (> 255) | `{ "email": "<256 chars>", "role": "member" }` | `400` |
| 12.4.4 | Missing role | `{ "email": "test@test.com" }` | `400` |
| 12.4.5 | Invalid role enum | `{ "email": "test@test.com", "role": "superadmin" }` | `400` |

### 12.5 Token Security

| # | Test Case | Expected |
|---|-----------|----------|
| 12.5.1 | Token stored as SHA-256 hash | DB `token` column contains hash, not raw token |
| 12.5.2 | Raw token emitted in event | Event contains unhashed raw token (for email link) |
| 12.5.3 | Invitation expires in 7 days | `expiresAt` = `now + 7 days` |

### 12.6 Events

| # | Test Case | Expected Event |
|---|-----------|----------------|
| 12.6.1 | Invitation created event | `workspace.invitation_created` with `WorkspaceInvitationCreatedEvent(workspaceId, email, invitedBy, rawToken)` |

---

## 13. List Invitations

**Endpoint:** `GET /workspaces/:workspaceId/invitations`
**Allowed Roles:** `owner`, `admin`

### 13.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 13.1.1 | List pending invitations | 3 pending invitations | `200 OK` | Array of 3 `WorkspaceInvitationWithInviter` items including inviter details |
| 13.1.2 | No invitations | No pending invitations | `200 OK` | Empty array `[]` |
| 13.1.3 | Only pending shown | Mix of pending, accepted, revoked, expired | `200 OK` | Only `status: "pending"` invitations returned |

### 13.2 Authorization

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 13.2.1 | Member cannot list invitations | User is `member` | `403 Forbidden` |
| 13.2.2 | Viewer cannot list invitations | User is `viewer` | `403 Forbidden` |

---

## 14. Accept Invitation

**Endpoint:** `POST /workspaces/invitations/accept`
**Guards:** `JwtAuthGuard` (no workspace role — any authenticated user)

### 14.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 14.1.1 | Accept valid invitation | `{ "token": "<valid_raw_token>" }` | `200 OK` | Returns new `WorkspaceMember`. Invitation status → `accepted`. `acceptedAt` set. |
| 14.1.2 | User joins with invited role | Invitation has `role: "admin"` | `200 OK` | New member has `role: "admin"` |
| 14.1.3 | Atomic transaction | Create member + update invitation | — | Both operations succeed or both fail |

### 14.2 Business Rule Violations (422)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 14.2.1 | Invalid token | Token doesn't exist in DB | `422` | `INVITATION_EXPIRED` |
| 14.2.2 | Expired invitation | `expiresAt < now()` | `422` | `INVITATION_EXPIRED` |
| 14.2.3 | Already-accepted invitation | `status = "accepted"` | `422` | `INVITATION_EXPIRED` |
| 14.2.4 | Revoked invitation | `status = "revoked"` | `422` | `INVITATION_EXPIRED` |
| 14.2.5 | Email mismatch | Logged-in user's email ≠ invitation email | `422` | `INVITATION_EMAIL_MISMATCH` |
| 14.2.6 | Already a member | User is already in workspace | `422` | `ALREADY_A_MEMBER` |
| 14.2.7 | Target workspace archived | Workspace has been archived since invite | `422` | `INVITATION_EXPIRED` |

### 14.3 Validation

| # | Test Case | Request Body | Expected Status |
|---|-----------|-------------|-----------------|
| 14.3.1 | Missing token | `{}` | `400` |
| 14.3.2 | Token too long (> 255) | `{ "token": "<256 chars>" }` | `400` |

### 14.4 Events

| # | Test Case | Expected Event |
|---|-----------|----------------|
| 14.4.1 | Member added event | `workspace.member_added` with `WorkspaceMemberAddedEvent(workspaceId, userId, role)` |

### 14.5 Edge Cases

| # | Test Case | Precondition | Expected |
|---|-----------|-------------|----------|
| 14.5.1 | Token is trimmed | `{ "token": "  <token>  " }` | Token trimmed before lookup |
| 14.5.2 | Case-insensitive email match | Invitation for `User@Test.com`, logged in as `user@test.com` | Should match (both lowercased in comparison) |

---

## 15. Revoke Invitation

**Endpoint:** `DELETE /workspaces/:workspaceId/invitations/:invitationId`
**Allowed Roles:** `owner`, `admin`

### 15.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 15.1.1 | Revoke pending invitation | Invitation is `pending` | `204 No Content` | Invitation `status` → `revoked` |
| 15.1.2 | Revoked invitation cannot be accepted | After revoking, try accepting | — | `422 INVITATION_EXPIRED` |

### 15.2 Not Found (404)

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 15.2.1 | Non-existent invitationId | ID doesn't exist | `404` |
| 15.2.2 | Invitation in different workspace | `workspaceId` mismatch | `404` |
| 15.2.3 | Already-accepted invitation | `status = "accepted"` (not pending) | `404` |
| 15.2.4 | Already-revoked invitation | `status = "revoked"` | `404` |

### 15.3 Invalid Params

| # | Test Case | URL | Expected Status |
|---|-----------|-----|-----------------|
| 15.3.1 | Invalid invitationId | `invitations/not-uuid` | `400` |

---

## 16. Cross-Cutting Concerns

### 16.1 UUID Validation (All Parameterized Endpoints)

| # | Test Case | Parameter | Expected Status |
|---|-----------|-----------|-----------------|
| 16.1.1 | workspaceId not UUID | `"abc"` | `400 Bad Request` |
| 16.1.2 | memberId not UUID | `"xyz"` | `400 Bad Request` |
| 16.1.3 | invitationId not UUID | `"123"` | `400 Bad Request` |

### 16.2 WorkspaceAuth Decorator

| # | Test Case | Expected |
|---|-----------|----------|
| 16.2.1 | Chains JwtAuthGuard → WorkspaceMemberGuard → RbacGuard | Guards applied in order |
| 16.2.2 | 401 if no JWT | Unauthenticated request rejected |
| 16.2.3 | 403 if not workspace member | Non-member rejected |
| 16.2.4 | 403 if role insufficient | Lower role rejected |
| 16.2.5 | Swagger annotations applied | `@ApiBearerAuth()` and 401/403 responses documented |

### 16.3 Workspace Soft-Delete Behavior

| # | Test Case | Expected |
|---|-----------|----------|
| 16.3.1 | Archived workspace excluded from queries | `findById` returns `null` for archived workspaces |
| 16.3.2 | Archived workspace excluded from user list | `GET /workspaces` omits archived |
| 16.3.3 | Cannot access archived workspace by ID | `GET /workspaces/:id` → `404` |
| 16.3.4 | Cannot invite to archived workspace | Invitation fails |

### 16.4 Data Isolation

| # | Test Case | Expected |
|---|-----------|----------|
| 16.4.1 | Members of workspace A not visible in B | Each workspace has independent member list |
| 16.4.2 | Invitations scoped to workspace | Invitations only visible within their workspace |
| 16.4.3 | User sees only their own workspaces | `GET /workspaces` returns only workspaces user is member of |

### 16.5 Concurrent Operations

| # | Test Case | Action | Expected |
|---|-----------|--------|----------|
| 16.5.1 | Concurrent slug generation | Two users create workspaces with same name simultaneously | Both succeed with unique slugs |
| 16.5.2 | Concurrent invitation acceptance | Same invitation accepted twice concurrently | Only one succeeds; other gets `ALREADY_A_MEMBER` |
| 16.5.3 | Transfer ownership atomicity | Transfer fails midway | Transaction rolls back — no partial state |

### 16.6 Event Emissions Summary

| Endpoint | Event Name | Event Payload |
|----------|-----------|---------------|
| Create Workspace | `workspace.created` | `WorkspaceCreatedEvent(workspace, userId)` |
| Leave Workspace | `workspace.member_removed` | `WorkspaceMemberRemovedEvent(workspaceId, userId)` |
| Remove Member | `workspace.member_removed` | `WorkspaceMemberRemovedEvent(workspaceId, userId)` |
| Update Member Role | `workspace.member_role_changed` | `WorkspaceMemberRoleChangedEvent(workspaceId, userId, oldRole, newRole)` |
| Invite Member | `workspace.invitation_created` | `WorkspaceInvitationCreatedEvent(workspaceId, email, invitedBy, rawToken)` |
| Accept Invitation | `workspace.member_added` | `WorkspaceMemberAddedEvent(workspaceId, userId, role)` |

---

## 17. Combined & End-to-End Scenarios

> Automation legend — each row maps to `test/e2e/workspace.e2e-spec.ts` per `e2e-test-generation.md`
> §4: 17.1 invite→register auto-join (partial: registration auto-join requires pre-user invitations;
> the accept flow is automated) · 17.2 and 17.3 are automated (ownership chain, role resolution is
> per-request) · 17.4 slug-collision storm automated · 17.5 concurrent role ops pending · 17.6 archive
> isolation sweep automated at board level · 17.7 cross-module fanout blocked (P6).

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 17.1 | Invite→register auto-join | invite unregistered email; that email registers | pending invitations auto-accepted on signup; register response lists joinedWorkspaces; token accept endpoint then returns ALREADY_A_MEMBER |
| 17.2 | Ownership transfer chain | owner transfers to admin → original owner leaves → new owner archives workspace | every step's business rules hold (leave allowed only after transfer); archive cascades visibility |
| 17.3 | Role change mid-session | demote admin→member while their JWT still valid | next privileged call 403 (roles resolved per-request, never from stale claims) |
| 17.4 | Slug collision storm | create workspaces named identically ×5 via API | unique slugs with suffixes; all resolvable by slug |
| 17.5 | Concurrent role ops race | two admins simultaneously update/remove same member | one succeeds, other gets deterministic 404/409 — no partial state |
| 17.6 | Workspace archive isolation sweep | after archive: boards/cards invisible in listings, direct GETs behave per soft-delete rules, members cannot create content | enforced uniformly across modules |
| 17.7 | Cross-module notification fanout | invite + assign + mention same user rapidly | exactly one notification per trigger type; unread count matches REST exactly (see test-cases-notifications) |
