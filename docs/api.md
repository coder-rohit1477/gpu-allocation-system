# API Reference

Base URL: `http://localhost:4000` in local dev (`apps/api`), or same-origin
under `/api/...` when accessed through the production nginx reverse proxy
(see [`docs/deployment.md`](./deployment.md)).

All endpoints below except `POST /api/v1/auth/*`, `GET /health`, `GET /live`,
`GET /ready`, and `POST /api/v1/telemetry/*` require a valid session — see
**Authentication** below. Every response follows one envelope:

```jsonc
// success
{ "ok": true, "data": /* ... */ }
// failure
{ "ok": false, "error": { "code": "SOME_ERROR_CODE", "message": "human-readable" } }
```

Common error codes: `VALIDATION_ERROR` (400), `BAD_REQUEST` (400),
`UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409),
`INTERNAL_ERROR` (500).

This document is a hand-maintained reference generated from the actual route
and DTO files, not from a spec-first tool — for the exact validation rules
of any endpoint (field limits, formats, defaults), the source of truth is
that module's `*.dto.ts` file (Zod schemas), e.g.
`apps/api/src/modules/reservation/reservation.dto.ts`.

## Authentication

Session state lives in **httpOnly cookies** set by the login/refresh
endpoints — `access_token` (short-lived JWT, 15 min default) and
`refresh_token` (opaque, rotating, scoped to `/api/v1/auth`, 7 days
default). There is no `Authorization: Bearer` header — every authenticated
request must be sent with `credentials: "include"` (browser) or an
equivalent cookie jar (server-to-server/tests).

Roles (`UserRole`): `SUPER_ADMIN`, `DEPARTMENT_ADMIN`, `LAB_ADMIN`,
`FACULTY`, `STUDENT`. Most list/read endpoints are open to any authenticated
role; writes are scoped by role and, for department-scoped resources, by
`requireDepartmentScope` (an actor may only act within their own
department unless their role bypasses scoping — `SUPER_ADMIN` always does).

| Method & Path | Auth | Description |
|---|---|---|
| `POST /api/v1/auth/login` | — | `{ email, password }` → sets cookies, returns `{ user }` |
| `POST /api/v1/auth/refresh` | refresh cookie | Rotates the refresh token, issues a new access token |
| `POST /api/v1/auth/logout` | — | Revokes the presented refresh session, clears cookies |
| `POST /api/v1/auth/logout-all` | session | Revokes every active session for the caller |
| `GET /api/v1/auth/me` | session | Current user's profile (re-fetched from DB, not just the JWT) |

## Health & monitoring

Unauthenticated, outside `/api/v1` — see [`apps/api/src/routes/health.ts`](../apps/api/src/routes/health.ts).

| Method & Path | Description |
|---|---|
| `GET /health` | Liveness-ish service info: name, version, uptime |
| `GET /live` | Pure liveness — no dependency checks, for restart-on-failure probes |
| `GET /ready` | Readiness — checks Postgres and Redis, `503` if either is unreachable |

## Organizations — `/api/v1/organizations`

| Method & Path | Roles | Description |
|---|---|---|
| `GET /` | any | Paginated list |
| `GET /:id` | any | Single organization |
| `POST /` | `SUPER_ADMIN` | Create |
| `PATCH /:id` | `SUPER_ADMIN` | Update |

## Departments — `/api/v1/departments`

| Method & Path | Roles | Description |
|---|---|---|
| `GET /` | any | Paginated list, `?search=&organizationId=` |
| `GET /:id` | any | Single department |
| `POST /` | `SUPER_ADMIN` | Create |
| `PATCH /:id` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | Update name/code |
| `DELETE /:id` | `SUPER_ADMIN` | Delete (blocked while it still has laboratories) |

\* department-scoped — a `DEPARTMENT_ADMIN` may only touch their own department.

## Laboratories — `/api/v1/laboratories`

| Method & Path | Roles | Description |
|---|---|---|
| `GET /` | any | Paginated list, `?search=&departmentId=&status=` |
| `GET /:id` | any | Single laboratory |
| `GET /:id/calendar` | any | Reservations + maintenance windows for a lab in a time range, `?from=&to=` |
| `POST /` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | Create |
| `PATCH /:id` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`*, `LAB_ADMIN`* | Update |
| `DELETE /:id` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | Delete |

## Courses — `/api/v1/courses`

| Method & Path | Roles | Description |
|---|---|---|
| `GET /` | any | Paginated list, `?search=&facultyId=&semester=` |
| `GET /:id` | any | Single course |
| `POST /` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | Create (scoped by the target faculty's department) |
| `PATCH /:id` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | Update (course code is immutable) |
| `DELETE /:id` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | Delete |

## GPU nodes — `/api/v1/gpu-nodes`

| Method & Path | Roles | Description |
|---|---|---|
| `GET /` | any | Paginated inventory list, `?search=&labId=&status=` |
| `GET /:id` | any | Single node |
| `GET /live` | any | Nodes with recent heartbeats and their live connectivity status |
| `GET /:id/health` | any | One node's derived `ONLINE`/`DEGRADED`/`OFFLINE` status + latest metrics |
| `GET /availability` | any | Bookable-right-now view, `?labId=&startTime=&endTime=&minGpuCount=&minMemoryGB=` |
| `POST /` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`*, `LAB_ADMIN`* | Create |
| `PATCH /:id` | same as above, scoped | Update specs (hostname, GPU count, ...) |
| `PATCH /:id/status` | same as above, scoped | Change `AVAILABLE`/`BUSY`/`MAINTENANCE`/`OFFLINE` |
| `PATCH /:id/heartbeat` | same as above, scoped | Manual heartbeat override |
| `DELETE /:id` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | Delete |

## Users — `/api/v1/users`

PII-sensitive — reads are admin-tier only, unlike the org/dept/lab/course
list endpoints above.

| Method & Path | Roles | Description |
|---|---|---|
| `GET /` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`, `LAB_ADMIN` | Paginated list |
| `GET /:id` | same | Single user |
| `POST /` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | Create |
| `PATCH /:id` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | Update profile |
| `PATCH /:id/status` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | `ACTIVE`/`INACTIVE`/`SUSPENDED` |
| `PATCH /:id/department` | `SUPER_ADMIN` | Reassign department (crosses scoping, so super-admin only) |
| `PATCH /:id/role` | `SUPER_ADMIN`, `DEPARTMENT_ADMIN`* | Change role (a department admin can hand out `LAB_ADMIN`/`FACULTY`/`STUDENT`, never a peer or super admin) |

## Telemetry ingestion — `/api/v1/telemetry`

Machine-to-machine — guarded by a shared-secret header (`X-Telemetry-Token`,
value from `TELEMETRY_INGEST_TOKEN`), not a user session.

| Method & Path | Description |
|---|---|
| `POST /heartbeat` | `{ hostname, gpuUtilization, memoryUsedGB, temperature, powerDraw, activeProcesses, timestamp }` — upserts the node's live snapshot, appends history, publishes a Redis event |
| `POST /metrics` | Same payload/behavior as `/heartbeat` — either endpoint counts as proof of liveness |

## Reservations (booking engine) — `/api/v1/reservations`

| Method & Path | Roles | Description |
|---|---|---|
| `POST /` | `STUDENT`, `FACULTY` | Book a specific `gpuNodeId`, or `labId` for the Smart Allocator to pick the best-fit ONLINE node |
| `GET /me` | `STUDENT`, `FACULTY` | Caller's own reservations, `?status=&page=&pageSize=` |
| `GET /pending` | `FACULTY` | Pending-approval queue for the faculty member's own department |
| `PATCH /:id/approve` | `FACULTY`* | Approve a `PENDING` reservation |
| `PATCH /:id/reject` | `FACULTY`* | Reject, optional `{ reason }` |
| `PATCH /bulk-approve` | `FACULTY` | `{ reservationIds: string[] }` — transactional; one invalid id rolls back the whole batch |
| `PATCH /bulk-reject` | `FACULTY` | `{ reservationIds: string[], reason? }` — same transactional guarantee |
| `DELETE /:id` | owner only | Cancel (only from `PENDING`/`APPROVED`) |
| `GET /gpu-nodes/availability` | any | See GPU nodes above — lives in this module, mounted on the gpu-nodes prefix |
| `GET /laboratories/:id/calendar` | any | See Laboratories above — same reason |

Reservation status machine: `PENDING → APPROVED → ACTIVE → COMPLETED`, or
`PENDING → REJECTED`, or `PENDING/APPROVED → CANCELLED`. `ACTIVE`/`COMPLETED`
transitions are automatic (wall-clock-driven, see the status-sweep interval
in `apps/api/src/index.ts`), not client-triggered.

## Faculty workflow — `/api/v1/faculty`

All routes below require role `FACULTY` and are scoped to that faculty
member's own department.

| Method & Path | Description |
|---|---|
| `GET /dashboard` | Pending approvals (priority-ordered: coursework before research), today's sessions, active GPU usage, upcoming reservations |
| `GET /courses` | The faculty member's own courses with reservation counts by status |
| `GET /labs/schedule` | This week's reservations across the department's labs, grouped by lab, `?weekOf=` |

## Analytics & reports — `/api/v1/analytics`, `/api/v1/reports`

All routes below require an admin-tier role: `SUPER_ADMIN`,
`DEPARTMENT_ADMIN`, or `LAB_ADMIN`.

| Method & Path | Description |
|---|---|
| `GET /api/v1/analytics/university` | Institution-wide totals, GPU connectivity breakdown, reservation status breakdown, total compute hours |
| `GET /api/v1/analytics/departments` | Per-department comparison: labs, nodes, students, faculty, reservations, compute hours, utilization % |
| `GET /api/v1/analytics/gpu-utilization` | Per-node connectivity + current/7-day-average utilization, `?departmentId=&labId=` |
| `GET /api/v1/analytics/students` | Total/active student counts and compute hours, broken down by department |
| `GET /api/v1/analytics/courses` | Courses ranked by reservation count, `?limit=` (default 10, max 50) |
| `GET /api/v1/reports/daily` | Daily reservation/compute-hour rollups, `?date=&days=` (1-90, default 14) |
| `GET /api/v1/reports/weekly` | Same, weekly buckets, `?weekOf=&weeks=` (1-52, default 8) |
| `GET /api/v1/reports/monthly` | Same, calendar-month buckets, `?month=YYYY-MM&months=` (1-24, default 6) |

Every report endpoint also accepts `?format=csv` to return
`text/csv` (with a `Content-Disposition: attachment` header) instead of the
usual JSON envelope — the same data, one row per bucket.

## Example: logging in and creating a reservation

```bash
# 1. Log in — cookies are written to cookies.txt for subsequent requests.
curl -c cookies.txt -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"muj-stu-0001@muj.manipal.edu","password":"ChangeMe123!"}'

# 2. Book a specific GPU node.
curl -b cookies.txt -X POST http://localhost:4000/api/v1/reservations \
  -H 'Content-Type: application/json' \
  -d '{
    "gpuNodeId": "<uuid>",
    "startTime": "2026-09-01T10:00:00.000Z",
    "endTime": "2026-09-01T11:00:00.000Z",
    "purpose": "Training run for final project"
  }'
```
