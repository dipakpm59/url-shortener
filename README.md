# Snipr — Production-Grade URL Shortener

A backend-focused URL shortener built with Node.js, Express, and MySQL — featuring a **hand-built LFU (Least Frequently Used) cache** in front of the database, click analytics, QR codes, URL expiry, soft delete, JWT-based admin authentication, and audited admin APIs. Built as a portfolio/interview-prep project demonstrating layered architecture, caching strategy, and production concerns (security, logging, error handling).

## Architecture

```
                        ┌─────────────┐
                        │   Client    │  Browser / curl / Postman
                        └──────┬──────┘
                               ▼
                     ┌───────────────────┐
                     │   Express Server   │  server.js / src/app.js
                     └─────────┬─────────┘
                               ▼
                     ┌───────────────────┐
                     │ Security Middleware │  helmet, cors, hpp, compression,
                     │                     │  rate-limit, xss sanitizer
                     └─────────┬─────────┘
                               ▼
                     ┌───────────────────┐
                     │      Router        │  src/routes
                     └─────────┬─────────┘
                               ▼
                     ┌───────────────────┐
                     │    Controller      │  src/controllers
                     └─────────┬─────────┘
                               ▼
                     ┌───────────────────┐
                     │    Validator        │  src/validators
                     └─────────┬─────────┘
                               ▼
                     ┌───────────────────┐
                     │   Service Layer     │  src/services (business logic)
                     └─────┬───────┬─────┘
                           ▼       ▼
                  ┌───────────┐ ┌───────────┐
                  │ LFU Cache │ │  MySQL DB  │
                  │(in-memory)│ │ (via pool) │
                  └───────────┘ └───────────┘
```

**Redirect flow (the hot path):**
```
GET /:shortCode → LFU cache lookup
    → HIT:  return cached long_url, redirect immediately
    → MISS: query MySQL, populate cache, redirect
  → click_count / last_accessed_at / click_events updated
    asynchronously AFTER the redirect response is sent
```

## Folder Structure

```
src/
├── config/       # env loading, MySQL connection pool
├── constants/    # HTTP status codes, user-facing messages
├── models/       # parameterized SQL query modules (no ORM) — url, clickEvent, admin, adminLog
├── validators/   # input validation (URL format, alias rules, login/password rules)
├── cache/        # custom O(1) LFU cache implementation
├── services/     # business logic: url, cache, qrcode, analytics, auth
├── controllers/  # HTTP req/res translation
├── routes/       # Express routers
├── middleware/   # error handling, rate limiting, security stack, auth (JWT) guards
├── utils/        # AppError, asyncHandler, logger, short-code gen, jwt, password hashing
├── scripts/      # schema.sql + DB init script + seedAdmin.js
├── app.js        # Express app assembly
public/           # static frontend assets (css/js)
views/            # static HTML pages served by Express (incl. login.html)
logs/             # app.log / error.log / request.log (gitignored)
server.js         # process entry point
```

## LFU Cache

A custom **O(1) Least-Frequently-Used cache** (`src/cache/LFUCache.js`), used cache-aside in front of MySQL for the redirect endpoint. No Redis — implemented from scratch with `get/put/delete/updateFrequency/eviction/size/clear/statistics`.

- **Why LFU over no cache**: redirects vastly outnumber URL creations in real traffic; caching hot short codes avoids a DB round-trip on every redirect.
- **Why LFU over LRU**: URL shortener traffic is often power-law distributed — a small number of links receive the vast majority of clicks. LFU keeps genuinely popular links resident even if they weren't clicked in the last few minutes, whereas LRU can evict a very popular link just because it was momentarily quiet.
- **Time complexity**: O(1) for `get`, `put`, `delete`, and `eviction` — achieved via a `key → node` map plus a `frequency → ordered map of nodes` structure, with a tracked `minFreq` pointer so eviction never scans.
- **Space complexity**: O(capacity).
- **Production path**: swap `src/services/cache.service.js`'s in-process `LFUCache` for a Redis client using `ZADD`/sorted sets (or Redis's own LFU eviction policy, `allkeys-lfu`) — the rest of the codebase (service/controller layers) wouldn't need to change, since they only depend on the `get/put/delete/statistics` interface.

## Authentication

Single-role admin authentication — there are no public user accounts, only one or more `admins` who can manage the system.

**Login flow:**
```
Visit /admin
    │
    ▼
No valid admin_token cookie?
    │
    ▼
302 redirect → /login
    │
    ▼
POST /api/auth/login (email + password)
    │
    ▼
bcrypt.compare(password, password_hash)
    │
    ▼
Success → JWT signed (2h expiry) → set as HttpOnly cookie → redirect to /admin
Failure → increment failed_attempts → 5th failure locks the account 15 minutes
```

**JWT flow (every subsequent protected request):**
```
Request arrives with Cookie: admin_token=<jwt>
    │
    ▼
verifyJWT        — decode + check signature/expiry (no DB hit)
    │
    ▼
authenticateAdmin — look up admins.id from the token, attach req.admin
    │                (catches "admin deleted after token was issued")
    ▼
requireAdmin      — guard; placeholder for future role checks
    │
    ▼
route handler runs with req.admin available
```

Token invalid/missing → for page routes (`/admin`, `/analytics`), the centralized `errorHandler` redirects to `/login` (see `src/middleware/errorHandler.js`); for `/api/*` routes it returns `401` JSON instead, so the frontend's shared `apiRequest()` helper can react (redirect client-side) without a full page reload.

**Route protection:**

| Public (no login required) | Protected (admin login required) |
|---|---|
| `/`, `/login` | `/admin`, `/analytics` (pages) |
| `POST /api/url` (shorten) | `PUT/DELETE /api/url/:id`, `POST /api/url/:id/restore` |
| `GET /:shortCode` (redirect) | all of `/api/admin/*` |
| `GET /api/url/:shortCode`, `.../qrcode` | `/api/auth/logout`, `/api/auth/me`, `/api/auth/change-password` |

> **Deliberate deviation from a fully literal reading of "everything else redirects to login":** the QR-code-after-shorten step is part of the existing *public* landing-page flow (an anonymous visitor shortens a URL and immediately sees its QR code on the same page). Locking that down would have broken an existing feature, so URL creation, redirect, metadata lookup, and QR code generation stay public; only administrative mutations (update/delete/restore) and the `/api/admin/*` surface require login. Similarly, `render.yaml`'s `healthCheckPath` was pointed away from `/health` since it's now behind auth and Render's health-checker doesn't have an admin session — see the comment in `render.yaml`.

**Cookie configuration** (`src/controllers/auth.controller.js`):
- `httpOnly: true` — inaccessible to JavaScript (`document.cookie` can't read it), which is what actually defeats token-stealing XSS.
- `secure: true` in production — cookie is only ever sent over HTTPS.
- `sameSite: 'lax'` — the cookie isn't attached to most cross-site requests, mitigating CSRF.
- `maxAge` set only when **Remember Me** is checked (persistent cookie surviving browser restarts); otherwise it's a session cookie. Either way the JWT itself always expires after 2 hours — "remember me" only controls whether the *browser* keeps offering an unexpired token back, not how long that token is valid for.

**How to create a new admin:**
```bash
# uses ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD from .env by default
npm run db:seed

# to create a different/additional admin, override those three vars for one run:
ADMIN_USERNAME=jane ADMIN_EMAIL=jane@example.com ADMIN_PASSWORD='Str0ng!Pass' npm run db:seed
```
The script (`src/scripts/seedAdmin.js`) is idempotent — re-running it with an email that already exists just skips instead of erroring, and it enforces the same password complexity rule as the change-password flow.

**Login attempt lockout** (`admins.failed_attempts` / `admins.locked_until`, enforced in `src/services/auth.service.js`): 5 consecutive failed attempts against one account locks it for 15 minutes, independent of which IP the attempts came from. This is deliberately separate from the IP-based `loginLimiter` in `src/middleware/rateLimiter.js` — the two stop different attacks (one attacker brute-forcing one account from many IPs vs. one IP hammering many accounts).

**Audit log** (`admin_logs` table, `src/models/adminLog.model.js`): every `login`, `login_failed`, `account_locked`, `logout`, `password_change`, `password_reset_requested`, `password_reset`, `delete_url`, and `restore_url` event is recorded with the acting admin (when known), IP, user agent, and timestamp.

**Forgot password (OTP-based, no real email account required):**
```
POST /api/auth/forgot-password {email}
  → admin found?  generate 6-digit OTP, sha256-hash it, store with a 10-min
                   expiry, email it via Ethereal
  → not found?    same generic response either way (no enumeration)

POST /api/auth/reset-password {email, otp, newPassword, confirmPassword}
  → sha256(otp) === stored hash, and not expired?
  → yes: hash + store new password, clear the OTP (one-time use),
         unlock the account (failed_attempts/locked_until reset too —
         a successful reset is proof enough to also clear a lockout)
  → no:  generic "Invalid or expired reset code."
```
Email sending goes through **Ethereal** (`src/services/email.service.js`), Nodemailer's own fake-SMTP testing service — it registers a throwaway inbox automatically, no signup and no real credentials of any kind. Mail sent through it is never actually delivered anywhere; it's only viewable via a private preview link, which `POST /api/auth/forgot-password` returns in its response (`data.previewUrl`) when not running in production. This was a deliberate choice over wiring up a real provider: a real SMTP account (Gmail or otherwise) tied to a public portfolio repo is a real credential-exposure risk, and Ethereal demonstrates the exact same SMTP send code path a real provider would use. **For production**, swap the transporter in `email.service.js` for a real provider (Resend, SendGrid, Brevo, etc.) using an API-key env var — nothing else in the auth flow needs to change.

Both the OTP-request and OTP-verify endpoints are separately rate-limited (`otpRequestLimiter`, `otpVerifyLimiter` in `src/middleware/rateLimiter.js`) — a 6-digit code is only ~1 million possibilities, so verification attempts are capped tightly enough to make brute-forcing it infeasible inside its 10-minute expiry window.

## Database Schema

Four tables, see `src/scripts/schema.sql`:

- **`urls`** — `id`, `long_url`, `long_url_hash` (SHA-256, indexed for duplicate detection), `short_code` (unique), `is_custom_alias`, `click_count`, `created_at`, `last_accessed_at`, `expires_at`, `is_deleted`, `deleted_at`.
- **`click_events`** — one row per redirect: `url_id` (FK), `clicked_at`, `referrer`, `user_agent`, `ip_hash` — powers the "clicks over time" chart without bloating the `urls` table.
- **`admins`** — `id`, `username`, `email` (both unique), `password_hash` (bcrypt), `failed_attempts`, `locked_until`, `reset_otp_hash` (SHA-256, null unless a reset is in progress), `reset_otp_expires`, `created_at`, `updated_at`.
- **`admin_logs`** — `id`, `admin_id` (nullable FK — a failed login against an unknown email still gets logged), `action`, `details`, `ip_address`, `user_agent`, `created_at`.

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login, sets `HttpOnly` JWT cookie |
| POST | `/api/auth/logout` | 🔒 | Clears the session cookie |
| GET | `/api/auth/me` | 🔒 | Current admin's profile |
| PUT | `/api/auth/change-password` | 🔒 | Change password (complexity-validated) |
| POST | `/api/auth/forgot-password` | Public | Request a 6-digit OTP reset code (rate-limited) |
| POST | `/api/auth/reset-password` | Public | Verify OTP + set a new password (rate-limited) |
| POST | `/api/url` | Public | Create a short URL |
| GET | `/api/url/:shortCode` | Public | Get metadata for a short URL (JSON) |
| GET | `/api/url/:shortCode/qrcode` | Public | Get a QR code (data URL) for a short URL |
| PUT | `/api/url/:id` | 🔒 | Update a URL's destination |
| DELETE | `/api/url/:id` | 🔒 | Soft-delete a URL (audit-logged) |
| POST | `/api/url/:id/restore` | 🔒 | Restore a soft-deleted URL (audit-logged) |
| GET | `/:shortCode` | Public | **Redirect** to the original URL (302) |
| GET | `/api/admin/urls` | 🔒 | List URLs (search, sort, paginate) |
| GET | `/api/admin/dashboard` | 🔒 | Aggregate stats + most-clicked + clicks-over-time + cache stats |
| GET | `/api/admin/analytics` | 🔒 | Most-clicked + clicks-over-time only |
| GET | `/api/admin/cache` | 🔒 | LFU cache statistics |
| DELETE | `/api/admin/cache` | 🔒 | Clear the cache |
| GET | `/health` | 🔒 | Health check (DB connectivity + uptime) |

🔒 = requires a valid `admin_token` cookie (see [Authentication](#authentication)).

**Example — create a short URL:**
```bash
curl -X POST http://localhost:3000/api/url \
  -H "Content-Type: application/json" \
  -d '{"longUrl": "https://example.com/some/very/long/path", "customAlias": "my-link"}'
```
```json
{
  "success": true,
  "message": "Short URL created successfully.",
  "data": {
    "id": 1,
    "shortCode": "my-link",
    "shortUrl": "http://localhost:3000/my-link",
    "longUrl": "https://example.com/some/very/long/path",
    "clickCount": 0,
    "createdAt": "2026-07-03T10:00:00.000Z"
  }
}
```

## Getting Started

**Prerequisites:** Node.js 18+, a running MySQL 8 instance.

```bash
npm install
cp .env.example .env      # edit DB credentials
npm run db:init           # creates the database + tables
npm run dev                # starts on http://localhost:3000
```

## Environment Variables

See `.env.example` for the full list — key ones:

| Variable | Purpose |
|---|---|
| `PORT`, `BASE_URL` | Server port and public base URL (used to build short URLs) |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `CACHE_CAPACITY` | Max entries held by the LFU cache |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` | API rate limiting |
| `SHORT_CODE_LENGTH` | Length of generated short codes |
| `JWT_SECRET` | Signing key for admin session tokens — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN`, `COOKIE_NAME` | Session token lifetime (default `2h`) and cookie name |
| `MAX_LOGIN_ATTEMPTS`, `LOCK_DURATION_MINUTES` | Account lockout thresholds |
| `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only by `npm run db:seed` |

## Security

- **Helmet** — sets secure HTTP headers, restrictive CSP.
- **express-rate-limit** — global + a stricter limiter on URL creation.
- **HPP** — blocks HTTP parameter pollution.
- **compression** — gzip responses.
- **xss (sanitizer)** — strips script/HTML from request body/query/params before it reaches business logic.
- **Parameterized SQL** — every query in `src/models` uses named placeholders via `mysql2`, never string concatenation.
- **Centralized error handling** — operational errors return safe messages; unexpected errors never leak stack traces in production.
- **bcrypt password hashing** (via `bcryptjs`, 12 salt rounds) — passwords are never stored or logged in plaintext; see [Interview Prep](#interview-prep) for why hashing (not encryption) is correct here.
- **JWT in an `HttpOnly`, `Secure` (prod), `SameSite=Lax` cookie** — never in `localStorage`; see [Interview Prep](#interview-prep) for why.
- **Per-account login lockout** (5 failed attempts → 15 min lock) layered with a **per-IP rate limiter** on `/api/auth/login`.
- **Audit logging** of every security-relevant admin action (`admin_logs` table).

## Deployment (Render)

See `render.yaml`. In short: push to GitHub, create a new Web Service on Render pointing at this repo, and add a managed MySQL database (Render or an external provider like PlanetScale), setting the `DB_*` environment variables in the Render dashboard.

## Future Improvements

- Swap the in-process LFU cache for Redis to share cache state across multiple server instances.
- Move click-event writes to a message queue so redirect latency is fully decoupled from analytics.
- Read replica for MySQL to separate redirect (read) traffic from write traffic.
- Refresh tokens / token rotation, so a stolen-but-unexpired JWT has a shorter usable window than a full 2 hours.
- A real role system (`requireAdmin` is already structured to grow into `requireAdmin(['superadmin'])`-style role checks).
- A visible audit log page in the admin UI (the data is already captured in `admin_logs`, just not surfaced yet).
- A small unauthenticated `GET /healthz` liveness route so `render.yaml` can restore an automated health check without exposing the detailed `/health` diagnostics publicly.

## Interview Prep

### Why JWT (instead of server-side sessions)?
A JWT is a self-contained, signed claim ("this is admin #1, issued at X, expires at Y") that the server can verify with just a signature check — no database lookup or shared session store required. That fits this app's single-process deployment well. The trade-off (and it's a real one): a traditional server-side session can be revoked instantly by deleting it from the store; a JWT is valid until it expires, full stop, unless you build a revocation mechanism (blocklist, short expiry + refresh tokens, etc.) on top. This app leans on a short 2-hour expiry rather than building revocation, which is a reasonable trade-off for an admin-only tool but worth naming explicitly in an interview as a limitation you chose consciously.

### Why bcrypt (rather than, say, SHA-256, or storing plaintext)?
Never plaintext — a DB leak would hand over every credential directly. Never a fast general-purpose hash like SHA-256 either — those are *designed* to be fast, which is exactly wrong for passwords: it makes brute-forcing billions of guesses per second on cheap hardware (especially with GPUs) trivial. bcrypt is deliberately slow and has a tunable cost factor (`SALT_ROUNDS = 12` here), so brute-forcing scales with attacker cost, not just attacker patience. It also salts automatically, so two admins with the same password get different hashes, defeating precomputed rainbow-table attacks.

### Why HttpOnly cookies for the JWT?
`httpOnly: true` means client-side JavaScript cannot read the cookie via `document.cookie` — full stop, even if an attacker manages to inject a `<script>` tag into your page (XSS). That's the entire point: it removes the JWT from the attack surface that XSS can reach, without you having to be perfect about escaping every single place user input might render.

### Why NOT localStorage?
`localStorage` is fully readable by any JavaScript running on the page — your own code, a compromised third-party script, or an injected XSS payload. If a token lives there, a single XSS bug anywhere on the page means an attacker can read it and impersonate the admin from anywhere, no cookie theft/network access required. `localStorage` also isn't sent automatically with requests, so you'd have to manually attach it to every fetch — extra code, extra chances to forget it somewhere. An `HttpOnly` cookie is both safer (invisible to JS) and simpler (the browser attaches it automatically). The trade-off you take on instead is CSRF, which is why `SameSite=Lax` is set — cookies aren't attached to most cross-site requests, closing most of that gap.

### Authentication flow (proving who you are)
```
POST /api/auth/login {email, password}
  → look up admin by email (generic error if not found — no user enumeration)
  → check locked_until (account lockout)
  → bcrypt.compare(password, password_hash)
  → wrong: increment failed_attempts, maybe lock account, generic error
  → right: reset failed_attempts, sign JWT {sub: id, username}, set HttpOnly cookie
```

### Authorization flow (proving you're allowed to do this)
Authentication answers "who are you"; authorization answers "are you allowed to do this." Here they're nearly the same thing because there's only one role (`admin`) — passing `authenticateAdmin` (proving the token is valid and the account still exists) is sufficient authorization for every protected route. `requireAdmin` exists as a separate, explicit step specifically so that if a second role were introduced later (e.g. `viewer` who can see the dashboard but not delete URLs), the authorization check has a dedicated place to grow into (`requireAdmin(['superadmin'])`) without re-plumbing every route.

### Cookie lifecycle
1. **Set**: on successful login, `Set-Cookie: admin_token=<jwt>; HttpOnly; SameSite=Lax; [Secure;] [Max-Age=7200]`.
2. **Sent**: the browser automatically attaches it to every same-site request to this origin — no client JS needed.
3. **Verified**: `verifyJWT` middleware checks the signature and expiry on every protected request.
4. **Expires**: naturally after 2 hours (the JWT's own `exp` claim) — no server-side state to clean up.
5. **Cleared**: explicitly on logout (`res.clearCookie`), or implicitly by the browser if it was a session-only cookie (unchecked "Remember me") and the browser closes.

### Security best practices demonstrated here
- Generic "Invalid email or password" on login failure (never reveal *which* field was wrong).
- Password hashes never appear in any API response (`toPublicAdmin()` strips it before the object ever leaves the service layer).
- Defense in depth on brute force: per-account lockout **and** per-IP rate limiting are two independent mechanisms.
- Minimal JWT payload (`sub`, `username` only) — no sensitive data embedded in a token that's technically decodable (not just verifiable) by anyone who has it.
- Every mutation the audit log covers is logged with *who* (when known), *from where* (IP/UA), and *when* — not just *that* it happened.

### Common interview questions (with answers)

**Q: If a JWT is stored in an HttpOnly cookie, how does the frontend JavaScript know if the user is logged in?**
A: It doesn't read the cookie directly — it can't. Instead it calls an endpoint like `GET /api/auth/me`; the browser attaches the cookie automatically, the server verifies it, and the response (200 + admin info, or 401) tells the frontend the auth state.

**Q: What stops someone from just copying the JWT cookie value and using it elsewhere?**
A: Nothing about JWT itself — this is a real limitation, not solved by this design. `HttpOnly` stops *JavaScript* from reading it (defeats XSS-based theft), and `Secure` stops it being sent over plaintext HTTP (defeats network sniffing), but if someone has physical/direct access to the cookie store, it's usable until it expires. The 2-hour expiry bounds the damage window.

**Q: Why hash passwords instead of encrypting them?**
A: Encryption is reversible (there's a key to decrypt with) — hashing is designed to be one-way. You never need to recover the original password, only verify a guess against the stored hash, so a one-way function is strictly the correct tool, and it means even the application itself can't leak plaintext passwords because it never has them after registration/hashing.

**Q: Why increment `failed_attempts` in the database instead of just relying on the rate limiter?**
A: The rate limiter is per-IP; the lockout is per-account. An attacker with access to many IPs (a botnet, proxy rotation) can bypass a per-IP limiter entirely while still hammering one specific account — the account-level lockout stops that regardless of how many IPs are involved.

**Q: Your JWT expires in 2 hours with no refresh token. What happens to a user mid-task when it expires?**
A: Their next API call gets a `401` with `expired: true`; the shared frontend `apiRequest()` helper (or, for a page load, `errorHandler`'s redirect) sends them to `/login?expired=1`, which shows a "Session expired" toast. It's a deliberate simplicity trade-off for an admin tool used in short sessions — a consumer-facing product would more likely want a silent refresh-token flow instead of interrupting the user.

## License

MIT
