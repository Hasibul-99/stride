# Security

Summary of TeamBoard's security posture and the controls verified during the Phase 11 hardening pass.

## Authentication
- Passwords hashed with **argon2id**; never stored or logged in plaintext.
- **JWT access tokens** (15 min) kept in memory on the client only — never localStorage.
- **Refresh tokens** are httpOnly, secure (prod), `SameSite=Lax`, scoped to `/api/auth`. Rotated on every refresh; old token revoked (hashed row in `refresh_tokens`). Reuse of a rotated/revoked token → 401 (e2e covered).
- Login throttled to **5 attempts/min** per IP via `@nestjs/throttler`; global limit 100/min.
- Google OAuth uses incremental consent; identity verified via `verifyIdToken`.

## Authorization
- Global `JwtAuthGuard`; only `@Public()` routes bypass.
- Every project/workspace-scoped service call goes through `AccessService`:
  - `assertWorkspaceMember(userId, workspaceId, roles?)`
  - `assertProjectAccess(userId, projectId)` — workspace members see all projects; **guests see only projects they're a member of**.
- **Guest isolation is enforced and tested** (`test/security.e2e-spec.ts`): a GUEST of project A receives `403` on project B, its tasks, and the workspace member list.
- Role gates: workspace update/invite require OWNER/ADMIN; delete requires OWNER. Time-entry edits restricted to owner or workspace admin.

## Input validation & injection
- All request bodies/queries validated with **zod** schemas (`@ZodBody`, `ZodValidationPipe`) sourced from `packages/shared`.
- All DB access via **Prisma** (parameterized) — no string-interpolated SQL. Search uses Prisma `contains` (parameterized), not raw SQL.
- `ValidationPipe` with `whitelist + forbidNonWhitelisted` strips unknown fields.

## File uploads
- Direct-to-S3 **presigned PUT** flow; the API never proxies bytes.
- MIME allow-list + **25 MB** cap enforced at presign **and** confirm.
- Download via short-lived (5 min) presigned GET. Delete restricted to uploader or workspace admin.
- Virus-scan hook stub (`FilesService.virusScan`) — wire a real scanner before production.

## Secrets at rest
- Google refresh token encrypted with **AES-256-GCM** (`crypto.util.ts`, key derived from `ENCRYPTION_KEY`). Unit-tested round-trip + tamper rejection.
- All secrets read from env (`.env.example` documents them); none committed.

## Transport & headers
- `helmet` enabled; CORS locked to `FRONTEND_URL` with credentials.
- WebSocket connections authenticated via JWT on handshake; rooms validated against membership before join.

## Open items / recommendations
- Replace the virus-scan stub with a real scanner (ClamAV / S3 malware scanning).
- Add Sentry (or similar) error reporting in both apps.
- Enforce HTTPS + secure cookie domain in production (see DEPLOYMENT.md).
- Consider per-account (not just per-IP) login lockout for credential-stuffing resistance.
