# API Reference

Base URL (local): `http://localhost:3000`
Base URL (live): `https://web-production-581a.up.railway.app`

All responses are JSON with a consistent envelope:

```json
{ "success": true, "message": "...", "data": { ... } }
```

```json
{ "success": false, "status": "fail", "message": "..." }
```

🔒 = requires a valid `admin_token` cookie (see [SECURITY.md](SECURITY.md) and the main [README's Authentication section](../README.md#authentication)).

---

## URL Endpoints

### `POST /api/url` — Create a short URL
**Public.** Rate-limited (20/min/IP).

**Body:**
```json
{
  "longUrl": "https://example.com/some/very/long/path",
  "customAlias": "my-link",
  "expiresAt": "2026-12-31T00:00:00.000Z"
}
```
`customAlias` and `expiresAt` are optional.

**Response `201 Created`** (or `200 OK` if an identical non-alias URL already exists and is reused):
```json
{
  "success": true,
  "message": "Short URL created successfully.",
  "data": {
    "id": 1,
    "shortCode": "my-link",
    "shortUrl": "http://localhost:3000/my-link",
    "longUrl": "https://example.com/some/very/long/path",
    "isCustomAlias": true,
    "clickCount": 0,
    "createdAt": "2026-07-03T10:00:00.000Z",
    "lastAccessedAt": null,
    "expiresAt": null,
    "isDeleted": false,
    "deletedAt": null
  }
}
```

**Errors:** `400` invalid URL / invalid alias format / reserved alias, `409` alias already taken.

### `GET /api/url/:shortCode` — Get metadata
**Public.** Returns the same shape as above. `404` if not found, `410` if expired.

### `GET /api/url/:shortCode/qrcode` — Get a QR code
**Public.** Returns `{ "data": { "qrCode": "data:image/png;base64,..." } }`.

### `PUT /api/url/:id` 🔒 — Update destination
**Body:** `{ "longUrl": "https://new-destination.com" }`

### `DELETE /api/url/:id` 🔒 — Soft-delete
Sets `is_deleted = true`, `deleted_at = NOW()`. Audit-logged as `delete_url`. Does not remove the row.

### `POST /api/url/:id/restore` 🔒 — Restore
Clears `is_deleted`/`deleted_at`. Audit-logged as `restore_url`.

### `GET /:shortCode` — Redirect
**Public.** Not under `/api` — this is the actual short link. Cache-aside lookup (see [CACHE.md](CACHE.md)), then `302` to the original URL. `404`/`410` (rendered as a styled HTML page for browser navigation, JSON for API clients) if not found/expired.

---

## Auth Endpoints

### `POST /api/auth/login` — Login
**Public.** Rate-limited (20/15min/IP) + per-account lockout (5 failed attempts → 15 min).

**Body:** `{ "email": "...", "password": "...", "rememberMe": true }`

Sets an `HttpOnly` JWT cookie on success. `rememberMe` controls whether the cookie persists past browser close (the JWT's own 2-hour expiry is unaffected either way).

**Errors:** `401` invalid credentials (generic — never reveals which field was wrong), `403` account locked.

### `POST /api/auth/logout` 🔒
Clears the session cookie. Audit-logged.

### `GET /api/auth/me` 🔒
Returns the current admin's profile (`id`, `username`, `email`, `createdAt` — password hash is never included).

### `PUT /api/auth/change-password` 🔒
**Body:** `{ "currentPassword": "...", "newPassword": "...", "confirmPassword": "..." }`
New password must be 8+ characters with uppercase, lowercase, a digit, and a special character.

### `POST /api/auth/forgot-password` — Request an OTP
**Public.** Rate-limited (5/hour/IP). **Body:** `{ "email": "..." }`
Always returns the same generic message (prevents email enumeration). In non-production, the response includes `data.previewUrl` — a link to view the "sent" email (see [SECURITY.md](SECURITY.md) for why this project uses a sandboxed test mailer instead of a real SMTP account).

### `POST /api/auth/reset-password` — Verify OTP + set new password
**Public.** Rate-limited (10/15min/IP — a 6-digit OTP has only ~1M combinations, so verification attempts must be capped tightly).
**Body:** `{ "email": "...", "otp": "123456", "newPassword": "...", "confirmPassword": "..." }`
OTP is single-use and expires after 10 minutes. A successful reset also clears any account lockout.

---

## Admin Endpoints
All require 🔒.

### `GET /api/admin/urls` — List URLs
**Query params:** `page`, `limit` (max 100), `search`, `sortBy` (`created_at`|`click_count`|`last_accessed_at`|`expires_at`), `sortOrder` (`asc`|`desc`), `includeDeleted` (`true`|`false`).

### `GET /api/admin/dashboard`
Combined: totals (URLs/clicks/deleted/expired), top 10 most-clicked, clicks-over-time (last 14 days), LFU cache statistics.

### `GET /api/admin/analytics`
Just the most-clicked + clicks-over-time subset of the above.

### `GET /api/admin/cache` — LFU cache statistics
```json
{ "success": true, "data": { "capacity": 500, "size": 12, "hits": 340, "misses": 45, "hitRate": 88.31, "evictions": 0, "puts": 57 } }
```

### `DELETE /api/admin/cache` — Clear the cache
Evicts everything immediately; the next redirect for any short code becomes a cache miss.

---

## Health

### `GET /health` 🔒
```json
{ "success": true, "status": "healthy", "uptimeSeconds": 372, "timestamp": "...", "database": "ok" }
```
Note: this sits behind admin auth (see [SECURITY.md](SECURITY.md) for why), so it isn't currently wired up as an automated infra health check on the live deployment.
