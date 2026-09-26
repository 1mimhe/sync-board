# Auth Module — Manual Test Cases

> **Base URL:** `http://localhost:3000/api`
> **Module:** `src/modules/auth`
> **Endpoints prefix:** `/auth`
> **Automated E2E Test Suite:** `test/e2e/auth.e2e-spec.ts`
>
> **Endpoint Inventory:** `POST register · login · refresh · logout · logout-all · forgot-password · reset-password · verify-email · resend-verification · GET google · GET google/callback · GET me · PATCH me · PATCH me/password`
>
> **Email Verification Contracts:**
> - `POST /auth/verify-email {token}` → `200 OK {message}` (replayed, invalid, or expired tokens return `401 TOKEN_INVALID`; single-use via Redis `GETDEL`).
> - `POST /auth/resend-verification` (requires `JwtAuthGuard`) → `204 No Content` (returns `409 EMAIL_ALREADY_VERIFIED` if already verified).
>
> **Global Validation Policy:** The application's global `ValidationPipe` runs with `forbidNonWhitelisted: true` (`src/main.ts`), so any request carrying unknown fields is rejected with `400 VALIDATION_ERROR`.
---

## Table of Contents

1. [Registration (`POST /auth/register`)](#1-registration)
2. [Login (`POST /auth/login`)](#2-login)
3. [Token Refresh (`POST /auth/refresh`)](#3-token-refresh)
4. [Logout — Single Device (`POST /auth/logout`)](#4-logout--single-device)
5. [Logout — All Devices (`POST /auth/logout-all`)](#5-logout--all-devices)
6. [Forgot Password (`POST /auth/forgot-password`)](#6-forgot-password)
7. [Reset Password (`POST /auth/reset-password`)](#7-reset-password)
8. [Google OAuth URL (`GET /auth/google`)](#8-google-oauth-url)
9. [Google OAuth Callback (`GET /auth/google/callback`)](#9-google-oauth-callback)
10. [Get Profile (`GET /auth/me`)](#10-get-profile)
11. [Update Profile (`PATCH /auth/me`)](#11-update-profile)
12. [Change Password (`PATCH /auth/me/password`)](#12-change-password)
13. [Cross-Cutting Concerns](#13-cross-cutting-concerns)

---

## 1. Registration

**Endpoint:** `POST /auth/register`
**Guards:** `AnonymousGuard` (blocks authenticated users)
**Rate Limit:** 3 requests / 60s

### 1.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 1.1.1 | Register with valid data | `{ "email": "test@example.com", "password": "SecureP@ss123", "displayName": "Test User" }` | `201 Created` | Returns `{ user: { id, email, displayName, avatarUrl, isEmailVerified, createdAt }, tokens: { accessToken, expiresIn } }`. `Set-Cookie` header contains `refreshToken` httpOnly cookie. |
| 1.1.2 | Register with minimum valid password | `{ "email": "min@test.com", "password": "Abcd!1ab", "displayName": "Jo" }` | `201 Created` | User created successfully, 8-char password accepted. |
| 1.1.3 | Register with max-length fields | `{ "email": "<255 char email>", "password": "<128 char valid password>", "displayName": "<100 char name>" }` | `201 Created` | All max-length values accepted. |
| 1.1.4 | Email is trimmed and lowercased | `{ "email": "  Test@EXAMPLE.com  ", "password": "SecureP@ss123", "displayName": "Test" }` | `201 Created` | Email stored as `test@example.com`. |
| 1.1.5 | Display name is trimmed | `{ "email": "trim@test.com", "password": "SecureP@ss123", "displayName": "  John Doe  " }` | `201 Created` | Display name stored as `John Doe`. |

### 1.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 1.2.1 | Missing email | `{ "password": "SecureP@ss123", "displayName": "Test" }` | `400` | Validation error: email is required |
| 1.2.2 | Invalid email format | `{ "email": "not-an-email", "password": "SecureP@ss123", "displayName": "Test" }` | `400` | Validation error: email must be valid |
| 1.2.3 | Email exceeds 255 chars | `{ "email": "<256+ char email>", ... }` | `400` | Validation error: maxLength exceeded |
| 1.2.4 | Missing password | `{ "email": "test@test.com", "displayName": "Test" }` | `400` | Validation error: password is required |
| 1.2.5 | Password too short (< 8 chars) | `{ "email": "t@t.com", "password": "Ab1!xyz", "displayName": "Test" }` | `400` | `Password must be at least 8 characters` |
| 1.2.6 | Password too long (> 128 chars) | `{ "email": "t@t.com", "password": "<129 chars>", "displayName": "Test" }` | `400` | Validation error: maxLength exceeded |
| 1.2.7 | Password missing lowercase | `{ "email": "t@t.com", "password": "SECUREP@SS123", "displayName": "Test" }` | `400` | `Password must contain a lowercase letter` |
| 1.2.8 | Password missing uppercase | `{ "email": "t@t.com", "password": "securep@ss123", "displayName": "Test" }` | `400` | `Password must contain an uppercase letter` |
| 1.2.9 | Password missing number | `{ "email": "t@t.com", "password": "SecureP@ssword", "displayName": "Test" }` | `400` | `Password must contain a number` |
| 1.2.10 | Password missing special char | `{ "email": "t@t.com", "password": "SecurePass123", "displayName": "Test" }` | `400` | `Password must contain a special character` |
| 1.2.11 | Missing displayName | `{ "email": "t@t.com", "password": "SecureP@ss123" }` | `400` | Validation error: displayName is required |
| 1.2.12 | displayName too short (< 2 chars) | `{ "email": "t@t.com", "password": "SecureP@ss123", "displayName": "J" }` | `400` | Validation error: minLength violation |
| 1.2.13 | displayName too long (> 100 chars) | `{ "email": "t@t.com", "password": "SecureP@ss123", "displayName": "<101 chars>" }` | `400` | Validation error: maxLength exceeded |
| 1.2.14 | Empty body | `{}` | `400` | Multiple validation errors |
| 1.2.15 | Null body | (no body) | `400` | Validation error |

### 1.3 Conflict / Business Logic

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 1.3.1 | Duplicate email | User with `test@example.com` already exists | `409 Conflict` | `EMAIL_ALREADY_EXISTS` |
| 1.3.2 | Duplicate email (case-insensitive) | User with `test@example.com` exists, register with `TEST@Example.com` | `409 Conflict` | `EMAIL_ALREADY_EXISTS` |

### 1.4 Guard / Auth Edge Cases

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 1.4.1 | Already authenticated user | Send valid `Authorization: Bearer <token>` header | `403 Forbidden` | AnonymousGuard blocks already-authenticated requests |

### 1.5 Rate Limiting

| # | Test Case | Action | Expected Status |
|---|-----------|--------|-----------------|
| 1.5.1 | Exceed 3 register attempts in 60s | Send 4 rapid register requests | `429 Too Many Requests` on 4th attempt |

---

## 2. Login

**Endpoint:** `POST /auth/login`
**Guards:** `AnonymousGuard`
**Rate Limit:** 5 requests / 60s

### 2.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 2.1.1 | Login with valid credentials | `{ "email": "test@example.com", "password": "SecureP@ss123" }` | `200 OK` | Returns `{ user, tokens: { accessToken, expiresIn } }`. `Set-Cookie` with `refreshToken`. |
| 2.1.2 | Email is case-insensitive | `{ "email": "TEST@EXAMPLE.COM", "password": "SecureP@ss123" }` | `200 OK` | Successful login |
| 2.1.3 | Email is trimmed | `{ "email": "  test@example.com  ", "password": "SecureP@ss123" }` | `200 OK` | Successful login |
| 2.1.4 | Updates lastLoginAt timestamp | Login successfully | `200 OK` | `lastLoginAt` in DB should be updated to current time |

### 2.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status |
|---|-----------|-------------|-----------------|
| 2.2.1 | Missing email | `{ "password": "SecureP@ss123" }` | `400` |
| 2.2.2 | Invalid email format | `{ "email": "not-email", "password": "pass" }` | `400` |
| 2.2.3 | Missing password | `{ "email": "test@example.com" }` | `400` |
| 2.2.4 | Password exceeds 128 chars | `{ "email": "t@t.com", "password": "<129 chars>" }` | `400` |
| 2.2.5 | Empty body | `{}` | `400` |

### 2.3 Authentication Errors (401)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 2.3.1 | Non-existent email | No user with given email | `401` | `INVALID_CREDENTIALS` |
| 2.3.2 | Wrong password | User exists, wrong password | `401` | `INVALID_CREDENTIALS` |
| 2.3.3 | Google-only user (no password hash) | User registered via Google OAuth, has no `passwordHash` | `401` | `INVALID_CREDENTIALS` |
| 2.3.4 | Correct email, empty password string | `{ "email": "test@example.com", "password": "" }` | `400` or `401` | Validation or credential error |

### 2.4 Guard / Edge Cases

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 2.4.1 | Already authenticated user | Valid Bearer token present | `403 Forbidden` |

### 2.5 Rate Limiting

| # | Test Case | Action | Expected Status |
|---|-----------|--------|-----------------|
| 2.5.1 | Exceed 5 login attempts in 60s | 6 rapid login requests | `429` on 6th |

---

## 3. Token Refresh

**Endpoint:** `POST /auth/refresh`
**Rate Limit:** 10 requests / 60s

### 3.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 3.1.1 | Refresh with valid cookie | Valid `refreshToken` cookie | `200 OK` | New `{ accessToken, expiresIn }`. New `refreshToken` cookie set. |
| 3.1.2 | Old refresh token is rotated | After refresh, old token should be replaced in DB | `200 OK` | Old row marked `revokedAt` + `replacedBy` = new token id; new row inserted in same `family_id` (target design — see `06-auth-and-rbac.md` §3) |
| 3.1.3 | Refresh preserves IP + user agent metadata | Send with custom IP/UA | `200 OK` | New token record stored with request IP and user-agent |

### 3.2 Unauthorized Errors (401)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 3.2.1 | No refresh token cookie | No `refreshToken` cookie sent | `401` | `TOKEN_INVALID` |
| 3.2.2 | Invalid/garbage token | `refreshToken` cookie set to random string | `401` | `TOKEN_INVALID` |
| 3.2.3 | Revoked refresh token | Token was revoked (logout) | `401` | `TOKEN_INVALID` (target: `TOKEN_REUSE_DETECTED` once family rotation lands) |
| 3.2.4 | Expired refresh token | Token expired (> 7 days) | `401` | `REFRESH_TOKEN_EXPIRED` |
| 3.2.5 | Empty string token | `refreshToken` cookie is empty string | `401` | `TOKEN_INVALID` |
| 3.2.6 | Token for deleted user | User deleted after token issued | `401` | Error (user relation missing) |

### 3.3 Token Rotation Security

| # | Test Case | Action | Expected |
|---|-----------|--------|----------|
| 3.3.1 | Old token rejected after rotation | Use refresh, then try old token again | `401 TOKEN_INVALID` — old hash no longer active |
| 3.3.2 | New token works after rotation | Use the new refresh token | `200 OK` — successfully refresh again |
| 3.3.3 | Reuse detection revokes family *(target)* | Rotate A→B, then replay A | `401 TOKEN_REUSE_DETECTED`; B and all family rows revoked |

### 3.4 Rate Limiting

| # | Test Case | Action | Expected Status |
|---|-----------|--------|-----------------|
| 3.4.1 | Exceed 10 refresh attempts in 60s | 11 rapid requests | `429` on 11th |

---

## 4. Logout — Single Device

**Endpoint:** `POST /auth/logout`
**Guards:** `JwtAuthGuard`

### 4.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 4.1.1 | Logout with valid token + cookie | Authenticated with Bearer token and refreshToken cookie | `204 No Content` | Refresh token revoked in DB, access token JTI blacklisted in Redis, `refreshToken` cookie cleared |
| 4.1.2 | Logout without refresh cookie | Authenticated with Bearer token only (no cookie) | `204 No Content` | Only access token blacklisted; no error thrown for missing cookie |

### 4.2 Unauthorized

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 4.2.1 | No Bearer token | Missing `Authorization` header | `401` |
| 4.2.2 | Invalid/expired Bearer token | Expired or malformed JWT | `401` |
| 4.2.3 | Blacklisted access token | Token already blacklisted via previous logout | `401` |

### 4.3 Post-Logout Verification

| # | Test Case | Action | Expected |
|---|-----------|--------|----------|
| 4.3.1 | Access token unusable after logout | Use blacklisted access token on `GET /auth/me` | `401 Unauthorized` |
| 4.3.2 | Refresh token unusable after logout | Use revoked refresh token on `POST /auth/refresh` | `401 TOKEN_INVALID` |
| 4.3.3 | Other device sessions remain active | Login on device A and B, logout from A | Device B tokens still work |

---

## 5. Logout — All Devices

**Endpoint:** `POST /auth/logout-all`
**Guards:** `JwtAuthGuard`

### 5.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 5.1.1 | Logout all devices | Authenticated, multiple refresh tokens exist | `204 No Content` | ALL refresh tokens for user revoked, current access token blacklisted, `refreshToken` cookie cleared |

### 5.2 Post-Logout Verification

| # | Test Case | Action | Expected |
|---|-----------|--------|----------|
| 5.2.1 | All device sessions invalidated | Try refresh from any other device | `401 TOKEN_INVALID` |
| 5.2.2 | User can re-login after logout-all | Login with valid credentials | `200 OK` — new token pair issued |

### 5.3 Unauthorized

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 5.3.1 | No Bearer token | Missing `Authorization` header | `401` |

---

## 6. Forgot Password

**Endpoint:** `POST /auth/forgot-password`
**Guards:** `AnonymousGuard`
**Rate Limit:** 3 requests / 3600s (1 hour)

### 6.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Response |
|---|-----------|-------------|-----------------|-------------------|
| 6.1.1 | Existing user email | `{ "email": "test@example.com" }` | `200 OK` | `{ "message": "If that email exists in our system, a password reset link has been sent." }` + Reset token stored in Redis with TTL (3600s) |
| 6.1.2 | Non-existent email (no enumeration) | `{ "email": "unknown@example.com" }` | `200 OK` | Same generic message returned (prevents user enumeration) |

### 6.2 Validation Errors

| # | Test Case | Request Body | Expected Status |
|---|-----------|-------------|-----------------|
| 6.2.1 | Missing email | `{}` | `400` |
| 6.2.2 | Invalid email format | `{ "email": "not-valid" }` | `400` |

### 6.3 Event / Side Effects

| # | Test Case | Precondition | Expected |
|---|-----------|-------------|----------|
| 6.3.1 | Emits `user.password_reset_requested` | Valid user email | Event emitted with `userId`, `email`, and raw `token` |
| 6.3.2 | No event for non-existent email | Unknown email | No event emitted |
| 6.3.3 | Redis key has correct TTL | Valid user email | `password_reset:<tokenHash>` key exists with 3600s TTL |

### 6.4 Guard / Rate Limiting

| # | Test Case | Action | Expected Status |
|---|-----------|--------|-----------------|
| 6.4.1 | Already authenticated user | Send with valid Bearer token | `403 Forbidden` |
| 6.4.2 | Exceed 3 requests in 1 hour | 4 rapid requests | `429` on 4th |

---

## 7. Reset Password

**Endpoint:** `POST /auth/reset-password`
**Guards:** `AnonymousGuard`
**Rate Limit:** 3 requests / 3600s

### 7.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 7.1.1 | Reset with valid token + new password | `{ "token": "<valid_reset_token>", "newPassword": "NewSecure@1" }` | `200 OK` | Returns `{ accessToken, expiresIn }`. New `refreshToken` cookie. Old password invalid. All previous refresh tokens revoked. Redis key deleted. |
| 7.1.2 | Can login with new password after reset | Login with new password | `200 OK` | Successful login |
| 7.1.3 | Old password no longer works | Login with old password | `401` | `INVALID_CREDENTIALS` |

### 7.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status |
|---|-----------|-------------|-----------------|
| 7.2.1 | Missing token | `{ "newPassword": "NewSecure@1" }` | `400` |
| 7.2.2 | Missing newPassword | `{ "token": "abc" }` | `400` |
| 7.2.3 | newPassword too short | `{ "token": "abc", "newPassword": "Ab1!" }` | `400` |
| 7.2.4 | newPassword missing lowercase | `{ "token": "abc", "newPassword": "SECURE@123" }` | `400` |
| 7.2.5 | newPassword missing uppercase | `{ "token": "abc", "newPassword": "secure@123" }` | `400` |
| 7.2.6 | newPassword missing number | `{ "token": "abc", "newPassword": "Secure@Pass" }` | `400` |
| 7.2.7 | newPassword missing special char | `{ "token": "abc", "newPassword": "SecurePass1" }` | `400` |

### 7.3 Unauthorized Errors (401)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 7.3.1 | Invalid/garbage token | Token doesn't exist in Redis | `401` | `TOKEN_INVALID` |
| 7.3.2 | Expired token (TTL elapsed) | Token expired from Redis (> 3600s) | `401` | `TOKEN_INVALID` |
| 7.3.3 | Already-used token | Token was already consumed and deleted from Redis | `401` | `TOKEN_INVALID` |
| 7.3.4 | Token for deleted user | User no longer exists in DB | `401` | `USER_NOT_FOUND` |

### 7.4 Session Revocation

| # | Test Case | Action | Expected |
|---|-----------|--------|----------|
| 7.4.1 | All previous sessions invalidated | After reset, try old refresh token from another device | `401 TOKEN_INVALID` |
| 7.4.2 | Redis token deleted after use | Query Redis for `password_reset:<hash>` | Key does not exist |

---

## 8. Google OAuth URL

**Endpoint:** `GET /auth/google`
**Guards:** `AnonymousGuard`

### 8.1 Happy Path

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 8.1.1 | Get Google auth URL | `200 OK` | `{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }` containing `client_id`, `redirect_uri`, `scope`, `access_type=offline` |
| 8.1.2 | URL contains correct callback URL | `200 OK` | URL's `redirect_uri` matches `GOOGLE_CALLBACK_URL` env var |

### 8.2 Guard Edge Cases

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 8.2.1 | Already authenticated user | Valid Bearer token | `403 Forbidden` |

---

## 9. Google OAuth Callback

**Endpoint:** `GET /auth/google/callback`
**Guards:** `AuthGuard('google')` (Passport Google strategy)

### 9.1 Happy Path

| # | Test Case | Precondition | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 9.1.1 | New Google user (first login) | Google profile not in DB | `200 OK` | New user created with `googleId`, `isEmailVerified: true`. Returns `{ user, tokens }`. Sets `refreshToken` cookie. |
| 9.1.2 | Existing Google user (returning login) | User with same `googleId` exists | `200 OK` | User info updated (displayName, avatarUrl, lastLoginAt). Tokens issued. |
| 9.1.3 | Email-linked account (Google linking) | User exists with same email but no `googleId` | `200 OK` | `googleId` linked to existing account, `isEmailVerified` set to `true`. |

### 9.2 Edge Cases

| # | Test Case | Precondition | Expected |
|---|-----------|-------------|----------|
| 9.2.1 | Google account without email | Google profile missing email | `401 Unauthorized` — `Google account must have a valid email` |
| 9.2.2 | Race condition — concurrent Google signup | Two requests with same email arrive simultaneously | Handles P2002 unique constraint error gracefully, links existing account |
| 9.2.3 | Emits `user.logged_in` with method `google` | Successful callback | Event emitted with `method: 'google'` |

---

## 10. Get Profile

**Endpoint:** `GET /auth/me`
**Guards:** `JwtAuthGuard`

### 10.1 Happy Path

| # | Test Case | Expected Status | Expected Response |
|---|-----------|-----------------|-------------------|
| 10.1.1 | Get own profile | `200 OK` | Returns user profile (id, email, displayName, avatarUrl, isEmailVerified, googleId, lastLoginAt, createdAt, updatedAt). **No `passwordHash` field** returned. |

### 10.2 Unauthorized

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 10.2.1 | No Bearer token | Missing `Authorization` header | `401` |
| 10.2.2 | Invalid Bearer token | Malformed JWT | `401` |
| 10.2.3 | Expired Bearer token | JWT past expiry | `401` |
| 10.2.4 | Blacklisted token | Token blacklisted after logout | `401` |

### 10.3 Edge Cases

| # | Test Case | Precondition | Expected Status |
|---|-----------|-------------|-----------------|
| 10.3.1 | Deleted user with valid token | User deleted from DB but JWT still valid | `404 Not Found` — `USER_NOT_FOUND` |

---

## 11. Update Profile

**Endpoint:** `PATCH /auth/me`
**Guards:** `JwtAuthGuard`
**Rate Limit:** 20 requests / 60s

### 11.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 11.1.1 | Update displayName only | `{ "displayName": "New Name" }` | `200 OK` | Display name updated, avatarUrl unchanged |
| 11.1.2 | Update avatarUrl only | `{ "avatarUrl": "https://example.com/new.jpg" }` | `200 OK` | Avatar URL updated, displayName unchanged |
| 11.1.3 | Update both fields | `{ "displayName": "New Name", "avatarUrl": "https://example.com/a.jpg" }` | `200 OK` | Both updated |
| 11.1.4 | Clear avatar (set to null) | `{ "avatarUrl": null }` | `200 OK` | Avatar cleared |
| 11.1.5 | Empty body (no changes) | `{}` | `200 OK` | Profile returned unchanged |
| 11.1.6 | displayName trimmed | `{ "displayName": "  John  " }` | `200 OK` | Stored as `John` |

### 11.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status |
|---|-----------|-------------|-----------------|
| 11.2.1 | displayName too short | `{ "displayName": "J" }` | `400` |
| 11.2.2 | displayName too long (> 100) | `{ "displayName": "<101 chars>" }` | `400` |
| 11.2.3 | avatarUrl invalid URL | `{ "avatarUrl": "not-a-url" }` | `400` |
| 11.2.4 | avatarUrl too long (> 2000) | `{ "avatarUrl": "<2001 chars>" }` | `400` |

### 11.3 Response Security

| # | Test Case | Expected |
|---|-----------|----------|
| 11.3.1 | No `passwordHash` in response | Response body must never include `passwordHash` |

---

## 12. Change Password

**Endpoint:** `PATCH /auth/me/password`
**Guards:** `JwtAuthGuard`
**Rate Limit:** 5 requests / 60s

### 12.1 Happy Path

| # | Test Case | Request Body | Expected Status | Expected Behavior |
|---|-----------|-------------|-----------------|-------------------|
| 12.1.1 | Change password with correct current | `{ "currentPassword": "SecureP@ss123", "newPassword": "NewSecure@1" }` | `200 OK` | Returns `{ accessToken, expiresIn }`. New `refreshToken` cookie. All previous sessions revoked. Old JWT blacklisted. |
| 12.1.2 | Can login with new password | Login with `NewSecure@1` | `200 OK` | Success |
| 12.1.3 | Old password no longer valid | Login with `SecureP@ss123` | `401` | `INVALID_CREDENTIALS` |

### 12.2 Validation Errors (400)

| # | Test Case | Request Body | Expected Status |
|---|-----------|-------------|-----------------|
| 12.2.1 | Missing currentPassword | `{ "newPassword": "NewSecure@1" }` | `400` |
| 12.2.2 | Missing newPassword | `{ "currentPassword": "SecureP@ss123" }` | `400` |
| 12.2.3 | newPassword too short | `{ "currentPassword": "SecureP@ss123", "newPassword": "Ab1!" }` | `400` |
| 12.2.4 | newPassword missing lowercase | `{ "currentPassword": "X", "newPassword": "SECUREP@SS1" }` | `400` |
| 12.2.5 | newPassword missing uppercase | `{ "currentPassword": "X", "newPassword": "securep@ss1" }` | `400` |
| 12.2.6 | newPassword missing number | `{ "currentPassword": "X", "newPassword": "SecureP@ssword" }` | `400` |
| 12.2.7 | newPassword missing special char | `{ "currentPassword": "X", "newPassword": "SecurePass123" }` | `400` |
| 12.2.8 | currentPassword too long (> 128) | `{ "currentPassword": "<129 chars>", "newPassword": "NewSecure@1" }` | `400` |

### 12.3 Unauthorized (401)

| # | Test Case | Precondition | Expected Status | Expected Error |
|---|-----------|-------------|-----------------|----------------|
| 12.3.1 | Incorrect current password | Wrong `currentPassword` | `401` | `INVALID_CREDENTIALS` |
| 12.3.2 | Google-only user (no password) | User has no `passwordHash` | `401` | `INVALID_CREDENTIALS` |

### 12.4 Session Revocation

| # | Test Case | Action | Expected |
|---|-----------|--------|----------|
| 12.4.1 | All previous refresh tokens revoked | Try old refresh token after password change | `401 TOKEN_INVALID` |
| 12.4.2 | Previous access token blacklisted | Use old access token on any endpoint | `401 Unauthorized` |

### 12.5 Rate Limiting

| # | Test Case | Action | Expected Status |
|---|-----------|--------|-----------------|
| 12.5.1 | Exceed 5 attempts in 60s | 6 rapid requests | `429` on 6th |

---

## 13. Cross-Cutting Concerns

### 13.1 Cookie Security

| # | Test Case | Expected |
|---|-----------|----------|
| 13.1.1 | Refresh token cookie is httpOnly | Cookie has `httpOnly: true` |
| 13.1.2 | Secure flag in production | When `NODE_ENV=production`, cookie has `secure: true` |
| 13.1.3 | SameSite attribute is `lax` | Cookie has `sameSite: lax` |
| 13.1.4 | Cookie path is `/api/auth` | Cookie scoped to auth path only |
| 13.1.5 | Cookie maxAge is 7 days | `maxAge = 604800000` ms |
| 13.1.6 | Cookie cleared on logout | After logout, `refreshToken` cookie removed |

### 13.2 JWT Access Token

| # | Test Case | Expected |
|---|-----------|----------|
| 13.2.1 | Access token contains user `sub` (userId) | Decode JWT and verify `sub` claim |
| 13.2.2 | Access token has 15-minute expiry | `expiresIn: 900` seconds |
| 13.2.3 | Access token has unique `jti` (JWT ID) | Used for blacklisting individual tokens |
| 13.2.4 | Access token signed with RS256 when key files exist, HS256 dev fallback otherwise | `jwtTokenService` uses RS256 when `JWT_PRIVATE_KEY_PATH`/`JWT_PUBLIC_KEY_PATH` exist, else HS256 with `JWT_SECRET` (local dev/test). Assert `alg ∈ {RS256, HS256}`; assert `RS256` REQUIRED when `NODE_ENV=production` (boot fails without key files) |
| 13.2.5 | Access token has `iss: syncboard` | Verify issuer claim |

### 13.3 Refresh Token Security

| # | Test Case | Expected |
|---|-----------|----------|
| 13.3.1 | Refresh token is 32 random bytes (base64url) | Token format matches `base64url` pattern |
| 13.3.2 | Stored as SHA-256 hash in DB | DB stores hash, not raw token |
| 13.3.3 | Token rotation on every refresh | Old hash replaced by new hash |

### 13.4 Event Emissions

| # | Test Case | Trigger | Expected Event |
|---|-----------|---------|----------------|
| 13.4.1 | Registration emits event | Successful `POST /auth/register` | `user.registered` with `{ userId, email }` |
| 13.4.2 | Login emits event | Successful `POST /auth/login` | `user.logged_in` with `{ userId, method: 'email' }` |
| 13.4.3 | Google login emits event | Successful Google callback | `user.logged_in` with `{ userId, method: 'google' }` |
| 13.4.4 | Forgot password emits event | `POST /auth/forgot-password` with existing email | `user.password_reset_requested` with `{ userId, email, token }` |

### 13.5 Content Type / Malformed Requests

| # | Test Case | Action | Expected Status |
|---|-----------|--------|-----------------|
| 13.5.1 | Missing `Content-Type: application/json` | Send request without JSON content type | `400` or appropriate error |
| 13.5.2 | Malformed JSON body | `{ invalid json` | `400` |
| 13.5.3 | Extra unknown fields in body | `{ "email": "t@t.com", "password": "X", "displayName": "Y", "extra": "field" }` | `400` — `VALIDATION_ERROR` (corrected 2026-08-30: `forbidNonWhitelisted: true`; previously documented as 201) |

---

## 14. Combined & End-to-End Scenarios

> Automation legend — every row is portable to `test/e2e/auth.e2e-spec.ts` per
> `e2e-test-generation.md` §4: `A` = automatic HTTP · `M` = manual UX · `C` = combined.
> Row 14.1 (rotation/reuse) and 14.6 (throttle) are automated; 14.3 requires MailHog dig
> (response-level part automated); 14.2/14.4/14.5/14.7 are manual until OAuth/RS256 land.

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 14.1 | Rotation under load | script refreshes token every 30s ×10 while data calls continue | zero 401s on API calls; every rotation creates new family row; replaying any OLD cookie afterwards → `TOKEN_REUSE_DETECTED` + whole family dead |
| 14.2 | Multi-device logout cascade | login 3 devices → change password on device 1 | devices 2+3 next call → 401; device 1 keeps working w/ fresh pair |
| 14.3 | Enumeration resistance sweep | 20 forgot-password calls mixing known/unknown emails | identical responses + timing within noise; MailHog receives exactly one email |
| 14.4 | Reset mid-session race | reset password while a background job refreshes tokens concurrently | after reset: ALL pre-reset families revoked; only post-reset pair valid; no orphan active rows |
| 14.5 | OAuth link takeover guard | register email+password AFTER google account exists with same email | callback links accounts (googleId added) without dropping password hash; both login paths work |
| 14.6 | Throttle + correctness | hit login limit then correct creds | 11th+ attempts 429 even with right password; window expiry restores access |
| 14.7 | Cookie contract audit | inspect Set-Cookie across register/login/refresh/logout | name/HttpOnly/SameSite/Path/Max-Age match doc 06 table byte-for-byte |
