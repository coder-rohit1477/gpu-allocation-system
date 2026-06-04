# Conflict Detection

## Problem Statement

GPU allocation must prevent two approved requests from claiming the same GPU during overlapping time windows.

Without overlap checks, the system could:

- assign the same GPU to multiple active requests
- overcommit limited hardware
- create inconsistent resource availability
- produce incorrect scheduling behavior for faculty and students

The problem is specific to approved requests. Pending requests may coexist because they are only proposals until a faculty member approves them.

## Bug Discovery Process

The repository’s overlap behavior is validated through dedicated integration tests in `backend/tests/gpu-allocation-overlap.test.js`.

The scenario tested is straightforward:

- create two requests for the same GPU
- give them overlapping date ranges
- approve the first request
- attempt to approve the second request

This setup exposes the overlap bug class clearly because the second approval should be rejected with a conflict response instead of proceeding.

The same test file also verifies the complementary case:

- non-overlapping requests can both be approved if the GPU still has enough VRAM

That second case is important because it confirms the system is checking time overlap, not banning reuse of the same GPU outright.

## Overlap Detection Algorithm

The overlap check is implemented during approval, before the request is finalized.

The logic is:

1. Load the target request and the selected GPU.
2. Search for another approved request with the same `gpuResourceId`.
3. Exclude the current request from the search.
4. Match only requests where the date ranges overlap:
   - existing request starts before the target request ends
   - existing request ends after the target request starts
5. If a conflict exists, reject the approval with HTTP `409`.

The effective overlap condition is:

- `existing.startDate < request.endDate`
- `existing.endDate > request.startDate`

That is the standard open-interval overlap test and it correctly catches partial, full, and nested overlaps.

## Test Strategy

The overlap behavior is covered by integration tests rather than isolated unit tests.

Test cases in the repository cover:

- overlapping approvals are rejected
- non-overlapping approvals are allowed

This test style is appropriate because the bug depends on multiple moving parts:

- authentication
- request persistence
- GPU persistence
- approval handler logic
- database query behavior

An in-memory MongoDB instance is used so each test starts from a known state.

## Final Solution

The final solution is to perform overlap validation inside the approval workflow before changing request status or resource allocation.

Why this is the right place:

- it is the point where an allocation becomes real
- it has access to both the target request dates and the selected GPU
- it prevents invalid state from being persisted
- it returns a clear conflict response to the caller

The resulting behavior is:

- overlapping same-GPU approvals fail with `409 Conflict`
- non-overlapping approvals can proceed if VRAM and status checks also pass
- the rest of the approval flow remains unchanged

