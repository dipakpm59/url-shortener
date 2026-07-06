# Architecture

Trimly is a layered monolith — one deployable Node.js process, internally organized into distinct layers with single responsibilities (Router → Controller → Validator → Service → Model/Cache). This document covers the system-level architecture; for API contracts see [API.md](API.md), for the database see [DATABASE.md](DATABASE.md), for the cache see [CACHE.md](CACHE.md).

## Why a layered monolith (not microservices)

Microservices solve organizational and independent-scaling problems — they don't automatically make an app faster or more "production-grade." This project has no team-ownership boundary and no component that needs to scale independently of the others, so a single well-layered process is the correct architecture, not a simplification. The layering itself (not the process count) is what gives us testability, single-responsibility modules, and the ability to swap implementations (e.g. LRU cache → Redis) without touching unrelated code.

## System Architecture

```mermaid
flowchart TB
    Client["Client<br/>(Browser / curl / Postman)"]

    subgraph Server["Express Server (server.js / src/app.js)"]
        MW["Security Middleware<br/>helmet · cors · hpp · compression<br/>rate-limit · xss sanitizer · cookie-parser"]
        Router["Router<br/>src/routes"]
        Controller["Controller<br/>src/controllers"]
        Validator["Validator<br/>src/validators"]
        Service["Service Layer<br/>src/services"]
        Auth["Auth Middleware<br/>verifyJWT → identifyActor / authenticateAdmin → requireAdmin"]
    end

    Cache[("LRU Cache<br/>in-memory")]
    DB[("MySQL<br/>via connection pool")]

    Client --> MW --> Router --> Controller
    Controller --> Validator
    Controller -.protected routes.-> Auth
    Controller --> Service
    Service --> Cache
    Service --> DB
```

## MVC + Service Layer flow

Every request follows the same shape, whether it's a URL-creation request from an admin or a regular user:

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Router
    participant Ctrl as Controller
    participant V as Validator
    participant S as Service
    participant M as Model
    participant DB as MySQL

    C->>R: HTTP request
    R->>Ctrl: matched route handler
    Ctrl->>V: validate input
    V-->>Ctrl: throws AppError on failure
    Ctrl->>S: call business logic
    S->>M: parameterized query
    M->>DB: SQL (named placeholders)
    DB-->>M: rows
    M-->>S: domain data
    S-->>Ctrl: result
    Ctrl-->>C: JSON response
```

**Why each layer exists:**

| Layer | Responsibility | Changes when... |
|---|---|---|
| Router (`src/routes`) | Maps URL + HTTP verb → controller function | An endpoint is added/renamed |
| Controller (`src/controllers`) | Translates HTTP req/res ↔ plain data | The API's request/response shape changes |
| Validator (`src/validators`) | Rejects malformed input before it reaches business logic | Validation rules change |
| Service (`src/services`) | Business logic — the only layer allowed to make multi-step decisions | Business rules change |
| Model (`src/models`) | Parameterized SQL, one function per query | The persistence layer or schema changes |

This is the **Single Responsibility Principle** applied at the architectural level: each layer has exactly one reason to change, which bounds the blast radius of any modification and makes each layer independently unit-testable.

## Node.js execution model (why this matters for the redirect hot path)

Node.js runs application JavaScript on a single thread but handles thousands of concurrent connections via an event loop and non-blocking I/O (backed by libuv). A route handler that does `await db.query(...)` doesn't block the thread while waiting — Node hands the I/O operation to the OS/libuv and is free to process other requests, resuming this handler only when the result is ready.

This is why:
- The **LRU cache lookup must be synchronous and in-memory** — any slow synchronous operation blocks the entire event loop for *every* request, not just the current one.
- **Analytics writes** (click count, last-accessed timestamp) fire *after* the redirect response is already sent, rather than being awaited first — the user should never wait on bookkeeping.

## Request flows

### URL creation
```mermaid
flowchart LR
    A["POST /api/url<br/>(requires admin or user session)"] --> B[Check daily limit<br/>non-admins only]
    B -- limit reached --> C[429 Too Many Requests]
    B -- ok --> D[Hash long_url, check for an existing entry owned by this caller]
    D -- found & not expired --> E[Return existing short URL]
    D -- not found --> F[Generate unique short code, INSERT owned by caller]
    F --> G[201 Created]
    E --> G
```

### Redirect (the hot path)
```mermaid
flowchart LR
    A["GET /:shortCode"] --> B{In LRU cache?}
    B -- hit --> C[Use cached long_url]
    B -- miss --> D[Query MySQL]
    D --> E[Populate cache]
    E --> C
    C --> F["302 redirect (response sent)"]
    F -.after response.-> G["Increment click_count,<br/>update last_accessed_at,<br/>insert click_events row"]
```

### Analytics aggregation
```mermaid
flowchart LR
    A["GET /api/admin/dashboard"] --> B[Aggregate totals from urls table]
    A --> C["Most-clicked (ORDER BY click_count)"]
    A --> D["Clicks over time (GROUP BY DATE from click_events)"]
    A --> E[LRU cache statistics]
    B & C & D & E --> F[Combined JSON response]
```

## Frontend

Static HTML5/Bootstrap 5/vanilla JS, served directly by Express (`public/` for assets, `views/` for pages) — no build step, no client-side framework. This keeps the app deployable as a single process with zero frontend tooling, appropriate for the project's scope.
