# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project doesn't yet follow strict [Semantic Versioning](https://semver.org/) tags (see [Future Enhancements](README.md#future-enhancements)).

## [Unreleased]

### Added
- Repository documentation overhaul: professional README, `docs/` folder (Architecture, API, Database, Security, Deployment, Cache), Mermaid diagrams throughout.
- Community health files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, this `CHANGELOG.md`.
- GitHub issue templates (bug report, feature request) and pull request template.
- GitHub Actions CI workflow (dependency install, syntax check, build verification).
- `package.json` metadata: description, keywords, author, repository/homepage/bugs links.

## [1.1.0] — Admin Authentication & Password Reset

### Added
- Full JWT-based admin authentication system: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PUT /api/auth/change-password`.
- `HttpOnly`/`Secure`/`SameSite=Lax` session cookie — no `localStorage` token storage.
- bcrypt password hashing (via `bcryptjs`), 12 salt rounds.
- Per-account login lockout (5 failed attempts → 15-minute lock) layered with per-IP rate limiting.
- Full audit log (`admin_logs` table) covering login, logout, password changes, and admin URL mutations.
- Protected admin dashboard, analytics dashboard, and all `/api/admin/*` endpoints.
- Login page with animated validation, password visibility toggle, "Remember me," and toast notifications.
- Profile dropdown (Profile / Change Password / Logout) on admin and analytics pages.
- OTP-based "Forgot password" flow (`POST /api/auth/forgot-password`, `POST /api/auth/reset-password`) — 6-digit code, SHA-256-hashed at rest, 10-minute expiry, one-time use.
- Email delivery via **Ethereal** (Nodemailer's sandboxed test SMTP service) — demonstrates a real SMTP send path without requiring or exposing any real email credentials in a public repository.
- `admins` and `admin_logs` tables; idempotent schema migration path for existing databases.

### Fixed
- MySQL strict mode rejected ISO 8601 datetime strings for `TIMESTAMP` columns — `expiresAt` is now converted to a `Date` object at the service boundary before reaching the database layer.

### Changed
- Public routes scoped deliberately: URL creation, redirect, metadata lookup, and QR code generation remain unauthenticated (part of the existing public landing-page flow); administrative mutations (update/delete/restore) and all `/api/admin/*` routes now require login.

## [1.0.0] — Initial Production-Ready Release

### Added
- Core URL shortening: `POST /api/url` with optional custom alias and expiry date.
- Duplicate URL detection via SHA-256 hash comparison (non-custom submissions only).
- Redirect endpoint (`GET /:shortCode`) backed by a hand-built, from-scratch **O(1) LFU (Least Frequently Used) cache** — no Redis, no external cache dependency.
- QR code generation for every short URL.
- Click analytics: click count, last-accessed timestamp, per-click event log (`click_events` table) powering a "clicks over time" chart.
- URL expiry and soft delete/restore.
- Admin dashboard APIs: list (search/sort/paginate), aggregate stats, most-clicked, cache statistics.
- Health check endpoint.
- Layered MVC + Service architecture (`config/constants/models/validators/cache/services/controllers/routes/middleware/utils`).
- Security middleware stack: Helmet, CORS, HPP, compression, XSS sanitization, rate limiting, parameterized SQL throughout.
- Centralized error handling with a custom `AppError` class and content-negotiated responses (JSON for API clients, styled HTML error pages for browser navigation).
- Structured logging (Morgan + custom app/error/request log files).
- Dark-themed, glassmorphism Bootstrap 5 frontend: landing page, admin dashboard, analytics dashboard (Chart.js), 404/500 pages.
- Deployed to Railway (app + managed MySQL, source-connected to `main` for continuous deployment).
