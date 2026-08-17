import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../../../lib/prisma.js";
import { env } from "../../../config/env.js";
import {
  app,
  buildAdminTestFixtures,
  cleanupAdminTestFixtures,
  runId,
  type AdminTestFixtures,
} from "../../__tests__/testFixtures.js";
import { runReservationStatusSweep } from "../reservationStatusWorker.service.js";

// End-to-end coverage for the Phase 6 booking/scheduling engine (Reservation
// Service, Conflict Detection Engine, Smart GPU Allocator, Faculty Approval
// Workflow, Availability Calendar, Automatic Reservation Status Worker)
// against the real createApp() wired to local Docker Postgres/Redis.

const TELEMETRY_HEADER = "x-telemetry-token";
const createdNodeIds: string[] = [];

async function createGpuNode(
  fixtures: AdminTestFixtures,
  label: string,
  labId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; hostname: string }> {
  const res = await fixtures.superAdmin.agent.post("/api/v1/gpu-nodes").send({
    labId,
    hostname: `resv-${label}-${runId}.muj.local`,
    gpuModel: "NVIDIA A100 80GB",
    gpuCount: 4,
    totalMemoryGB: 80,
    cpuCores: 32,
    ramGB: 256,
    ...overrides,
  });
  if (res.status !== 201) {
    throw new Error(`Failed to create GPU node fixture: ${res.status} ${JSON.stringify(res.body)}`);
  }
  createdNodeIds.push(res.body.data.id as string);
  return { id: res.body.data.id as string, hostname: res.body.data.hostname as string };
}

async function sendHeartbeat(hostname: string, timestamp: Date = new Date()): Promise<void> {
  const res = await request(app)
    .post("/api/v1/telemetry/heartbeat")
    .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
    .send({
      hostname,
      gpuUtilization: 15,
      memoryUsedGB: 8,
      temperature: 55,
      powerDraw: 220,
      activeProcesses: 0,
      timestamp: timestamp.toISOString(),
    });
  if (res.status !== 200) {
    throw new Error(`Failed to send heartbeat fixture: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function createOnlineGpuNode(
  fixtures: AdminTestFixtures,
  label: string,
  labId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; hostname: string }> {
  const node = await createGpuNode(fixtures, label, labId, overrides);
  await sendHeartbeat(node.hostname);
  return node;
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

describe("reservation + scheduling engine integration", () => {
  let fixtures: AdminTestFixtures;

  beforeAll(async () => {
    fixtures = await buildAdminTestFixtures();
  }, 30_000);

  afterAll(async () => {
    if (createdNodeIds.length > 0) {
      // Reservation -> GpuNode is onDelete: Restrict, so any reservations
      // this file created must go before cleanupAdminTestFixtures() deletes
      // the GPU nodes themselves (AllocationSession cascades automatically).
      await prisma.reservation.deleteMany({ where: { gpuNodeId: { in: createdNodeIds } } });
    }
    await cleanupAdminTestFixtures(fixtures);
  });

  describe("POST /reservations — direct booking + conflict detection", () => {
    it("creates a PENDING reservation for a specific ONLINE node with no conflicts", async () => {
      const node = await createOnlineGpuNode(fixtures, "book-ok", fixtures.labAId);
      const startTime = minutesFromNow(10);
      const endTime = minutesFromNow(70);

      const res = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        purpose: "Integration test booking",
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        gpuNodeId: node.id,
        userId: fixtures.studentA.id,
        status: "PENDING",
      });

      const auditEntry = await prisma.auditLog.findFirst({
        where: { resourceType: "Reservation", resourceId: res.body.data.id, action: "RESERVATION_CREATED" },
      });
      expect(auditEntry).not.toBeNull();
    });

    it("rejects booking a node that has never sent a heartbeat (not ONLINE)", async () => {
      const node = await createGpuNode(fixtures, "book-offline", fixtures.labAId);
      const res = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Should fail — node offline",
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("rejects an overlapping reservation on the same node", async () => {
      const node = await createOnlineGpuNode(fixtures, "book-overlap", fixtures.labAId);
      const firstStart = minutesFromNow(10);
      const firstEnd = minutesFromNow(70);

      const first = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: firstStart.toISOString(),
        endTime: firstEnd.toISOString(),
        purpose: "First booking",
      });
      expect(first.status).toBe(201);

      const overlapping = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: minutesFromNow(40).toISOString(),
        endTime: minutesFromNow(100).toISOString(),
        purpose: "Overlapping booking",
      });
      expect(overlapping.status).toBe(409);
      expect(overlapping.body.error.code).toBe("CONFLICT");
    });

    it("rejects a reservation overlapping a scheduled maintenance window", async () => {
      const node = await createOnlineGpuNode(fixtures, "book-maint", fixtures.labAId);
      const maintStart = minutesFromNow(20);
      const maintEnd = minutesFromNow(80);
      await prisma.maintenanceWindow.create({
        data: {
          gpuNodeId: node.id,
          title: "Scheduled maintenance",
          startTime: maintStart,
          endTime: maintEnd,
          reason: "Integration test",
          status: "SCHEDULED",
        },
      });

      const res = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: minutesFromNow(30).toISOString(),
        endTime: minutesFromNow(60).toISOString(),
        purpose: "Should hit maintenance conflict",
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("rejects a request providing both gpuNodeId and labId", async () => {
      const node = await createOnlineGpuNode(fixtures, "book-both", fixtures.labAId);
      const res = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        labId: fixtures.labAId,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Ambiguous request",
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a request missing purpose", async () => {
      const node = await createOnlineGpuNode(fixtures, "book-nopurpose", fixtures.labAId);
      const res = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a startTime in the past", async () => {
      const node = await createOnlineGpuNode(fixtures, "book-past", fixtures.labAId);
      const res = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: new Date(Date.now() - 60 * 60_000).toISOString(),
        endTime: minutesFromNow(30).toISOString(),
        purpose: "Should fail — starts in the past",
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("Smart GPU Allocator (labId booking)", () => {
    // A dedicated lab, isolated from every other node created elsewhere in
    // this file — otherwise the allocator would also consider those (all
    // default gpuCount: 4) nodes as eligible candidates for this window.
    let allocLabId: string;

    beforeAll(async () => {
      const res = await fixtures.superAdmin.agent.post("/api/v1/laboratories").send({
        departmentId: fixtures.departmentAId,
        name: `Allocator Lab ${runId}`,
        location: "Test Block",
        floor: "3",
      });
      if (res.status !== 201) {
        throw new Error(`Failed to create allocator lab fixture: ${res.status} ${JSON.stringify(res.body)}`);
      }
      allocLabId = res.body.data.id as string;
    });

    it("picks the smallest ONLINE node in the lab that still satisfies the gpuCount requirement", async () => {
      const smallNode = await createOnlineGpuNode(fixtures, "alloc-small", allocLabId, {
        gpuCount: 2,
        totalMemoryGB: 40,
      });
      const bigNode = await createOnlineGpuNode(fixtures, "alloc-big", allocLabId, {
        gpuCount: 8,
        totalMemoryGB: 160,
      });

      const res = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        labId: allocLabId,
        minGpuCount: 4,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Smart allocation test",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.gpuNodeId).toBe(bigNode.id);
      expect(res.body.data.gpuNodeId).not.toBe(smallNode.id);
    });

    it("returns 409 when no node in the lab satisfies the requirement", async () => {
      const res = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        labId: allocLabId,
        minGpuCount: 64,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Impossible requirement",
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });
  });

  describe("GET /reservations/me", () => {
    it("lists the caller's own reservations", async () => {
      const node = await createOnlineGpuNode(fixtures, "me-list", fixtures.labAId);
      const created = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Listed via /me",
      });
      expect(created.status).toBe(201);

      const res = await fixtures.studentA.agent.get("/api/v1/reservations/me");
      expect(res.status).toBe(200);
      expect(res.body.data.items.some((r: { id: string }) => r.id === created.body.data.id)).toBe(true);
    });
  });

  describe("DELETE /reservations/:id — cancellation", () => {
    it("allows the owner to cancel a PENDING reservation", async () => {
      const node = await createOnlineGpuNode(fixtures, "cancel-ok", fixtures.labAId);
      const created = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "To be cancelled",
      });
      expect(created.status).toBe(201);

      const res = await fixtures.studentA.agent.delete(`/api/v1/reservations/${created.body.data.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CANCELLED");

      const again = await fixtures.studentA.agent.delete(`/api/v1/reservations/${created.body.data.id}`);
      expect(again.status).toBe(409);
    });

    it("blocks a non-owner from cancelling someone else's reservation", async () => {
      const node = await createOnlineGpuNode(fixtures, "cancel-forbidden", fixtures.labAId);
      const created = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Owned by studentA",
      });
      expect(created.status).toBe(201);

      const res = await fixtures.facultyA.agent.delete(`/api/v1/reservations/${created.body.data.id}`);
      expect(res.status).toBe(403);
    });
  });

  describe("Faculty Approval Workflow", () => {
    it("lets a FACULTY in the node's department approve a PENDING reservation", async () => {
      const node = await createOnlineGpuNode(fixtures, "approve-ok", fixtures.labAId);
      const created = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Pending approval",
      });
      expect(created.status).toBe(201);

      const pending = await fixtures.facultyA.agent.get("/api/v1/reservations/pending");
      expect(pending.status).toBe(200);
      expect(pending.body.data.items.some((r: { id: string }) => r.id === created.body.data.id)).toBe(
        true,
      );

      const res = await fixtures.facultyA.agent.patch(
        `/api/v1/reservations/${created.body.data.id}/approve`,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("APPROVED");

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          resourceType: "Reservation",
          resourceId: created.body.data.id,
          action: "RESERVATION_APPROVED",
        },
      });
      expect(auditEntry).not.toBeNull();

      const reapprove = await fixtures.facultyA.agent.patch(
        `/api/v1/reservations/${created.body.data.id}/approve`,
      );
      expect(reapprove.status).toBe(409);
    });

    it("lets a FACULTY in the node's department reject a PENDING reservation with a reason", async () => {
      const node = await createOnlineGpuNode(fixtures, "reject-ok", fixtures.labAId);
      const created = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Pending rejection",
      });
      expect(created.status).toBe(201);

      const res = await fixtures.facultyA.agent
        .patch(`/api/v1/reservations/${created.body.data.id}/reject`)
        .send({ reason: "Node needed for a scheduled class" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("REJECTED");

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          resourceType: "Reservation",
          resourceId: created.body.data.id,
          action: "RESERVATION_REJECTED",
        },
      });
      expect(auditEntry).not.toBeNull();
    });

    it("blocks STUDENT from approving a reservation", async () => {
      const node = await createOnlineGpuNode(fixtures, "approve-rbac", fixtures.labAId);
      const created = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Should not be approvable by a student",
      });
      expect(created.status).toBe(201);

      const res = await fixtures.studentA.agent.patch(
        `/api/v1/reservations/${created.body.data.id}/approve`,
      );
      expect(res.status).toBe(403);
    });

    it("blocks a FACULTY outside the node's department from approving", async () => {
      const nodeInB = await createOnlineGpuNode(fixtures, "approve-crossdept", fixtures.labBId);
      const created = await fixtures.facultyA.agent.post("/api/v1/reservations").send({
        gpuNodeId: nodeInB.id,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Booked in another department's lab",
      });
      expect(created.status).toBe(201);

      // facultyA belongs to departmentA; nodeInB's lab belongs to departmentB.
      const res = await fixtures.facultyA.agent.patch(
        `/api/v1/reservations/${created.body.data.id}/approve`,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("Automatic Reservation Status Worker", () => {
    it("activates an APPROVED reservation once its start time arrives, then completes it once its end time arrives", async () => {
      const node = await createOnlineGpuNode(fixtures, "worker-lifecycle", fixtures.labAId);
      const startTime = minutesFromNow(1);
      const endTime = minutesFromNow(61);

      const created = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        purpose: "Worker lifecycle test",
      });
      expect(created.status).toBe(201);
      const reservationId = created.body.data.id as string;

      const approved = await fixtures.facultyA.agent.patch(
        `/api/v1/reservations/${reservationId}/approve`,
      );
      expect(approved.status).toBe(200);

      // Sweep at a synthetic "now" 5s after startTime — no real waiting.
      const activationSweep = await runReservationStatusSweep(
        prisma,
        new Date(startTime.getTime() + 5_000),
      );
      expect(activationSweep.activated).toContain(reservationId);

      const afterActivation = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
      });
      expect(afterActivation.status).toBe("ACTIVE");

      const runningSession = await prisma.allocationSession.findFirst({
        where: { reservationId, status: "RUNNING" },
      });
      expect(runningSession).not.toBeNull();

      const activatedAudit = await prisma.auditLog.findFirst({
        where: { resourceType: "Reservation", resourceId: reservationId, action: "RESERVATION_ACTIVATED" },
      });
      expect(activatedAudit).not.toBeNull();

      // Sweep again at a synthetic "now" 5s after endTime.
      const completionSweep = await runReservationStatusSweep(
        prisma,
        new Date(endTime.getTime() + 5_000),
      );
      expect(completionSweep.completed).toContain(reservationId);

      const afterCompletion = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
      });
      expect(afterCompletion.status).toBe("COMPLETED");

      const completedSession = await prisma.allocationSession.findFirst({
        where: { reservationId, status: "COMPLETED" },
      });
      expect(completedSession).not.toBeNull();
      expect(completedSession?.endedAt).not.toBeNull();
      expect(Number(completedSession?.computeHours)).toBeGreaterThan(0);

      const completedAudit = await prisma.auditLog.findFirst({
        where: { resourceType: "Reservation", resourceId: reservationId, action: "RESERVATION_COMPLETED" },
      });
      expect(completedAudit).not.toBeNull();
    });
  });

  describe("GET /gpu-nodes/availability", () => {
    it("reports a booked node as unavailable for its booked window and a free node as available", async () => {
      const busyNode = await createOnlineGpuNode(fixtures, "avail-busy", fixtures.labAId);
      const freeNode = await createOnlineGpuNode(fixtures, "avail-free", fixtures.labAId);
      const startTime = minutesFromNow(10);
      const endTime = minutesFromNow(70);

      const booked = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: busyNode.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        purpose: "Occupies the availability window",
      });
      expect(booked.status).toBe(201);

      const res = await fixtures.studentA.agent.get("/api/v1/gpu-nodes/availability").query({
        labId: fixtures.labAId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      expect(res.status).toBe(200);

      const items = res.body.data.items as { gpuNodeId: string; available: boolean }[];
      expect(items.find((n) => n.gpuNodeId === busyNode.id)?.available).toBe(false);
      expect(items.find((n) => n.gpuNodeId === freeNode.id)?.available).toBe(true);
    });

    it("rejects unauthenticated access", async () => {
      const res = await request(app).get("/api/v1/gpu-nodes/availability");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /laboratories/:id/calendar", () => {
    it("returns reservations and maintenance windows within the requested range", async () => {
      const node = await createOnlineGpuNode(fixtures, "calendar", fixtures.labAId);
      const startTime = minutesFromNow(10);
      const endTime = minutesFromNow(70);

      const created = await fixtures.studentA.agent.post("/api/v1/reservations").send({
        gpuNodeId: node.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        purpose: "Shows up on the calendar",
      });
      expect(created.status).toBe(201);

      const maintStart = minutesFromNow(200);
      const maintEnd = minutesFromNow(260);
      await prisma.maintenanceWindow.create({
        data: {
          gpuNodeId: node.id,
          title: "Calendar maintenance entry",
          startTime: maintStart,
          endTime: maintEnd,
          reason: "Integration test",
          status: "SCHEDULED",
        },
      });

      const res = await fixtures.studentA.agent
        .get(`/api/v1/laboratories/${fixtures.labAId}/calendar`)
        .query({ from: minutesFromNow(0).toISOString(), to: minutesFromNow(300).toISOString() });

      expect(res.status).toBe(200);
      expect(
        res.body.data.reservations.some((r: { id: string }) => r.id === created.body.data.id),
      ).toBe(true);
      expect(
        res.body.data.maintenanceWindows.some((m: { gpuNodeId: string }) => m.gpuNodeId === node.id),
      ).toBe(true);
    });
  });

  describe("RBAC smoke", () => {
    it("rejects unauthenticated access to core reservation routes", async () => {
      const responses = await Promise.all([
        request(app).post("/api/v1/reservations").send({}),
        request(app).get("/api/v1/reservations/me"),
        request(app).get("/api/v1/reservations/pending"),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(401);
      }
    });

    it("blocks STUDENT from viewing the pending-approvals queue", async () => {
      const res = await fixtures.studentA.agent.get("/api/v1/reservations/pending");
      expect(res.status).toBe(403);
    });

    it("blocks admin roles from creating a reservation (booking is Student/Faculty only)", async () => {
      const res = await fixtures.superAdmin.agent.post("/api/v1/reservations").send({
        labId: fixtures.labAId,
        startTime: minutesFromNow(10).toISOString(),
        endTime: minutesFromNow(70).toISOString(),
        purpose: "Admins do not book equipment",
      });
      expect(res.status).toBe(403);
    });
  });
});
