# Security

Technical deep-dive into this project's security design. For how to *report* a vulnerability, see the top-level [SECURITY.md](../SECURITY.md).

## Threat-model summary

Two account types — admins (full access) and regular users (own their own links) — sharing one JWT/cookie session mechanism. The attack surface that matters most: (1) the redirect endpoint being abused, (2) admin/user login being brute-forced, (3) a stolen session token, (4) injection (SQL/XSS/HPP) against public input fields.

## Authentication

Shown below for the admin login flow (`/api/auth/login`); user login (`/api/users/login`) follows the identical shape against the `users` table instead of `admins`.

```mermaid
sequenceDiagram
    participant U as Admin
    participant API as /api/auth/login
    participant S as auth.service
    participant DB as MySQL

    U->>API: POST {email, password}
    API->>S: login()
    S->>DB: findByEmail(email)
    alt not found
        S-->>API: generic "Invalid email or password" (401)
    else locked_until in the future
        S-->>API: "Account locked, try again in N minutes" (403)
    else
        S->>S: bcrypt.compare(password, password_hash)
        alt wrong password
            S->>DB: increment failed_attempts
            alt now >= 5
                S->>DB: set locked_until = now + 15min
                S-->>API: "Too many failed attempts" (403)
            else
                S-->>API: generic "Invalid email or password" (401)
            end
        else correct password
            S->>DB: reset failed_attempts, locked_until = NULL
            S->>S: sign JWT (2h expiry)
            S-->>API: token
            API-->>U: Set-Cookie: admin_token (HttpOnly, SameSite=Lax, Secure in prod)
        end
    end
```

**Why bcrypt, not SHA-256 or plaintext:** plaintext leaks directly on any DB breach. General-purpose fast hashes (SHA-256) are *designed* to be fast — exactly wrong for passwords, since it makes brute-forcing billions of guesses/sec on cheap GPU hardware trivial. bcrypt is deliberately slow with a tunable cost factor (12 rounds here) and salts automatically, defeating both brute-force and rainbow-table attacks.

**Why generic error messages:** "Invalid email or password" never reveals *which* field was wrong — a message like "no account with that email" would let an attacker enumerate valid admin emails.

## Authorization: the three-middleware chain

```mermaid
flowchart LR
    Req[Incoming request] --> V["verifyJWT<br/>(decode + check signature/expiry — no DB hit)"]
    V -- invalid/missing --> R1["401 JSON (API) or redirect /login or /account (page)"]
    V -- valid --> A["authenticateAdmin / authenticateUser<br/>(DB lookup: does this account still exist?)"]
    A -- not found --> R2[401 / redirect, cookie cleared]
    A -- found --> G["requireAdmin / requireUser<br/>(role guard)"]
    G --> H[Route handler, req.admin or req.user available]
```

Three separate middlewares instead of one combined check:
- `verifyJWT` is cheap (no DB) and runs on every protected request without adding database load just to check a signature. It decodes the JWT's `role` claim (`ADMIN` or `USER`) but doesn't dispatch on it itself.
- `authenticateAdmin`/`authenticateUser` catch the case where an account was deleted (or, for users, deactivated) *after* a still-unexpired token was issued.
- `requireAdmin`/`requireUser` are thin role guards — most routes need exactly one of the two; `POST /api/url` is the one route that accepts either, via a separate `identifyActor` middleware that dispatches on the JWT's role claim and normalizes both account shapes into `req.actor` (see `src/middleware/auth.middleware.js`).

## Session / cookie security

| Flag | Effect |
|---|---|
| `httpOnly: true` | Client-side JavaScript cannot read the cookie at all — the primary defense against token theft via XSS. |
| `secure: true` (production) | Cookie is only ever transmitted over HTTPS. |
| `sameSite: 'lax'` | Cookie isn't attached to most cross-site requests — mitigates CSRF. |
| 2-hour JWT expiry | Bounds the damage window of a compromised token; no server-side revocation exists, so short expiry is the primary mitigation (see [README's Interview Prep](../README.md#interview-prep) for the full trade-off discussion). |

**Why not `localStorage`:** fully readable by any JavaScript on the page — your own code, a compromised third-party script, or an injected XSS payload. A single XSS bug anywhere means full token exfiltration. An `HttpOnly` cookie removes the token from JS's reach entirely, and the browser attaches it automatically (no manual fetch header wiring, no place to forget it).

## Brute-force defense in depth

Two independent mechanisms, deliberately not merged into one:
- **Per-account lockout** (`admins.failed_attempts`/`locked_until`) — stops one account being brute-forced from many IPs (e.g. a botnet).
- **Per-IP rate limiting** (`loginLimiter` in `src/middleware/rateLimiter.js`, shared by admin login and user register/login) — stops one IP from brute-forcing/spamming many accounts.

## Injection defense

- **SQL injection**: every query in `src/models/*.model.js` uses `mysql2`'s named placeholders — user input is never string-concatenated into SQL.
- **XSS**: `src/middleware/security.js` sanitizes `req.body`/`req.query`/`req.params` recursively via the `xss` package before any handler sees them; Helmet also sets a restrictive Content-Security-Policy.
- **HPP (HTTP Parameter Pollution)**: `hpp()` middleware strips duplicate query parameters that could otherwise confuse validation logic.

## Audit logging

Every security-relevant action is recorded in `admin_logs` with the acting admin (when known), IP, user agent, and timestamp: `login`, `login_failed`, `account_locked`, `login_blocked_locked`, `logout`, `password_change`, `delete_url`, `restore_url`, `delete_user`.

## Known limitations (stated explicitly, not hidden)

- No JWT revocation mechanism — a stolen token is valid until it naturally expires (2 hours). A production system handling more sensitive data would add a token blocklist or move to short-lived access tokens + refresh tokens.
- No public infrastructure health-check endpoint — the health check was removed along with its authenticated-only route; see [README's Future Enhancements](../README.md#future-enhancements) for the planned public `GET /healthz` replacement.
