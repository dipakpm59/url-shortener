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

🔒 = requires a valid session cookie (admin or user — see [SECURITY.md](SECURITY.md) and the main [README's Authentication section](../README.md#authentication)). Endpoints under **Admin Endpoints** require an admin session specifically; `POST /api/url` accepts either.

---

## URL Endpoints

### `POST /api/url` 🔒 — Create a short URL
Requires an admin or user session. Rate-limited (20/min/IP).

**Body:**
```json
{
  "longUrl": "https://example.com/some/very/long/path",
  "expiresAt": "2026-12-31T00:00:00.000Z"
}
```
`expiresAt` is optional. The URL is owned by whichever session created it. Non-admin users are capped at `DAILY_URL_LIMIT_PER_USER` creations per day; admins are uncapped.

**Response `201 Created`** (or `200 OK` if an identical URL already exists and is reused):
```json
{
  "success": true,
  "message": "Short URL created successfully.",
  "data": {
    "id": 1,
    "shortCode": "aB3xY9z",
    "shortUrl": "http://localhost:3000/aB3xY9z",
    "longUrl": "https://example.com/some/very/long/path",
    "clickCount": 0,
    "createdAt": "2026-07-03T10:00:00.000Z",
    "lastAccessedAt": null,
    "expiresAt": null,
    "isDeleted": false,
    "deletedAt": null
  }
}
```

**Errors:** `400` invalid URL, `429` daily creation limit reached (non-admin users only).

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

---

## User Endpoints

Regular (non-admin) account holders. 🔑 = requires a valid user session cookie (same `admin_token` cookie, issued with a `USER` role claim instead of `ADMIN`).

### `POST /api/users/register` — Register
**Public.** Rate-limited (shares the login rate limiter). **Body:** `{ "username": "...", "email": "...", "password": "..." }`

### `POST /api/users/login` — Login
**Public.** **Body:** `{ "identifier": "...", "password": "...", "rememberMe": true }` (`identifier` is username or email). Sets the same `HttpOnly` JWT cookie pattern as admin login.

### `POST /api/users/logout` 🔑
Clears the session cookie.

### `GET /api/users/me` 🔑
Returns the current user's profile.

### `GET /api/users/me/urls` 🔑
Lists URLs owned by the current user (same `page`/`limit`/`search`/`sortBy`/`sortOrder` query params as `GET /api/admin/urls`).

### `DELETE /api/users/me/urls/:id` 🔑
Soft-deletes a URL — only if it's owned by the current user.

### `GET /api/users/me/analytics` 🔑
Per-user dashboard summary: this user's totals, most-clicked links, and clicks-over-time.

---

## Admin Endpoints
All require 🔒.

### `GET /api/admin/urls` — List URLs
**Query params:** `page`, `limit` (max 100), `search`, `sortBy` (`created_at`|`click_count`|`last_accessed_at`|`expires_at`), `sortOrder` (`asc`|`desc`), `includeDeleted` (`true`|`false`).

### `GET /api/admin/dashboard`
Combined: totals (URLs/clicks/deleted/expired), top 10 most-clicked, clicks-over-time (last 14 days), LRU cache statistics.

### `GET /api/admin/analytics`
Just the most-clicked + clicks-over-time subset of the above.

### `GET /api/admin/cache` — LRU cache statistics
```json
{ "success": true, "data": { "capacity": 500, "size": 12, "hits": 340, "misses": 45, "hitRate": 88.31, "evictions": 0, "puts": 57 } }
```

### `DELETE /api/admin/cache` — Clear the cache
Evicts everything immediately; the next redirect for any short code becomes a cache miss.
