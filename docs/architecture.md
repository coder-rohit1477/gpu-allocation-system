# Architecture

## System Overview

The GPU Resource Management System is a full-stack web application for managing shared GPU hardware in an academic lab setting.

The system is split into three main layers:

- A React frontend that provides role-specific portals for students, faculty, and administrators.
- A Node.js and Express backend that exposes REST endpoints, enforces authentication and authorization, and coordinates GPU allocation workflows.
- A MongoDB database accessed through Mongoose models for users, GPU resources, GPU requests, and audit logs.

The backend also hosts a Socket.IO realtime layer so request status updates can be pushed to the requesting user immediately after approval or rejection.

## Frontend Architecture

The frontend is built with React 19 and Vite.

Key structure:

- `src/main.jsx` bootstraps the app, wraps it in `BrowserRouter`, `AuthProvider`, and the toast system.
- `src/App.jsx` owns routing, lazy loading, protected routes, and role-based redirects.
- `src/context/AuthContext.jsx` stores the current access token and decoded user claims in browser storage and keeps the Axios client configured.
- `src/api/client.js` defines the shared Axios instance.
- `src/api/interceptors.js` handles token attachment and automatic access-token refresh on `401` responses.
- `src/services/*` contains thin API wrappers for auth, GPU resources, and GPU requests.
- `src/components/PortalLayout.jsx` provides the shared portal shell, sidebar, topbar, and role-specific navigation.
- `src/pages/*` contains the role-specific dashboards and login screen.

The frontend is organized around role-based flows rather than a generic CRUD surface:

- Students submit requests and track their own request history.
- Faculty review pending requests and approve or reject them.
- Administrators manage hardware, inspect system-wide requests, and review audit logs.

The app uses lazy-loaded route components to keep the initial bundle smaller. Navigation state, identity, and API token management are all centralized, which keeps page components focused on UI and domain actions.

## Backend Architecture

The backend is an Express application with a layered structure:

- `backend/app.js` configures HTTP middleware, security headers, CORS, parsing, and route mounting.
- `backend/server/index.js` starts the HTTP server, connects MongoDB, initializes Socket.IO, and handles graceful shutdown.
- `backend/server/routes/*` defines route groups by domain.
- `backend/server/controllers/*` contain request handlers for auth, admin, analytics, GPU resources, GPU requests, and audit logs.
- `backend/server/middleware/auth/middleware.js` provides JWT verification and role-based access control.
- `backend/server/modules/audit-log/service.js` is the shared audit logging service.
- `backend/server/realtime/index.js` manages realtime authentication, room assignment, and targeted emission.
- `backend/server/models/*` defines the MongoDB schemas.

This is a conventional controller-service-model style backend, but with some cross-cutting concerns centralized:

- Authentication is handled in middleware and reused across route groups.
- Realtime updates are centralized in the Socket.IO helper module.
- Audit logging is centralized in the audit-log service and reused by multiple controllers.

The codebase uses `catchAsync` to forward async errors into the global error handler instead of duplicating try/catch blocks in controllers.

## Database Architecture

MongoDB is the persistence layer, with Mongoose schemas for:

- `User`
- `GpuResource`
- `GpuRequest`
- `AuditLog`

Important model relationships:

- `GpuRequest.userId` references the student who created the request.
- `GpuRequest.facultyId` references the faculty or admin who processed the request.
- `GpuRequest.gpuResourceId` references the assigned GPU resource.
- `AuditLog.actorId` references the user who performed the action.

Notable schema behavior:

- `User.password` is hashed before save.
- `User.refreshToken` is stored hashed, not raw.
- `GpuResource.availableVRAM` is initialized from `vram` when the GPU document is created.
- `GpuRequest` validates that `endDate` is after `startDate`.
- `AuditLog` records the actor, action, and stored metadata for audit purposes.

The backend expects a reachable MongoDB instance through `MONGODB_URI`. The configuration layer fails fast if `JWT_SECRET` or `MONGODB_URI` are missing.

## Authentication Flow

Authentication is JWT-based and uses two token types:

- Access token: returned in the JSON response body and stored by the frontend.
- Refresh token: stored in an httpOnly cookie so it is not accessible from browser JavaScript.

Login flow:

1. The frontend sends credentials to `POST /api/v1/auth/login`.
2. The backend validates the password, generates an access token, and sets a refresh token cookie.
3. The frontend stores the access token and updates the Axios Authorization header.
4. Protected routes use the access token in `Authorization: Bearer ...`.

Refresh flow:

1. If an API request receives `401`, the Axios interceptor attempts `POST /api/v1/auth/refresh`.
2. The refresh endpoint reads the httpOnly cookie and issues a new access token.
3. The client retries the failed request with the new token.

Logout flow:

1. The frontend calls `POST /api/v1/auth/logout`.
2. The backend clears the refresh token record and expires the cookie.
3. The frontend clears local auth state.

Authorization is role-based and is enforced on the backend via middleware. The frontend mirrors roles for navigation and redirects, but the backend remains the source of truth.

## Approval Workflow

The approval flow centers on `GpuRequest` and `GpuResource`.

Request creation:

- A student submits a GPU request with purpose, dates, and optional GPU preference.
- The backend stores the request as `PENDING`.
- An audit record is written for request creation.

Review:

- Faculty members view pending requests through the faculty queue.
- They can approve or reject a request.

Approval:

1. The faculty member submits a GPU ID with the approval action.
2. The backend loads the request and the selected GPU.
3. The backend checks for overlap against already approved requests using the same GPU.
4. The backend checks GPU availability and available VRAM.
5. The GPU resource is updated sequentially.
6. The request status changes to `APPROVED`.
7. A realtime event is emitted to the requesting student.
8. Audit records are written for approval and allocation.

Rejection:

1. The faculty member rejects a pending request.
2. The request status changes to `REJECTED`.
3. A realtime event is emitted to the student.
4. An audit record is written for rejection.

Completion:

- When a request is completed, the backend restores GPU VRAM and marks the request `COMPLETED`.
- This is part of the resource-reclamation path for long-running allocations.

