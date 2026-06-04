# Architecture Diagram Specifications

These specifications are based on the current repository structure and runtime behavior. They are written to be used as source material for Draw.io or Excalidraw, not as rendered images.

## 1. System Architecture Diagram

### Components

- `Browser / User`
- `Frontend App`
  - `src/main.jsx`
  - `src/App.jsx`
  - `AuthProvider`
  - `Axios client`
  - `Axios interceptors`
  - `PortalLayout`
  - `StudentDashboard`
  - `FacultyDashboard`
  - `AdminDashboard`
- `Backend API`
  - `backend/server/app.js`
  - `backend/server/routes/*`
  - `backend/server/controllers/*`
  - `backend/server/middleware/auth/middleware.js`
  - `backend/server/modules/audit-log/service.js`
  - `backend/server/realtime/index.js`
- `MongoDB`
  - `User`
  - `GpuResource`
  - `GpuRequest`
  - `AuditLog`
- `Socket.IO Client`
- `Socket.IO Server`
- `Docker Compose` as deployment wrapper

### Connections

- `Browser / User` -> `Frontend App`
- `Frontend App` -> `Backend API` via HTTP requests
- `Frontend App` -> `Socket.IO Server` via authenticated websocket connection
- `Backend API` -> `MongoDB`
- `Backend API` -> `Socket.IO Server` internal event emission
- `Docker Compose` -> `Backend API`
- `Docker Compose` -> `Frontend App`
- `Docker Compose` -> `MongoDB`

### Data Flow

- Users authenticate in the frontend and receive a JWT access token.
- The frontend sends Bearer tokens to backend API endpoints.
- The backend validates auth, applies role restrictions, mutates MongoDB documents, and returns JSON responses.
- Realtime events are emitted from the backend to the appropriate user room when request status changes.
- Audit entries are written to MongoDB for login, logout, request, approval, rejection, and allocation actions.

### Sequence of Actions

1. User opens the frontend in a browser.
2. Frontend loads the React app and restores auth state from local storage.
3. User logs in through `/api/v1/auth/login`.
4. Backend validates credentials and issues tokens.
5. Frontend stores the access token and configures the Axios client.
6. User navigates to a role-specific dashboard.
7. Frontend calls backend APIs for requests, GPU resources, analytics, or audit logs.
8. Backend reads or writes MongoDB and returns JSON.
9. For approvals and rejections, backend emits realtime updates to the student’s socket room.
10. Admin users can inspect audit logs and analytics from the dashboard.

---

## 2. Request Approval Workflow Diagram

### Components

- `Student`
- `Faculty`
- `Frontend StudentDashboard`
- `Frontend FacultyDashboard`
- `POST /api/v1/gpu-requests`
- `PATCH /api/v1/gpu-requests/:id/approve`
- `PATCH /api/v1/gpu-requests/:id/reject`
- `GpuRequestController`
- `GpuResourceController`
- `MongoDB GpuRequest collection`
- `MongoDB GpuResource collection`
- `AuditLogService`
- `Socket.IO emitToUser`

### Connections

- `Student` -> `Frontend StudentDashboard`
- `Frontend StudentDashboard` -> `POST /api/v1/gpu-requests`
- `Faculty` -> `Frontend FacultyDashboard`
- `Frontend FacultyDashboard` -> `PATCH /api/v1/gpu-requests/:id/approve`
- `Frontend FacultyDashboard` -> `PATCH /api/v1/gpu-requests/:id/reject`
- `GpuRequestController` -> `GpuRequest collection`
- `GpuRequestController` -> `GpuResource collection`
- `GpuRequestController` -> `AuditLogService`
- `GpuRequestController` -> `Socket.IO emitToUser`

### Data Flow

- A student submits purpose, start date, end date, required VRAM, and optional GPU preference.
- The backend stores the request with status `PENDING`.
- Faculty load pending requests from the backend.
- When approving, faculty provide a `gpuId`.
- The backend validates the request, validates the GPU, checks overlap, checks VRAM, mutates GPU allocation, and updates request status to `APPROVED`.
- When rejecting, the backend updates the request status to `REJECTED`.
- Audit records are written for request creation, approval, rejection, and GPU allocation.
- Realtime status updates are emitted to the student.

### Sequence of Actions

#### Create Request

1. Student fills the request form.
2. Frontend sends `POST /api/v1/gpu-requests`.
3. Backend validates input.
4. Backend creates a `GpuRequest` document with status `PENDING`.
5. Backend writes `REQUEST_CREATED` audit log.
6. Backend responds with the new request.

#### Approve Request

1. Faculty selects a pending request.
2. Frontend sends `PATCH /api/v1/gpu-requests/:id/approve` with `gpuId`.
3. Backend loads the request and GPU.
4. Backend checks for an overlapping approved request using the same GPU.
5. Backend checks GPU availability and VRAM.
6. Backend updates GPU `availableVRAM` and status.
7. Backend updates request status to `APPROVED` and stores `facultyId` and `gpuResourceId`.
8. Backend emits `request:approved` to the student room.
9. Backend writes `REQUEST_APPROVED` and `GPU_ALLOCATED` audit logs.
10. Backend returns the updated request.

#### Reject Request

1. Faculty selects a pending request.
2. Frontend sends `PATCH /api/v1/gpu-requests/:id/reject`.
3. Backend loads the request.
4. Backend updates request status to `REJECTED` and stores `facultyId`.
5. Backend emits `request:rejected` to the student room.
6. Backend writes `REQUEST_REJECTED` audit log.
7. Backend returns the updated request.

---

## 3. Realtime Notification Flow Diagram

### Components

- `Authenticated Frontend Client`
- `Socket.IO Client`
- `Socket.IO Server`
- `Socket Auth Middleware`
- `JWT Verification`
- `User lookup in MongoDB`
- `Room user:<userId>`
- `emitToUser(userId, eventName, payload)`
- `GpuRequest approval/rejection handlers`

### Connections

- `Socket.IO Client` -> `Socket.IO Server`
- `Socket.IO Server` -> `Socket Auth Middleware`
- `Socket Auth Middleware` -> `JWT Verification`
- `Socket Auth Middleware` -> `MongoDB User collection`
- `Socket.IO Server` -> `Room user:<userId>`
- `GpuRequest approval/rejection handlers` -> `emitToUser`
- `emitToUser` -> `Room user:<userId>`

### Data Flow

- The client sends the JWT in socket handshake auth or Authorization header.
- The server verifies the token and loads the current user.
- The server joins the socket to `user:<userId>`.
- When a request is approved or rejected, the backend emits an event only to the request owner’s room.
- Payload includes request ID, status, GPU ID, and timestamp.

### Sequence of Actions

1. User logs in through the frontend and receives an access token.
2. Frontend initializes a Socket.IO client with the JWT.
3. Socket.IO server authenticates the socket handshake.
4. Server resolves the current user from MongoDB.
5. Server joins the socket to `user:<userId>`.
6. Faculty approves or rejects a request.
7. Backend persists the change to MongoDB.
8. Backend emits `request:approved` or `request:rejected`.
9. Student client receives the event and updates the UI.
10. If the socket reconnects, the client reauthenticates and rejoins the same room.

---

## 4. Conflict Detection Flow Diagram

### Components

- `Faculty approval action`
- `Approve request controller`
- `GpuRequest.findById`
- `GpuResource.findById`
- `Overlap query`
- `VRAM validation`
- `MongoDB GpuRequest collection`
- `MongoDB GpuResource collection`
- `HTTP 409 response`
- `AuditLogService`

### Connections

- `Faculty approval action` -> `Approve request controller`
- `Approve request controller` -> `GpuRequest.findById`
- `Approve request controller` -> `GpuResource.findById`
- `Approve request controller` -> `Overlap query`
- `Approve request controller` -> `VRAM validation`
- `Overlap query` -> `MongoDB GpuRequest collection`
- `VRAM validation` -> `MongoDB GpuResource collection`
- `Approve request controller` -> `HTTP 409 response`
- `Approve request controller` -> `AuditLogService`

### Data Flow

- The controller receives the request ID and GPU ID.
- The controller loads the target request and GPU.
- The controller searches for an approved request with the same GPU and an overlapping date window.
- If overlap exists, the controller returns conflict before mutating state.
- If no overlap exists, the controller checks GPU status and available VRAM.
- If all checks pass, the controller updates allocation and writes audit logs.

### Sequence of Actions

1. Faculty submits approval with `gpuId`.
2. Backend validates that `gpuId` is present and is a valid ObjectId.
3. Backend loads the target request and selected GPU.
4. Backend confirms the request is still `PENDING`.
5. Backend queries for a conflicting approved request:
   - same `gpuResourceId`
   - different request ID
   - overlapping `startDate` and `endDate`
6. If a conflict is found, backend returns `409 Conflict`.
7. If no conflict is found, backend checks GPU status.
8. Backend checks GPU `availableVRAM` against request `requiredVRAM`.
9. If valid, backend updates GPU allocation and request status.
10. Backend emits realtime approval event and writes audit logs.

---

## Draw.io / Excalidraw Notes

- Use the component lists as node labels.
- Use the connection lists as arrows.
- Use the sequence sections as top-to-bottom flow order.
- Keep MongoDB collections as separate datastore nodes if you want a database-centric diagram.
- Keep the realtime flow separate from the approval workflow so the notification path remains clear.

