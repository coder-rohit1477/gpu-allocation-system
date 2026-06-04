# Realtime Notifications

## Socket.IO Architecture

The backend exposes a Socket.IO server from `backend/server/realtime/index.js`.

The realtime layer is initialized from `backend/server/index.js` after the HTTP server starts. The implementation is intentionally lightweight:

- one Socket.IO server instance
- one auth middleware for socket handshakes
- one room namespace strategy
- one helper for emitting to a specific user

The realtime layer does not store business state. It only authenticates sockets, assigns rooms, and routes events.

## JWT Authentication

Socket connections are authenticated with the same JWT secret used by the HTTP API.

The server accepts the token from either:

- `socket.handshake.auth.token`
- `Authorization: Bearer ...` in handshake headers

Authentication steps:

1. Read the token from the handshake.
2. Verify the JWT signature.
3. Load the current user from MongoDB.
4. Reject the socket if the token is missing, invalid, or the user no longer exists.
5. Store the authenticated user on `socket.data.user`.

This keeps socket authorization aligned with HTTP authorization and avoids duplicating auth logic in the client.

## Room Strategy

Each authenticated user joins a room named:

- `user:<userId>`

This is a direct user-targeting strategy. It is simple and works well because request notifications are always sent back to the user who owns the request.

Benefits:

- target a single user without broadcasting
- keep event routing deterministic
- avoid leaking request updates to other users

The helper `emitToUser(userId, eventName, payload)` emits directly to that room.

## Event Flow

The core event flow is request-status driven.

Approval path:

1. Faculty approves a request.
2. The request and GPU resource are updated in MongoDB.
3. The backend emits `request:approved` to the student’s room.
4. The payload contains `requestId`, `status`, `gpuId`, and `timestamp`.

Rejection path:

1. Faculty rejects a request.
2. The request status is updated in MongoDB.
3. The backend emits `request:rejected` to the student’s room.
4. The payload contains `requestId`, `status`, `gpuId: null`, and `timestamp`.

The tests confirm that emission happens after persistence, which is the correct order for a reliable user notification flow.

## Reconnection Behavior

The server-side realtime design is stateless with respect to reconnects.

What happens on reconnect:

- the client opens a new socket connection
- the handshake is authenticated again
- the socket rejoins the same `user:<id>` room

There is no special server-side session recovery logic. That is acceptable here because the room membership is derived entirely from the authenticated JWT and the user record in MongoDB.

Operational implications:

- if the client reconnects, it should receive future events normally after re-authentication
- missed events during downtime are not replayed by the server
- this is a notification channel, not a durable event log

The test suite covers the successful handshake path and validates that authenticated users receive the expected request status events.

