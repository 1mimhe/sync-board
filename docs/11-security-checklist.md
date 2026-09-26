# 11 — Security Checklist

Security posture of the completed system. Each item lists how it is implemented;
details live in the referenced design docs (`06-auth-and-rbac.md`, `03-api-design.md`,
`04-websocket-events.md`, `09-infrastructure-devops.md`).

## 1. Authentication Security

| Item | Implementation |
|------|---------------|
| Passwords hashed with bcrypt (12 rounds) | `PasswordService` |
| Refresh tokens stored as SHA-256 hashes | `RefreshToken.token_hash` |
| Token rotation with reuse detection | New-row rotation + `family_id` revocation (see `06-auth-and-rbac.md` §3); replay of a revoked token revokes the whole family |
| Refresh token delivered via HTTP-only cookie | `refreshToken`, HttpOnly, SameSite=Lax, Secure in prod, Path=/api/auth |
| JWT signed with RS256 (asymmetric) | `JwtTokenService` — RS256 via key files; HS256 fallback is dev-only (`NODE_ENV=production` ⇒ keys required) |
| Access token TTL ≤ 15 minutes | Auth constants |
| JWT blacklisting on logout (Redis) | `TokenBlacklistService`, called from logout/logout-all/password change |
| Private key stored as file (not env var) | `JWT_PRIVATE_KEY_PATH` |
| Login rate limiting (per IP) | `@nestjs/throttler` `@Throttle()` on auth controller |
| Registration rate limiting (per IP) | `@nestjs/throttler` `@Throttle()` on auth controller |
| No "email not found" vs "wrong password" distinction | Generic `INVALID_CREDENTIALS` |
| Password reset tokens isolated from sessions | Redis-hashed keys (1h TTL), atomically consumed (`GETDEL`) |
| Google OAuth state parameter validation | Passport.js handles this |

---

## 2. Authorization Security

| Item | Implementation |
|------|---------------|
| All protected routes use `JwtAuthGuard` | Applied per controller / via `@WorkspaceAuth()` |
| Workspace membership verified before any resource access | `WorkspaceMemberGuard`, `WsBoardAccessGuard`, `WsWorkspaceMemberGuard` |
| RBAC roles enforced per endpoint | `RbacGuard` + `@Roles()` / `@WorkspaceAuth()` |
| Resource ownership checked for destructive actions | Service-level checks (comments, attachments) |
| Admin cannot promote to owner | `WorkspaceService.updateMemberRole()` |
| Owner cannot be removed from workspace | `WorkspaceService.removeMember()` |
| Viewer role blocks all write operations | RBAC matrix enforcement |
| Comment deletion only by author or admin+ | `CardCommentService` ownership check |
| Attachment deletion only by uploader or admin+ | File ownership check |
| Unverified users blocked from mutations (soft gate) | `EmailVerifiedGuard` — read-only + `@SkipEmailVerification()` endpoints allowed; others 403 `EMAIL_NOT_VERIFIED` |
| Unverified users blocked from WebSocket realtime | `WsAuthGuard` rejects with `EMAIL_NOT_VERIFIED` when claim is `false` |

---

## 3. Input Validation

| Item | Implementation |
|------|---------------|
| Global `ValidationPipe` with `whitelist: true` | `main.ts` |
| All DTOs use `class-validator` decorators | Every DTO file |
| `forbidNonWhitelisted: true` — reject unknown fields | `ValidationPipe` config |
| `transform: true` — auto-transform types | `ValidationPipe` config |
| UUID params validated with `ParseUUIDPipe` | Controller params |
| Email format validated on all email inputs | `@IsEmail()` |
| String lengths constrained (`@MaxLength`) | All string fields |
| Pagination limits enforced (max 50 per page) | Pagination DTOs / query validation |
| File size validated before presigned URL generation | `FileService` |
| MIME type validated against allowlist | `FileService` |

> **Validation Policy**: Enforced globally in `main.ts` using NestJS `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, `stopAtFirstError: false`). Strips and rejects unexpected attributes while capturing all validation errors in a single payload response.

---

## 4. Transport Security

| Item | Implementation |
|------|---------------|
| HTTPS enforced (HTTP → HTTPS redirect) | Nginx config |
| TLS 1.2+ only (no TLS 1.0/1.1) | Nginx `ssl_protocols` |
| Strong cipher suites configured | Nginx `ssl_ciphers` |
| HSTS header (1 year) | Nginx `Strict-Transport-Security` |
| WebSocket upgraded over TLS (WSS) | Nginx WebSocket proxy |

---

## 5. HTTP Security Headers

| Header | Value | Implementation |
|--------|-------|----------------|
| `X-Frame-Options` | `SAMEORIGIN` | Helmet.js (default) |
| `X-Content-Type-Options` | `nosniff` | Helmet.js (default) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Helmet.js (default) |
| `Content-Security-Policy` | Helmet defaults; tightened per environment | Helmet.js (script/style/img/connect restrict) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Nginx / Helmet in prod |

> Note: The legacy `X-XSS-Protection` header is deprecated and intentionally omitted — modern
> browsers ignore it, and Helmet no longer sets it by default.

---

## 6. CORS Configuration

- **Allowed Origins**: Whitelisted through `process.env.CLIENT_URL`.
- **Allowed Methods**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- **Allowed Headers**: `Content-Type`, `Authorization`, `X-Request-Id`.
- **Credentials**: Enabled (`true`) to permit HTTP-only `refreshToken` cookies across domains.
- **Preflight Cache**: 24 hours (`maxAge: 86400`) to minimize OPTIONS roundtrips.

---

## 7. SQL Injection Prevention

| Item | Implementation |
|------|---------------|
| Use Prisma for all standard queries (parameterized) | All repositories |
| Raw SQL uses Prisma's `$queryRaw` with tagged template (parameterized) | Where used |
| Never string-concatenate user input into SQL | Enforced in code review; `$queryRawUnsafe` strictly banned |
| Validate and sanitize sorting/ordering params against allowlist | Fixed `orderBy` clauses only |

---

## 8. XSS Prevention

| Item | Implementation |
|------|---------------|
| Card descriptions stored as structured JSON (not raw HTML) | Tiptap JSON format |
| Comment content sanitized before storage | Sanitization pipe using `sanitize-html` |
| User-generated content escaped in API responses | JSON serialization — escaping is client's render-time responsibility |
| File names sanitized (remove path traversal characters) | Attachment name handling + S3 key validation |
| CSP header blocks inline scripts | Helmet CSP directives |

---

## 9. Rate Limiting Strategy

| Endpoint / Channel | Limit | Window | Implementation |
|--------------------|-------|--------|----------------|
| `POST /auth/*` (login/register/refresh/forgot) | Per-endpoint config | via `@Throttle()` | `@nestjs/throttler` |
| All REST API (global fallback) | Throttler defaults | per IP | `@nestjs/throttler` |
| WebSocket board events | 60 | per min per user | Redis sliding window (`WS_RATE_LIMITS`) |
| WebSocket room joins | 10 | per min per user | Redis sliding window |
| WebSocket cursor updates | 600 (10/s) | per min per user | Redis sliding window |
| WebSocket doc:update / awareness | 120 / 600 | per min per user | Redis sliding window |

> Nginx edge rate limiting (`limit_req`) applies when the reverse proxy topology is deployed.

---

## 10. Data Protection

| Item | Implementation |
|------|---------------|
| Password hashes never returned in API responses | DTO mapping / Prisma `select` omit |
| Refresh tokens and credentials never logged | Pino structured logging `redact` config |
| S3 bucket is private (no public access) | S3 bucket policy + presigned URLs |
| Presigned URLs expire after 1 hour | `FileService` |
| S3 keys use UUIDs (prevent enumeration) | `FileService` |
| Database credentials managed outside code | Environment variables + Joi startup validation |
| Secrets untracked | `.gitignore` covers `.env*`, `keys/`, and certs |

---

## 11. Dependency Security

| Item | Implementation |
|------|---------------|
| Run `npm audit` in CI pipeline | GitHub Actions step |
| Use `npm ci` (not `npm install`) in CI | Deterministic builds via package-lock |
| Pin major versions in `package.json` | SemVer ranges pinned to known majors |
| Enable Dependabot/Renovate for auto-updates | `.github/dependabot.yml` |
| Review new dependencies before adding | Code review gate |

---

## 12. Infrastructure Security

| Item | Implementation |
|------|---------------|
| Docker containers run as non-root | `USER nestjs` in Dockerfile |
| PostgreSQL uses scram-sha-256 auth | `pg_hba.conf` |
| Redis requires password in production | Production deployment config; dev compose is local-only |
| RabbitMQ uses non-default credentials | Docker Compose env |
| Health check endpoint has no sensitive data | Only service status + latency checks |
| Production logs mask internal errors | `AllExceptionsFilter` hides 500 stacks from clients |
| Secrets managed via environment variables | Runtime injection via container orchestration |
