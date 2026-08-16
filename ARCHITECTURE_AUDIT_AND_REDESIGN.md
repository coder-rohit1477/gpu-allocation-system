# GPU Resource Management Platform — Architecture Audit & Redesign

**Status:** Architecture proposal only. No application source was changed.

**Audit scope:** Repository source, configuration, OpenAPI definition, tests, deployment files, existing architecture/testing/realtime/conflict documentation, and the bundled project report were reviewed. The current application is a functional academic prototype with useful foundations, but it is not yet production-ready for the stated university-scale workload.

## 1. Executive Summary

The repository currently contains a JavaScript MERN application: React 19/Vite frontend, Express 4 API, MongoDB/Mongoose persistence, Socket.IO notifications, Docker Compose, Swagger documentation, and integration-focused Jest tests. Its strongest existing components are the role-oriented user interface, JWT access-token plus httpOnly refresh-cookie pattern, global error handling, basic health endpoints, OpenAPI surface, audit-log concept, and integration-test baseline.

The present design supports a small, single-lab prototype workflow: a student creates a request; any faculty user can approve or reject it; an administrator manages a flat GPU list. It has three roles (`STUDENT`, `FACULTY`, `ADMIN`), four MongoDB collections, one Node process, and no external cache, job queue, durable notification system, SSO, lab/department model, GPU telemetry integration, or horizontal Socket.IO adapter.

The target platform should be built as a **modular monolith first**, not as a set of independently deployed microservices. A TypeScript backend with clearly bounded domain modules, PostgreSQL as the transactional system of record, Redis for cache/queue/realtime coordination, and a worker process provides the needed consistency and operational simplicity. It can later split high-volume telemetry, analytics, or notification workloads without breaking its domain boundaries.

The redesign retains the valuable concepts and user-facing flows already present, while replacing unsafe allocation state management and adding the organizational, scheduling, observability, security, and operations capabilities required for 10,000+ students, 500+ faculty, multiple labs, and scoped administration.

### Current repository structure

```text
.
├── README.md
├── docker-compose.yml
├── .github/workflows/ci.yml
├── docs/
│   ├── architecture.md
│   ├── conflict-detection.md
│   ├── diagram-specifications.md
│   ├── realtime-notifications.md
│   ├── testing-strategy.md
│   └── images/
├── backend/
│   ├── app.js                         # Runtime entry point
│   ├── Dockerfile
│   ├── package.json
│   ├── scripts/seed.js
│   ├── server/
│   │   ├── app.js                     # Express composition
│   │   ├── index.js                   # HTTP/Mongo/Socket.IO boot
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── docs/openapi.js
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── modules/audit-log/
│   │   ├── realtime/
│   │   ├── routes/
│   │   └── utils/
│   └── tests/
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── vite.config.js
    ├── public/GPU_PBL_Report.pdf
    └── src/
        ├── api/
        ├── components/
        ├── config/
        ├── context/
        ├── hooks/
        ├── pages/
        └── services/
```

### Existing technology stack and deployment

| Area | Current implementation |
|---|---|
| Frontend | React 19, React Router 7, Vite 7, Axios, Sonner, Tailwind/PostCSS |
| Backend | Node.js 18+, JavaScript CommonJS, Express 4, Socket.IO |
| Data | MongoDB 7, Mongoose 8; MongoMemoryServer in tests |
| Security | Helmet, CORS allow-list, HPP, bcryptjs, JWT, httpOnly refresh cookie, IP rate limits |
| API | REST at `/api/v1`, handwritten OpenAPI 3.0.3, Swagger UI |
| Runtime | Docker Compose: MongoDB, one backend container, Nginx-served frontend |
| CI | GitHub Actions runs backend Jest tests and frontend production build |

## 2. Problems in Current Architecture

### Current frontend architecture and state management

The frontend is a single React SPA. `main.jsx` wraps `BrowserRouter`, `AuthProvider`, and toast notifications. `App.jsx` lazy-loads three large role dashboards and applies client-side route guards. Each dashboard contains multiple embedded page components, local `useState`/`useEffect` data fetching, and direct service calls. Authentication state is held in React Context and duplicated in `localStorage`; Axios interceptors attach and refresh access tokens.

This is appropriate for the prototype but does not scale in maintainability:

- Role pages are monolithic files (student, faculty, and administrator dashboards) rather than feature modules with isolated routes, query hooks, forms, and tests.
- There is no server-state library, cache invalidation policy, request cancellation, optimistic concurrency model, or normalized domain cache. Repeated dashboard loads can create unnecessary API traffic.
- The README describes a Socket.IO client, but the frontend has no `socket.io-client` dependency and no connection/event subscription implementation. Therefore approval/rejection events are not actually rendered live in the current UI.
- Client route guards only improve user experience; backend guards remain the authorization boundary. The UI does not model departmental/lab permissions or the requested five target roles.
- Access tokens in `localStorage` remain exposed to successful XSS. The httpOnly refresh cookie is a good foundation, but this combination is a residual security risk.

### Current backend and API architecture

The Express backend uses routes → controllers → Mongoose models, with shared auth middleware, error middleware, a lightweight audit-log service, and Socket.IO helper. This is a clear starter layout, but controllers contain orchestration, validation, scheduling, inventory mutation, audit writes, and notification emission together. There are no application-use-case boundaries, repository interfaces, transaction boundary abstraction, input schemas, policy layer, idempotency controls, or background workers.

The REST surface is compact and documented, but it only covers authentication, flat GPU CRUD, request lifecycle, administrator summaries/audits, and coarse analytics. It lacks departments, labs, nodes, GPU partitions, maintenance records, class allocations, bulk assignments, reservations, recurring rules, waitlists, notification preferences/inbox, telemetry, user lifecycle management, and report exports.

### Current database design

MongoDB collections are `users`, `gpuresources`, `gpurequests`, and `auditlogs`. References exist between user, request, resource, and auditor, but there is no first-class representation of organization, department, laboratory, compute node, GPU partition, reservation occurrence, class/course, waitlist, maintenance, telemetry, session, notification, or authorization scope.

The data model conflates three distinct concerns:

- A physical GPU inventory item,
- its instantaneous condition/availability, and
- scheduled capacity (`availableVRAM`).

`availableVRAM` is decremented on approval and restored to the *full* GPU VRAM when any one request completes. This can overwrite remaining concurrent allocations. It is also not time-aware: non-overlapping future approvals permanently reduce capacity before their reservation starts. `status` has overlapping semantics (`Available`, `In Use`, `Allocated`, `Maintenance`) that cannot correctly represent booked-in-future versus active-now versus partially allocated capacity.

### Correctness, scalability, and performance bottlenecks

- **Race conditions in approval:** Approval reads the request/GPU, checks conflict and VRAM, then saves GPU and request in separate non-transactional operations. Simultaneous approvals can both pass checks and over-allocate. The code explicitly removed MongoDB transactions for standalone compatibility.
- **Incorrect capacity restoration:** Completing one approved request resets `availableVRAM` to the GPU's total VRAM, even if other valid allocations exist.
- **Global queues and authority:** Every faculty member sees every pending request and can approve any of them. There is no lab/department ownership or faculty assignment policy.
- **Unindexed critical queries:** Schemas do not declare indexes for conflict lookup, pending queues, audit pagination, status/date reporting, or user-scoped request history. Large collections will cause collection scans and expensive sort/skip pagination.
- **Offset pagination:** `skip()` slows increasingly with page depth and produces unstable results during concurrent writes. Cursor/keyset pagination is required for high-volume lists.
- **Synchronous request-path work:** Audit writes and Socket.IO emits run within controllers. There is no outbox/event delivery guarantee and no retry/dead-letter path. The audit service deliberately swallows failures, losing evidence without alerting the platform.
- **No cache or queue:** Aggregate dashboards run live counts on every request; no caching, preaggregation, reminder scheduler, waitlist processor, email worker, or analytics pipeline exists.
- **Single process runtime:** One API process owns Socket.IO in memory. Multiple backend replicas would fragment user rooms and cannot broadcast correctly without a Redis adapter; scheduled work would also duplicate without leader/queue controls.
- **No GPU telemetry ingestion:** “Live” resource utilization is a static inventory status, not data from nodes. There is no authenticated agent, telemetry store, heartbeat, health rule, or session lifecycle integration.
- **Operational gaps:** Docker Compose mounts application source into the production backend container, has no resource limits, no PostgreSQL/Redis, no image registry/deployment strategy, no backup/restore plan, no migrations, and no observability stack. Vercel's SPA rewrite file does not route API/WebSocket traffic to an API host.
- **Test/CI gaps:** Backend tests cover important happy paths, authorization basics, health, and Socket.IO. They do not cover concurrent approvals, refresh rotation, role/tenant scope, failure recovery, queue behavior, load, frontend behavior, accessibility, security scanning, or migration. CI has no linting, type checking, dependency audit, container scan, integration environment, or deployment gate.

### Security risks

- Public self-signup permits unrestricted creation of student accounts. A university identity proof, verified email/domain, invitation, or SSO should be required.
- Access tokens are persisted in `localStorage`, creating an XSS theft risk. Refresh tokens are persisted as one hashed value per user, which permits only one device/session and lacks device/session revocation, rotation lineage, reuse detection, and logout-all support.
- Refresh expiry configuration exists but issuance hard-codes seven days; configured lifetime is not applied consistently.
- The refresh endpoint changes authentication state but has no explicit CSRF defense beyond `SameSite=Strict`. A future cross-site SSO/cookie deployment needs CSRF tokens or strict origin verification.
- Role checks are coarse and do not apply ownership/scoping rules. `FACULTY` approval is not restricted to a department, lab, course, or assigned queue; `ADMIN` is effectively a global super-admin.
- GPU update accepts the request body directly in `findByIdAndUpdate`, allowing unexpected mutable fields and potentially corrupting allocation-derived state. GPU deletion does not guard against active/future reservations or retain an audit-safe inventory history.
- Security logging includes console output for origins, socket IDs, user IDs, and authentication failures; production logs should be structured, redacted, retained, and access-controlled.
- No MFA policy exists for privileged roles, no SSO OIDC/SAML integration, no password-reset/email-verification flow, no account lockout by identity, no bot protection, and no centralized secrets manager.
- OpenAPI's global bearer security can misrepresent public endpoints, and several documented response schemas differ from actual responses. An inaccurate contract can create insecure or failing integrations.

### What should be preserved

- The existing role-oriented UX and reusable portal layout can be evolved rather than discarded.
- REST versioning under `/api/v1`, centralized error handling, request-size limits, Helmet, CORS configuration, health endpoints, Swagger UI, and test setup are worthwhile foundations.
- JWT access tokens with refresh cookies, bcrypt password hashing, Socket.IO room targeting, audit event vocabulary, and conflict detection intent should be retained conceptually while redesigned for correctness.
- The existing deployment containers and CI pipeline are useful starting points, but require production hardening rather than wholesale abandonment.

## 3. Proposed Architecture

### Architectural style

Adopt a **TypeScript modular monolith** with clean, domain-oriented boundaries and asynchronous integration through an outbox plus queue. One deployable API and one deployable worker are sufficient initially. The modules communicate through application interfaces and domain events, not direct cross-module database access. This is easier to test, operate, and evolve than prematurely splitting into microservices.

Recommended implementation direction:

- **API:** Node.js 22 LTS, TypeScript, NestJS with Fastify adapter (or a disciplined Express/Fastify TypeScript architecture if framework migration is not approved). NestJS is recommended for its modules, dependency injection, validation, OpenAPI generation, WebSocket gateways, and test structure.
- **Persistence:** PostgreSQL 16+, accessed using Prisma or Drizzle/Kysely for migrations and typed queries. Use SQL features deliberately for transaction locking, exclusion constraints, JSONB metadata, materialized summaries where helpful, and read replicas later.
- **Cache, coordination, queue:** Redis 7+ with BullMQ. Use Redis for cache, rate limits, Socket.IO adapter, distributed locks only where needed, and delayed/retryable jobs.
- **Realtime:** Socket.IO/WebSocket gateway backed by Redis adapter. A standard event envelope supports replay recovery through REST rather than relying on socket durability.
- **Telemetry:** A small GPU node agent (Python or Go) deployed on each managed compute host, reporting mTLS-authenticated heartbeats and NVIDIA/DCGM or `nvidia-smi` metrics to an ingestion API. Store recent metrics in PostgreSQL partitions initially; move high-volume time series to TimescaleDB/ClickHouse if retention/query load demands it.
- **Notifications:** Notification module writes durable inbox records and outbox events. Workers deliver email and websocket notifications with templates, retries, deduplication, and a dead-letter queue.
- **Identity:** University IdP integration through OIDC first; SAML 2.0 adapter if required. Local password login remains optional as a break-glass/onboarding path, not the primary path.

### Scheduling model

Treat scheduling as a first-class domain rather than mutating a GPU's global `availableVRAM` field.

1. A physical GPU belongs to a compute node and lab, and may expose schedulable capacity as an exclusive GPU, a MIG/vGPU partition, or a configured capacity pool.
2. A reservation is a requested/approved time interval with a resource requirement and policy snapshot.
3. An approved reservation receives one or more allocations against actual schedulable units.
4. For exclusive units, PostgreSQL prevents overlap using a `tstzrange` exclusion constraint. For shared capacity/MIG, availability is calculated for the requested interval under a transaction and allocation rows are inserted with locking/serializable retry.
5. Recurring reservations use a recurrence rule plus materialized reservation occurrences in a scheduling horizon (for example, 90 days), making conflicts observable and enforceable.
6. Waitlist advancement runs in a worker whenever an allocation is cancelled/rejected/expired or capacity changes. It never silently approves a request; it creates an offer with an expiry or uses the configured policy.
7. Maintenance places a resource into a non-bookable state and triggers a conflict/relocation workflow for affected future reservations.

### Deployment topology

Use stateless API and worker containers behind an ingress/load balancer. PostgreSQL and Redis must run as managed HA services or properly operated clustered services in the university data center. Frontend assets are served from object storage/CDN or Nginx, while `/api` and `/socket.io` route to the API ingress. Kubernetes is appropriate once the university has an operations platform; Docker Compose remains for local development and an institutional pilot.

## 4. High-Level Component Diagram (text)

```text
Students / Faculty / Lab Admins / Department Admins / Super Admin
                              |
                              v
                  CDN / WAF / TLS Ingress / Load Balancer
                     |                         |
                     |                         +--> University IdP (OIDC/SAML)
                     v
             React Web Application (SPA/PWA)
                     |
            HTTPS REST + authenticated WebSocket
                     v
     +--------------------------------------------------+
     | Stateless API replicas                           |
     |--------------------------------------------------|
     | Identity & RBAC | Users & Organizations          |
     | Labs & Inventory | Health & Telemetry            |
     | Reservations & Scheduling | Classes              |
     | Waitlist | Notifications | Analytics | Audit      |
     +-------------------+------------------------------+
                         |                 |
          transactions   |                 | cache, queue, socket adapter,
                         v                 | rate limits, locks
              PostgreSQL primary <--------> Redis
              |  users, permissions,       |
              |  reservations, audit,      v
              |  telemetry, outbox    Worker replicas (BullMQ)
              |                         | reminders / email / waitlist /
              |                         | outbox dispatch / aggregates
              v                         v
     Read replica / analytics store    Email provider / in-app inbox / WebSocket

GPU Compute Nodes
  └─ Node Agent (mTLS) -> Telemetry Ingestion API -> health/metrics storage
                                      |
                                      +-> resource-state events -> WebSocket/API cache invalidation
```

## 5. Folder Structure

The following target is a monorepo structure. It preserves the current frontend/backend separation while making contracts, database migrations, workers, and deployment assets explicit.

```text
.
├── apps/
│   ├── web/                            # React + TypeScript frontend
│   │   └── src/
│   │       ├── app/                    # providers, routes, query client
│   │       ├── features/               # auth, reservations, inventory, analytics...
│   │       ├── components/             # shared presentational components
│   │       ├── lib/                    # API client, websocket client, utilities
│   │       └── test/
│   ├── api/                            # NestJS/Fastify modular API
│   │   └── src/
│   │       ├── bootstrap/
│   │       ├── common/                 # errors, auth guards, validation, observability
│   │       └── modules/                # bounded contexts listed below
│   ├── worker/                         # BullMQ processors and scheduled jobs
│   └── node-agent/                     # optional GPU-host telemetry agent
├── packages/
│   ├── contracts/                      # OpenAPI-derived/shared DTO types and event schemas
│   ├── config/                         # shared lint, TypeScript, test config
│   ├── design-system/                  # reusable React UI components/tokens
│   └── policy/                         # role/permission constants and policy helpers
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── sql/                            # constraints, views, retention jobs
├── docs/
│   ├── adr/                            # architecture decision records
│   ├── api/
│   ├── runbooks/
│   ├── security/
│   └── migration/
├── infra/
│   ├── docker/                         # local compose and development images
│   ├── kubernetes/                     # Helm/Kustomize manifests when adopted
│   ├── terraform/                      # cloud or data-center IaC where applicable
│   └── monitoring/                     # dashboards, alerts, log/trace config
├── e2e/                                # Playwright end-to-end journeys
└── .github/workflows/
```

Within each backend module, use the same shape: `domain/` (entities, policies, events), `application/` (use cases and ports), `infrastructure/` (SQL/Redis/provider adapters), and `presentation/` (REST/WebSocket DTOs/controllers). Cross-module access occurs through application interfaces or events.

## 6. Backend Modules

| Module | Responsibility |
|---|---|
| Identity & Access | OIDC/SAML federation, local fallback credentials, sessions, refresh-token rotation, MFA for privileged roles, account lifecycle, device/session revocation. |
| Organizations & RBAC | University, departments, labs, role bindings, scoped permissions, delegations, policy evaluation. |
| Users | University profile synchronization, student/faculty affiliation, enrollment status, notification preferences, user search/admin management. |
| Inventory | Lab locations, compute nodes, physical GPUs, schedulable GPU units/partitions, capability tags, lifecycle/decommissioning, ownership. |
| Health & Telemetry | Node-agent enrollment, mTLS credentials, heartbeats, GPU health state machine, metrics ingestion/query, maintenance triggers. |
| Reservations & Scheduling | Requests, approvals, allocation planning, availability search, conflict prevention, recurrence/occurrences, cancellation, expiration, check-in/out. |
| Waitlist & Policy | Priority calculation, quotas, fairness rules, waitlist ordering, offers, expiration and promotion. |
| Courses & Classes | Course sections, faculty ownership, class reservations, roster imports, bulk student assignments and delegated access. |
| Sessions | Live session status, connection metadata, active allocation lifecycle, quota/time enforcement integration with lab tooling. |
| Notifications | In-app inbox, email templates, preferences, delivery attempts, reminders, idempotency and failure handling. |
| Analytics & Reporting | Operational aggregates, utilization/peak-hours/department/faculty reports, CSV/PDF export jobs, retention-aware query endpoints. |
| Audit & Compliance | Append-only audit events, actor/impersonation/IP/request context, integrity checks, retention/export and privileged access. |
| Realtime | Authenticated WebSocket gateway, scoped rooms, event authorization, Redis adapter, event schema/versioning. |
| Platform | Configuration, feature flags, health/readiness, structured logging, OpenTelemetry, rate limits, API idempotency, outbox publisher. |

## 7. Frontend Modules

Use React + TypeScript with feature-sliced modules, TanStack Query for server state, React Hook Form plus Zod for forms, and a typed API client generated from OpenAPI. Retain the current portal layout and visual language where desired.

| Module | Screens/capabilities |
|---|---|
| App shell | Authentication bootstrap, routing, error boundaries, feature flags, theme/accessibility, query/websocket providers. |
| Authentication | SSO redirect/callback, session-expiry UX, optional local login, device/session management. |
| Student portal | Availability search, request/reservation wizard, calendar, queue/waitlist position, live session, history, notifications. |
| Faculty portal | Approval inbox scoped to owned labs/courses, class/lab reservation planner, roster bulk assignment, reports. |
| Lab admin portal | Lab inventory, maintenance, live health/utilization, local queue, manual incident handling. |
| Department admin portal | Department users, policies/quotas, cross-lab utilization, departmental reporting. |
| Super-admin portal | Institution configuration, global roles, IdP settings, departments/labs, audit/compliance, platform analytics. |
| Reservation calendar | Timezone-aware calendar, recurrence editor, availability grid, conflict and policy explanation. |
| Inventory & health | Node/GPU detail pages, historical telemetry, maintenance scheduling, status overrides with audit justification. |
| Notifications | In-app inbox, unread state, preferences, deep links from emails/websocket messages. |
| Shared UI | Accessible tables with cursor pagination, filters, date/time controls, role-aware navigation, charts, export controls. |

Frontend state is divided deliberately: local UI state in component/form state; server state in TanStack Query; identity/session state in a small auth store; and realtime events used only to invalidate/update relevant query keys. The REST API remains the authoritative recovery path after reconnects or missed events.

## 8. Database Tables

All operational tables use UUID primary keys, `created_at`, `updated_at`, and, where appropriate, `created_by`/`updated_by`. Timestamps are stored as `timestamptz` in UTC. Foreign keys use restrictive or explicitly documented lifecycle behavior. Sensitive fields are encrypted or excluded from normal query paths. `organization_id` is included where future multi-campus or multi-university separation is valuable.

| Table | Key columns and purpose |
|---|---|
| `organizations` | Institution/campus tenant boundary, policy defaults. |
| `departments` | `organization_id`, code, name, active status. |
| `labs` | `department_id`, location, timezone, operating hours, contact and policy overrides. |
| `users` | University subject ID, email, display name, status, identity provider links; no raw IdP tokens. |
| `user_identities` | Provider, issuer, subject, verified claims, last sync; unique `(provider, issuer, subject)`. |
| `roles` | Five system roles plus optional future roles. |
| `permissions` | Fine-grained actions such as `reservation.approve`, `lab.manage`, `audit.read`. |
| `role_permissions` | Role-to-permission mapping. |
| `role_bindings` | `user_id`, role, scope type/id (institution, department, lab, course), expiry and grantor. |
| `refresh_sessions` | Hashed rotating refresh token, family ID, device metadata, expiry, revoked/reused timestamps. |
| `courses` | Department course catalog. |
| `course_sections` | Course term/section, faculty owner, roster source. |
| `course_memberships` | Student/faculty enrollment and status. |
| `compute_nodes` | Lab host, hostname/asset tag, agent identity, OS, capacity, heartbeat, lifecycle status. |
| `gpu_models` | Normalized manufacturer/model specs: VRAM, architecture, capabilities. |
| `gpus` | Physical GPU inventory: `compute_node_id`, model, serial/asset tag, topology, lifecycle state. |
| `gpu_units` | Schedulable unit: full GPU, MIG slice, vGPU profile, or capacity pool; capacity/status. |
| `gpu_health_snapshots` | Current derived health/state per GPU/unit, temperature/utilization/memory, observed timestamp. |
| `gpu_metrics` | Append/partitioned time series: unit, timestamp, utilization, memory, temperature, power, process/session metadata. |
| `maintenance_windows` | Planned/unplanned maintenance, affected resource, interval, reason, actor, resolution status. |
| `reservation_requests` | User/faculty/class request, desired resources, interval, purpose, policy snapshot, lifecycle status. |
| `reservation_recurrence_rules` | RFC 5545-style recurrence rule, timezone, horizon, exception dates. |
| `reservation_occurrences` | Concrete scheduled intervals derived from a request/recurrence. Use `tstzrange(start_at, end_at, '[)')`. |
| `reservation_allocations` | Occurrence-to-`gpu_unit` allocation, allocated capacity, allocation state, provisioning/session reference. |
| `approval_decisions` | Approver, decision, reason, timestamp, policy/version snapshot; supports multi-step approval where configured. |
| `waitlist_entries` | Request/occurrence, priority components, position, state, offer expiry, promotion history. |
| `resource_quotas` | Scope and policy period: hours, concurrent units, VRAM/GPU class limits, priority rules. |
| `usage_ledger` | Immutable actual or booked resource consumption, source, duration/capacity, department/course attribution. |
| `live_sessions` | Allocation activation, host/session references, user, started/ended/last-seen timestamps, status. |
| `notifications` | In-app notification content/reference, audience, read/archive timestamps. |
| `notification_deliveries` | Channel, provider message ID, attempt/state/error, deduplication key. |
| `audit_events` | Append-only actor/action/target, correlation ID, IP/user-agent, before/after summary, hash chain/retention class. |
| `outbox_events` | Transactionally stored domain event, payload/version, occurred/published timestamps, retry state. |
| `idempotency_keys` | Actor/key/request hash/response reference/expiry for safe mutating API retries. |
| `report_jobs` | Long-running analytics/export request, filter, status, storage reference, expiry. |

### Required database constraints and indexes

- A PostgreSQL exclusion constraint on exclusive active allocations, conceptually: `EXCLUDE USING gist (gpu_unit_id WITH =, time_range WITH &&) WHERE (state IN ('RESERVED','ACTIVE'))`. This prevents overlap at the database level, even under concurrent API requests.
- For shareable capacity, use serializable transaction retries or resource-interval locking plus a capacity aggregation query; do not infer capacity from a mutable GPU column.
- Foreign keys from allocations to active inventory units; no physical GPU hard deletion when history exists—use lifecycle states.
- Partial indexes for queues, e.g. pending requests by lab/department/created time; active/future occurrences by unit/time; unread notifications by user/time; and audit events by timestamp/actor/action.
- Keyset indexes for list APIs, such as `(organization_id, created_at DESC, id DESC)` and scoped variants.
- Partition `gpu_metrics`, `audit_events`, and optionally `usage_ledger` by time; define retention and archival policies.

## 9. API Modules

All APIs are versioned (`/api/v1`), use RFC 9457-style problem responses, cursor pagination, consistent filtering/sorting, request IDs, idempotency keys for mutations, and generated OpenAPI. Authorization is evaluated server-side for every resource and scope.

| API module | Representative endpoints |
|---|---|
| Auth & identity | `GET /auth/sso/:provider/start`, `GET /auth/sso/:provider/callback`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/sessions`, `DELETE /auth/sessions/:id` |
| Users & access | `GET /me`, `PATCH /me/preferences`, `GET/POST /users`, `PATCH /users/:id`, `GET/POST /role-bindings` |
| Organization | `GET/POST /departments`, `GET/POST /labs`, `PATCH /labs/:id/policies` |
| Inventory | `GET/POST /compute-nodes`, `GET/POST /gpus`, `GET/POST /gpu-units`, `PATCH /gpu-units/:id`, `POST /gpu-units/:id/maintenance` |
| Health | `POST /agent/v1/heartbeats`, `POST /agent/v1/metrics`, `GET /gpu-units/:id/health`, `GET /labs/:id/live-utilization` |
| Availability | `GET /availability?labId=&startAt=&endAt=&requirements=` with an explainable availability/policy response |
| Reservations | `GET/POST /reservation-requests`, `GET/PATCH /reservation-requests/:id`, `POST /:id/submit`, `POST /:id/cancel`, `GET /reservations/calendar` |
| Approvals | `GET /approval-inbox`, `POST /reservation-requests/:id/approve`, `POST /:id/reject`, `POST /:id/request-changes` |
| Recurrence & waitlist | `POST /reservation-requests/:id/recurrence`, `GET /waitlist`, `POST /waitlist/:id/accept-offer`, `POST /waitlist/:id/decline-offer` |
| Courses | `GET/POST /courses`, `GET/POST /course-sections`, `POST /course-sections/:id/roster-import`, `POST /course-sections/:id/assignments/bulk` |
| Sessions | `GET /my/live-session`, `POST /allocations/:id/check-in`, `POST /allocations/:id/check-out` |
| Notifications | `GET /notifications`, `POST /notifications/:id/read`, `PATCH /me/notification-preferences` |
| Analytics | `GET /analytics/utilization`, `/peak-hours`, `/department-usage`, `/faculty-reports`; `POST /reports/exports` |
| Audit | `GET /audit-events` with restricted scopes/filters; `POST /audit-events/export` as an asynchronous job |
| Platform | `/live`, `/ready`, `/health`, `/metrics` (internal), and protected OpenAPI docs |

The existing endpoints can remain during transition behind a compatibility adapter. New REST endpoints should not expose direct database-shaped models; use explicit request/response DTOs and contract tests.

## 10. Authentication & RBAC

### Authentication flow

1. User chooses University SSO. The browser starts an authorization-code-with-PKCE OIDC flow; SAML is supported through an IdP adapter if institutionally required.
2. Callback validates issuer, audience, nonce/state, signature, and verified email/subject. The platform maps the IdP identity to a local user and synchronizes allowed affiliation claims.
3. The API issues a short-lived JWT access token (5–15 minutes) and a rotating, opaque refresh token in an `HttpOnly`, `Secure`, `SameSite=Lax` or carefully configured cookie. Refresh session records are hashed and bound to a session family/device.
4. The browser keeps the access token in memory where practical; after reload it uses the refresh cookie to obtain a replacement. Refresh rotation detects reuse and revokes the token family.
5. Sensitive operations require recent authentication, and privileged roles require IdP MFA or a platform-enforced MFA policy.
6. Local credentials, if retained, require verified institutional email/invitation, password reset, breach-resistant password policy, rate limits by IP and identity, and account lockout/step-up controls.

### Role model

| Role | Scope and core authority |
|---|---|
| Super Admin | Institution-wide configuration, IdP/platform administration, global audit and emergency controls. Very small, MFA-required group. |
| Department Admin | Department-scoped users, policies, reports, labs, and delegated role bindings. Cannot cross departments. |
| Lab Admin | Assigned lab inventory, health, maintenance, local queue, and lab operational settings. |
| Faculty | Own course sections, class reservations, student assignments, and approval responsibility only where delegated. |
| Student | Own profile, requests, reservations, sessions, notification preferences, and history. |

Roles are not a single `users.role` enum. They are time-bound `role_bindings` with scopes. The authorization service evaluates `principal + permission + target resource + scope + state`. Examples: a student can only read their own reservation; a faculty member can approve requests assigned to their course/lab; a lab admin can change maintenance only in their lab; a department admin cannot read another department's audit events.

## 11. WebSocket Events

WebSocket is for responsive UI, never the sole source of truth. Clients refetch relevant REST resources after reconnect, sequence gaps, or authorization changes. Every event has `eventId`, `type`, `occurredAt`, `resource`, `version`, `correlationId`, and a minimal authorized payload.

| Event | Audience | Trigger |
|---|---|---|
| `notification.created` | Target user | A durable inbox notification is created. |
| `reservation.request.updated` | Request owner and permitted approvers | Submitted, changed, cancelled, or status updated. |
| `reservation.approval.required` | Scoped approval inbox | New request requires action. |
| `reservation.approved` / `rejected` / `offer.created` | Request owner | Decision or waitlist offer finalized. |
| `reservation.reminder` | Reservation owner/participants | Worker produces a scheduled reminder. |
| `waitlist.position.updated` | Affected user | Position/offer status changes. |
| `allocation.session.updated` | Allocation owner and scoped admins | Check-in, active, disconnected, completed, expired. |
| `gpu.health.updated` | Lab/department dashboards authorized for the resource | Derived GPU health/state changes. |
| `gpu.utilization.updated` | Authorized live dashboards | Throttled aggregate lab/unit utilization update. |
| `maintenance.updated` | Affected reservation holders/admins | Maintenance lifecycle or affected-reservation action. |
| `analytics.refresh.available` | Authorized dashboard subscribers | Precomputed aggregate/report completed. |

Rooms are scoped, such as `user:{id}`, `lab:{id}`, `department:{id}`, and `reservation:{id}`. Join authorization is checked for every room. Socket.IO uses the Redis adapter so any API replica can publish to users connected through any other replica.

## 12. Caching Strategy

| Data class | Store/TTL | Invalidation approach |
|---|---|---|
| Identity claims and permissions | Redis, short TTL (1–5 minutes) | Invalidate on role binding/user status change; short expiry limits privilege drift. |
| Lab inventory and capability catalog | Redis, 1–5 minutes | Publish invalidation after inventory/maintenance updates. |
| Availability search | Redis, short TTL (15–60 seconds), key includes lab/requirements/time bucket/policy version | Invalidate on reservation, maintenance, or unit-state event. Do not cache a final approval decision. |
| Dashboard summary/analytics | Redis or materialized aggregate, 1–15 minutes | Refresh/invalidate via usage, reservation, and telemetry events. |
| Live health/utilization | Redis latest-value keys, 10–60 seconds | Agent writes/ingestion updates; PostgreSQL remains historical source. |
| Rate limits / idempotency | Redis with strict expiry | Atomic Redis operations; never rely on process memory. |
| Notifications | PostgreSQL authoritative; Redis may cache unread counts briefly | Invalidate on create/read/archive. |

Use cache-aside with typed keys, TTL jitter, metrics for hit/miss/eviction, and fail-open behavior only for non-security/non-transactional reads. Authorization, final availability validation, reservation approval, and audit writes always use PostgreSQL transactions and are never trusted from cache alone.

## 13. Security Design

- Enforce TLS end-to-end, HSTS, secure headers with a restrictive CSP, and a WAF/rate-limit layer at ingress. Separate public web/API routes from internal agent/metrics/admin operations.
- Use OIDC authorization code + PKCE, strict redirect URI allow-lists, token issuer/audience validation, rotation/reuse detection for refresh tokens, MFA for privileged roles, and time-bound scoped role grants.
- Keep access tokens short-lived. Prefer in-memory access-token handling; protect cookie flows with CSRF token/origin checks appropriate to the deployed SameSite model.
- Validate all API and WebSocket inputs with schemas; use allow-listed DTO mapping; enforce body/file limits; parameterize all SQL; and maintain dependency/SBOM/vulnerability scanning.
- Apply authorization at route, use-case, and record scope. Avoid trusting a role embedded in a stale token without checking user/session status and policy version as appropriate.
- Store secrets in a managed secret manager or Kubernetes secrets with rotation, never in images, compose files, browser variables, logs, or seed data. Remove hard-coded demo credentials before any shared deployment.
- Enroll GPU node agents with per-node credentials and mutual TLS. Sign/rotate agent certificates, reject stale heartbeats, and limit agents to telemetry/control scopes for their node.
- Write immutable, structured audit events for all identity, role, inventory, scheduling, maintenance, and export actions. Include correlation IDs and immutable event metadata; alert on privileged anomalies and audit delivery failure.
- Encrypt backups and sensitive data at rest, set retention/deletion policies, restrict audit/report exports, and account for university privacy and data-governance policies.
- Perform SAST, dependency/container/IaC scans, DAST against staging, penetration tests before production, and regular access reviews for Super Admin/Department Admin/Lab Admin roles.

## 14. Scaling Strategy

### Capacity and availability targets

Design initial production capacity for 10,500–12,000 active identities, peak academic timetable bursts, and independent horizontal scaling of web, API, workers, and telemetry ingestion. Establish SLOs before launch: for example, 99.9% successful authenticated API availability during academic operating hours, p95 read latency under 300 ms, p95 scheduling decision under 1 second excluding approval time, and no duplicate active allocation caused by concurrency.

### Horizontal scaling

- Serve immutable frontend assets through CDN/Nginx with hashed cacheable assets.
- Run API containers statelessly with autoscaling on CPU, request latency, and concurrent connections. Use load-balancer health checks and graceful drain handling for WebSocket connections.
- Run WebSocket gateways horizontally with the Redis adapter; use connection limits, heartbeat tuning, per-user/lab rooms, and backpressure/throttling for telemetry events.
- Run workers independently from APIs. Separate queues by workload: notifications, reminders, waitlist, report generation, outbox dispatch, aggregates, telemetry processing. Configure idempotency, exponential retries, dead-letter queues, and concurrency limits.
- Use PostgreSQL connection pooling (PgBouncer), read replicas for report-heavy reads, partitioned time-series/audit tables, tested backups/PITR, and monitored query/index plans. Keep all scheduling writes on the primary.
- Ingest telemetry in batches with rate limits and downsampling. Retain high-resolution data briefly and roll up long-term metrics. Move analytics to a dedicated warehouse/ClickHouse only when measured workload warrants it.

### Scheduling correctness under scale

The database is the concurrency authority. For each approval/allocation operation:

1. Authenticate and authorize the scoped actor.
2. Start a short PostgreSQL transaction.
3. Lock the reservation request and required resource rows; validate current policy, maintenance state, quotas, and time interval.
4. Insert allocation(s) guarded by exclusion/capacity constraints; on serialization/exclusion conflict, return a deterministic conflict result or retry according to policy.
5. Persist approval, usage/audit records, and outbox event in the same transaction.
6. Commit; worker publishes notifications/realtime events asynchronously and idempotently.

This replaces the current read-check-write sequence and ensures that no number of API replicas can approve the same exclusive capacity twice.

### Observability and resilience

Adopt structured JSON logs with request/correlation/user identifiers (redacted), OpenTelemetry traces across API/worker/database/Redis calls, Prometheus metrics, dashboards, and alerts. Monitor queue depth/age, event failures, connection pool saturation, slow queries, cache hit rate, socket counts, telemetry freshness, GPU health, backup completion, and authorization errors. Define runbooks for database failover, Redis outage, agent outage, email provider outage, stuck queue, and maintenance relocation.

## 15. Implementation Roadmap (Phase-wise)

### Phase 0 — Architecture decisions and safeguards (1–2 weeks)

- Approve target stack, deployment environment, University IdP protocol, resource scheduling semantics (exclusive GPU vs MIG/shared capacity), policy owners, data retention, and SLOs.
- Create ADRs for modular-monolith boundaries, PostgreSQL scheduling constraints, SSO, realtime, and telemetry agent design.
- Remove shared/demo credentials from the login UI and production seed strategy; inventory current data and decide whether a migration is required.
- Add baseline linting, formatting, TypeScript plan, dependency scanning, secret scanning, CI quality gates, and staging environment definition.

**Exit criterion:** Signed architecture/security decisions and a migration plan that preserves required prototype data and API compatibility.

### Phase 1 — Platform foundation and identity (2–4 weeks)

- Establish monorepo tooling, TypeScript API skeleton, PostgreSQL migrations, Redis, local Docker Compose, configuration/secrets discipline, observability baseline, and OpenAPI contract generation.
- Implement users, organization/departments/labs, scoped role bindings, SSO/OIDC integration, rotating refresh sessions, privileged MFA policy, and local fallback only if required.
- Migrate or adapt existing React shell, login, auth bootstrapping, role-aware navigation, error boundary, and API client.

**Exit criterion:** Users can sign in through the University IdP, receive correctly scoped access, and existing student/faculty/admin journeys work against the new identity and organization model.

### Phase 2 — Inventory, scheduling, and safe approval (3–5 weeks)

- Implement labs, nodes, GPUs, schedulable GPU units, maintenance lifecycle, availability queries, reservation requests, approval policies, cancellations, and audit/outbox records.
- Enforce database-level exclusive allocation conflicts and transaction-safe shared-capacity allocation. Add idempotency for mutations and keyset pagination/filtering.
- Deliver student request/calendar/history and scoped faculty/lab-admin approval queues. Preserve the existing portal design where it remains useful.

**Exit criterion:** Concurrent approval tests prove no double allocation, all authority is scoped by lab/department/course, and the original request workflow is safely superseded.

### Phase 3 — Realtime, queues, and notifications (2–3 weeks)

- Add BullMQ workers, durable in-app notifications, email provider integration, reminder jobs, outbox dispatch, Redis Socket.IO adapter, and reconnect/recovery behavior.
- Add waitlist policies/offers and recurring reservations with occurrence materialization.

**Exit criterion:** Notifications are durable/retryable, multi-replica sockets route correctly, recurring conflicts are prevented, and waitlist progression is auditable.

### Phase 4 — Faculty, class, health, and analytics features (3–5 weeks)

- Implement course/section integration, roster import, faculty class allocations, bulk assignments, quotas/fairness policies, and live session status.
- Introduce the GPU node agent, authenticated telemetry ingestion, health derivation, maintenance impact workflow, live utilization dashboards, and core usage/peak-hours/department/faculty reports.

**Exit criterion:** Faculty can manage scoped class allocations; admins see verified resource health and live/aggregated usage rather than manually maintained status alone.

### Phase 5 — Production hardening and pilot (3–4 weeks)

- Add unit, integration, contract, E2E, concurrency, load, resilience, security, accessibility, backup/restore, and disaster-recovery tests.
- Deploy staging with production-like PostgreSQL/Redis, CI/CD image scanning/signing, migrations, canary/rollback procedures, dashboards, alerts, runbooks, and access reviews.
- Pilot one department/lab, measure SLOs and policy outcomes, migrate remaining inventory/users incrementally, and conduct a security review before institution-wide rollout.

**Exit criterion:** Pilot acceptance criteria, operational readiness review, tested rollback/restore, and documented approval for broader rollout.

### Phase 6 — Scale-out based on evidence (ongoing)

- Add read replicas, telemetry warehouse/TimescaleDB/ClickHouse, Kubernetes autoscaling, cloud-bursting integration, and advanced scheduling only when measured capacity and operational evidence justify them.
- Review quotas, fairness, retention, access roles, and security controls each academic term.

**Exit criterion:** Scaling decisions remain evidence-driven and do not compromise the transactional scheduling core.

