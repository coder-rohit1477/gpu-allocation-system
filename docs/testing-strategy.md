# Testing Strategy

## Testing Approach

The backend uses integration-heavy testing rather than narrow unit-only coverage.

The test suite validates:

- authentication flows
- GPU request creation
- approval and rejection behavior
- overlap detection
- realtime notifications
- health/basic server behavior

The tests exercise the application through HTTP endpoints and Socket.IO clients, which gives coverage across controllers, middleware, models, and the realtime layer in one run.

The repository currently does not define a frontend test runner or frontend test scripts. The frontend is verified through build-time checks in CI rather than dedicated component tests.

## Integration Testing Setup

The backend test environment is based on:

- Jest
- Supertest
- MongoMemoryServer
- socket.io-client for realtime coverage

Each integration suite follows the same pattern:

1. Start an in-memory MongoDB instance.
2. Connect Mongoose to the temporary database.
3. Seed the minimum required users and resources.
4. Execute requests against the Express app.
5. Assert both the HTTP response and the persisted database state.
6. Drop the database and close connections after the suite finishes.

This setup keeps tests isolated and avoids dependency on a shared developer database.

## Mongo Memory Server Usage

MongoMemoryServer is used to provide a temporary MongoDB instance for each test file.

Why it is used:

- It avoids external test fixtures.
- It keeps each suite repeatable.
- It makes it safe to run tests locally and in CI without provisioning MongoDB separately.

Typical usage pattern in the repository:

- `beforeAll` creates the memory server and connects Mongoose.
- `beforeEach` clears the collections and seeds only the documents needed for the scenario.
- `afterAll` drops the database, closes Mongoose, and stops the memory server.

This approach is especially important for request lifecycle tests because they need a clean database state to validate status transitions and audit entries.

## CI Workflow

The repository includes a GitHub Actions workflow at `.github/workflows/ci.yml`.

Current CI responsibilities:

- Backend job
  - checks out the repository
  - installs backend dependencies with `npm ci`
  - runs `npm test` in `backend/`

- Frontend job
  - checks out the repository
  - installs frontend dependencies with `npm ci`
  - runs `npm run build` in `frontend/`

This means CI currently verifies:

- backend test execution
- frontend production build correctness

It does not currently include dedicated linting or frontend test execution.

## Current Test Coverage

Current backend coverage is organized into six Jest suites:

- `auth.test.js`
- `gpu-request.test.js`
- `gpu-request-realtime.test.js`
- `gpu-allocation-overlap.test.js`
- `health.test.js`
- `socket.test.js`

Observed current totals from the latest backend run:

- 6 test suites passed
- 15 tests passed
- 0 tests failed
- 0 snapshots

Behavior covered by the suite set:

- login success and failure
- logout authorization behavior
- request creation
- request approval
- request rejection
- unauthorized approval rejection
- overlapping approval rejection
- non-overlapping approval allowance
- realtime approval event emission
- realtime rejection event emission
- socket authentication and room join behavior
- basic health endpoint response

