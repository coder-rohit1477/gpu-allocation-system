import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { UserRole } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { env } from "../../../config/env.js";
import { hashPassword } from "../../auth/password.js";
import {
  app,
  buildAdminTestFixtures,
  cleanupAdminTestFixtures,
  runId,
  TEST_PASSWORD,
  type AdminTestFixtures,
  type RoleUser,
} from "../../__tests__/testFixtures.js";

// End-to-end coverage for Phase 7's faculty academic workflow layer
// (dashboard aggregation, course workspace, weekly lab schedule, and
// transactional bulk approve/reject) against the real createApp() wired to
// local Docker Postgres.

const TELEMETRY_HEADER = "x-telemetry-token";
const createdNodeIds: string[] = [];
const extraUserIds: string[] = [];

async function createExtraUser(
  role: UserRole,
  departmentId: string | null,
  label: string,
): Promise<RoleUser> {
  const email = `faculty-test-${runId}-${label}@muj.manipal.edu`;
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.create({
    data: {
      universityId: `FACTEST-${runId}-${label}`.toUpperCase(),
      fullName: `Test ${label}`,
      email,
      role,
      departmentId,
      credential: { create: { passwordHash } },
    },
  });
  extraUserIds.push(user.id);

  const agent = request.agent(app);
  const loginRes = await agent.post("/api/v1/auth/login").send({ email, password: TEST_PASSWORD });
  if (loginRes.status !== 200) {
    throw new Error(
      `Fixture login failed for ${email}: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
    );
  }
  return { id: user.id, email, role, departmentId, agent };
}

async function createGpuNode(
  fixtures: AdminTestFixtures,
  label: string,
  labId: string,
): Promise<{ id: string; hostname: string }> {
  const res = await fixtures.superAdmin.agent.post("/api/v1/gpu-nodes").send({
    labId,
    hostname: `faculty-${label}-${runId}.muj.local`,
    gpuModel: "NVIDIA A100 80GB",
    gpuCount: 4,
    totalMemoryGB: 80,
    cpuCores: 32,
    ramGB: 256,
  });
  if (res.status !== 201) {
    throw new Error(`Failed to create GPU node fixture: ${res.status} ${JSON.stringify(res.body)}`);
  }
  createdNodeIds.push(res.body.data.id as string);
  return { id: res.body.data.id as string, hostname: res.body.data.hostname as string };
}

async function sendHeartbeat(hostname: string): Promise<void> {
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
      timestamp: new Date().toISOString(),
    });
  if (res.status !== 200) {
    throw new Error(`Failed to send heartbeat fixture: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function createOnlineGpuNode(
  fixtures: AdminTestFixtures,
  label: string,
  labId: string,
): Promise<{ id: string; hostname: string }> {
  const node = await createGpuNode(fixtures, label, labId);
  await sendHeartbeat(node.hostname);
  return node;
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

async function bookPending(
  bookerAgent: RoleUser["agent"],
  gpuNodeId: string,
  purpose: string,
  courseId?: string,
): Promise<string> {
  const res = await bookerAgent.post("/api/v1/reservations").send({
    gpuNodeId,
    courseId,
    startTime: minutesFromNow(10).toISOString(),
    endTime: minutesFromNow(70).toISOString(),
    purpose,
  });
  if (res.status !== 201) {
    throw new Error(`Failed to create reservation fixture: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.id as string;
}

describe("faculty academic workflow", () => {
  let fixtures: AdminTestFixtures;
  let facultyB: RoleUser;

  beforeAll(async () => {
    fixtures = await buildAdminTestFixtures();
    facultyB = await createExtraUser("FACULTY", fixtures.departmentBId, "faculty-b");
  }, 30_000);

  afterAll(async () => {
    if (createdNodeIds.length > 0) {
      await prisma.reservation.deleteMany({ where: { gpuNodeId: { in: createdNodeIds } } });
    }
    if (extraUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
    }
    await cleanupAdminTestFixtures(fixtures);
  });

  describe("GET /faculty/dashboard", () => {
    let researchId: string;
    let courseworkId: string;
    let deptBReservationId: string;

    it("aggregates pending approvals (priority-ordered), today's sessions, active GPU usage, and upcoming reservations, scoped to the faculty's department", async () => {
      const researchNode = await createOnlineGpuNode(fixtures, "dash-research", fixtures.labAId);
      const courseworkNode = await createOnlineGpuNode(fixtures, "dash-coursework", fixtures.labAId);

      const course = await fixtures.superAdmin.agent.post("/api/v1/courses").send({
        courseCode: `FAC-DASH-${runId}`,
        courseName: "Dashboard Test Course",
        semester: "2026-1",
        facultyId: fixtures.facultyA.id,
      });
      expect(course.status).toBe(201);
      const courseId = course.body.data.id as string;

      researchId = await bookPending(fixtures.studentA.agent, researchNode.id, "Research booking");
      courseworkId = await bookPending(
        fixtures.studentA.agent,
        courseworkNode.id,
        "Coursework booking",
        courseId,
      );

      // A department-B reservation must never leak into facultyA's view —
      // and must show up in facultyB's own dashboard instead (see the next test).
      const nodeB = await createOnlineGpuNode(fixtures, "dash-deptb", fixtures.labBId);
      deptBReservationId = await bookPending(
        fixtures.studentA.agent,
        nodeB.id,
        "Cross-department booking",
      );

      // Simulate an in-progress session directly — the status worker's
      // PENDING->APPROVED->ACTIVE transition is covered by Phase 6's own
      // integration tests; this test only needs an ACTIVE row to exist.
      const activeNode = await createOnlineGpuNode(fixtures, "dash-active", fixtures.labAId);
      const activeId = await bookPending(fixtures.studentA.agent, activeNode.id, "Active session");
      await prisma.reservation.update({ where: { id: activeId }, data: { status: "ACTIVE" } });

      const res = await fixtures.facultyA.agent.get("/api/v1/faculty/dashboard");
      expect(res.status).toBe(200);

      const { pendingApprovals, activeGpuUsage } = res.body.data;

      expect(pendingApprovals.total).toBeGreaterThanOrEqual(2);
      const ids = pendingApprovals.items.map((r: { id: string }) => r.id);
      expect(ids).toContain(researchId);
      expect(ids).toContain(courseworkId);
      expect(ids).not.toContain(deptBReservationId);
      // COURSEWORK must be ordered ahead of RESEARCH in the approval queue.
      expect(ids.indexOf(courseworkId)).toBeLessThan(ids.indexOf(researchId));
      expect(
        pendingApprovals.items.find((r: { id: string }) => r.id === courseworkId).priority,
      ).toBe("COURSEWORK");
      expect(
        pendingApprovals.items.find((r: { id: string }) => r.id === researchId).priority,
      ).toBe("RESEARCH");

      expect(activeGpuUsage.activeReservations).toBeGreaterThanOrEqual(1);
      expect(activeGpuUsage.totalNodes).toBeGreaterThanOrEqual(1);

      // Approve the research booking so it becomes an upcoming reservation.
      const approve = await fixtures.facultyA.agent.patch(`/api/v1/reservations/${researchId}/approve`);
      expect(approve.status).toBe(200);
      const afterApproval = await fixtures.facultyA.agent.get("/api/v1/faculty/dashboard");
      expect(
        afterApproval.body.data.upcomingReservations.some((r: { id: string }) => r.id === researchId),
      ).toBe(true);
    });

    it("shows a faculty member only their own department's pending approvals, never another department's", async () => {
      const res = await facultyB.agent.get("/api/v1/faculty/dashboard");
      expect(res.status).toBe(200);
      const ids = res.body.data.pendingApprovals.items.map((r: { id: string }) => r.id);
      expect(ids).toContain(deptBReservationId);
      expect(ids).not.toContain(researchId);
      expect(ids).not.toContain(courseworkId);
    });
  });

  describe("GET /faculty/courses — Course Workspace", () => {
    it("lists the faculty's own courses with reservation counts by status", async () => {
      const node = await createOnlineGpuNode(fixtures, "workspace", fixtures.labAId);
      const course = await fixtures.superAdmin.agent.post("/api/v1/courses").send({
        courseCode: `FAC-WS-${runId}`,
        courseName: "Workspace Test Course",
        semester: "2026-1",
        facultyId: fixtures.facultyA.id,
      });
      expect(course.status).toBe(201);
      const courseId = course.body.data.id as string;

      await bookPending(fixtures.studentA.agent, node.id, "Workspace booking", courseId);

      const res = await fixtures.facultyA.agent.get("/api/v1/faculty/courses");
      expect(res.status).toBe(200);
      const entry = res.body.data.items.find((c: { id: string }) => c.id === courseId);
      expect(entry).toBeDefined();
      expect(entry.pendingReservations).toBeGreaterThanOrEqual(1);
    });

    it("does not show another faculty member's courses", async () => {
      const res = await facultyB.agent.get("/api/v1/faculty/courses");
      expect(res.status).toBe(200);
      expect(
        res.body.data.items.every((c: { courseCode: string }) => !c.courseCode.startsWith("FAC-WS")),
      ).toBe(true);
    });
  });

  describe("GET /faculty/labs/schedule — Weekly Lab Schedule", () => {
    it("groups this week's reservations by laboratory", async () => {
      const secondLab = await fixtures.superAdmin.agent.post("/api/v1/laboratories").send({
        departmentId: fixtures.departmentAId,
        name: `Faculty Schedule Lab ${runId}`,
        location: "Test Block",
        floor: "4",
      });
      expect(secondLab.status).toBe(201);
      const secondLabId = secondLab.body.data.id as string;

      const nodeInLabA = await createOnlineGpuNode(fixtures, "sched-a", fixtures.labAId);
      const nodeInSecondLab = await createOnlineGpuNode(fixtures, "sched-b", secondLabId);

      const idInLabA = await bookPending(fixtures.studentA.agent, nodeInLabA.id, "Schedule lab A");
      const idInSecondLab = await bookPending(
        fixtures.studentA.agent,
        nodeInSecondLab.id,
        "Schedule lab B",
      );

      const res = await fixtures.facultyA.agent.get("/api/v1/faculty/labs/schedule");
      expect(res.status).toBe(200);

      const labs = res.body.data.laboratories as {
        laboratoryId: string;
        reservations: { id: string }[];
      }[];
      const labAEntry = labs.find((l) => l.laboratoryId === fixtures.labAId);
      const secondLabEntry = labs.find((l) => l.laboratoryId === secondLabId);

      expect(labAEntry?.reservations.some((r) => r.id === idInLabA)).toBe(true);
      expect(secondLabEntry?.reservations.some((r) => r.id === idInSecondLab)).toBe(true);
    });
  });

  describe("PATCH /reservations/bulk-approve — transactional bulk approval", () => {
    it("approves every reservation in the batch when all are valid", async () => {
      const nodeA = await createOnlineGpuNode(fixtures, "bulk-ok-a", fixtures.labAId);
      const nodeB = await createOnlineGpuNode(fixtures, "bulk-ok-b", fixtures.labAId);
      const idA = await bookPending(fixtures.studentA.agent, nodeA.id, "Bulk approve A");
      const idB = await bookPending(fixtures.studentA.agent, nodeB.id, "Bulk approve B");

      const res = await fixtures.facultyA.agent
        .patch("/api/v1/reservations/bulk-approve")
        .send({ reservationIds: [idA, idB] });
      expect(res.status).toBe(200);
      expect(res.body.data.approved).toHaveLength(2);

      const reservationA = await prisma.reservation.findUniqueOrThrow({ where: { id: idA } });
      const reservationB = await prisma.reservation.findUniqueOrThrow({ where: { id: idB } });
      expect(reservationA.status).toBe("APPROVED");
      expect(reservationB.status).toBe("APPROVED");

      const auditA = await prisma.auditLog.findFirst({
        where: { resourceType: "Reservation", resourceId: idA, action: "RESERVATION_APPROVED" },
      });
      const auditB = await prisma.auditLog.findFirst({
        where: { resourceType: "Reservation", resourceId: idB, action: "RESERVATION_APPROVED" },
      });
      expect(auditA).not.toBeNull();
      expect(auditB).not.toBeNull();
    });

    it("rolls back the entire batch when one reservation fails validation", async () => {
      const nodeValid = await createOnlineGpuNode(fixtures, "bulk-rollback-valid", fixtures.labAId);
      const nodeApproved = await createOnlineGpuNode(fixtures, "bulk-rollback-approved", fixtures.labAId);
      const validId = await bookPending(fixtures.studentA.agent, nodeValid.id, "Should stay PENDING");

      // Already APPROVED — fails the "must be PENDING" check partway through the batch.
      const alreadyApprovedId = await bookPending(
        fixtures.studentA.agent,
        nodeApproved.id,
        "Already approved",
      );
      const preApprove = await fixtures.facultyA.agent.patch(
        `/api/v1/reservations/${alreadyApprovedId}/approve`,
      );
      expect(preApprove.status).toBe(200);

      const res = await fixtures.facultyA.agent
        .patch("/api/v1/reservations/bulk-approve")
        .send({ reservationIds: [validId, alreadyApprovedId] });
      expect(res.status).toBe(409);

      const reservationValid = await prisma.reservation.findUniqueOrThrow({ where: { id: validId } });
      expect(reservationValid.status).toBe("PENDING");

      const rollbackAudit = await prisma.auditLog.findFirst({
        where: { resourceType: "Reservation", resourceId: validId, action: "RESERVATION_APPROVED" },
      });
      expect(rollbackAudit).toBeNull();
    });

    it("rejects a batch containing a reservation outside the faculty's department", async () => {
      const nodeInB = await createOnlineGpuNode(fixtures, "bulk-crossdept", fixtures.labBId);
      const nodeInA = await createOnlineGpuNode(fixtures, "bulk-crossdept-a", fixtures.labAId);

      const idInA = await bookPending(fixtures.studentA.agent, nodeInA.id, "In department A");
      const idInB = await bookPending(fixtures.studentA.agent, nodeInB.id, "In department B");

      const res = await fixtures.facultyA.agent
        .patch("/api/v1/reservations/bulk-approve")
        .send({ reservationIds: [idInA, idInB] });
      expect(res.status).toBe(403);

      const reservationInA = await prisma.reservation.findUniqueOrThrow({ where: { id: idInA } });
      expect(reservationInA.status).toBe("PENDING");
    });

    it("rejects duplicate ids in the same batch", async () => {
      const node = await createOnlineGpuNode(fixtures, "bulk-dup", fixtures.labAId);
      const id = await bookPending(fixtures.studentA.agent, node.id, "Duplicate id test");

      const res = await fixtures.facultyA.agent
        .patch("/api/v1/reservations/bulk-approve")
        .send({ reservationIds: [id, id] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("PATCH /reservations/bulk-reject — transactional bulk rejection", () => {
    it("rejects every reservation in the batch with a shared reason", async () => {
      const nodeA = await createOnlineGpuNode(fixtures, "bulk-reject-ok-a", fixtures.labAId);
      const nodeB = await createOnlineGpuNode(fixtures, "bulk-reject-ok-b", fixtures.labAId);
      const idA = await bookPending(fixtures.studentA.agent, nodeA.id, "Bulk reject A");
      const idB = await bookPending(fixtures.studentA.agent, nodeB.id, "Bulk reject B");

      const res = await fixtures.facultyA.agent
        .patch("/api/v1/reservations/bulk-reject")
        .send({ reservationIds: [idA, idB], reason: "Lab reserved for a scheduled class" });
      expect(res.status).toBe(200);
      expect(res.body.data.rejected).toHaveLength(2);

      const reservationA = await prisma.reservation.findUniqueOrThrow({ where: { id: idA } });
      const reservationB = await prisma.reservation.findUniqueOrThrow({ where: { id: idB } });
      expect(reservationA.status).toBe("REJECTED");
      expect(reservationB.status).toBe("REJECTED");
    });

    it("rolls back the batch when one reservation does not exist", async () => {
      const node = await createOnlineGpuNode(fixtures, "bulk-reject-rollback", fixtures.labAId);
      const validId = await bookPending(fixtures.studentA.agent, node.id, "Should stay PENDING");
      const missingId = "00000000-0000-0000-0000-000000000000";

      const res = await fixtures.facultyA.agent
        .patch("/api/v1/reservations/bulk-reject")
        .send({ reservationIds: [validId, missingId] });
      expect(res.status).toBe(404);

      const reservationValid = await prisma.reservation.findUniqueOrThrow({ where: { id: validId } });
      expect(reservationValid.status).toBe("PENDING");
    });
  });

  describe("RBAC", () => {
    it("rejects unauthenticated access to every faculty route", async () => {
      const responses = await Promise.all([
        request(app).get("/api/v1/faculty/dashboard"),
        request(app).get("/api/v1/faculty/courses"),
        request(app).get("/api/v1/faculty/labs/schedule"),
        request(app).patch("/api/v1/reservations/bulk-approve").send({ reservationIds: [] }),
        request(app).patch("/api/v1/reservations/bulk-reject").send({ reservationIds: [] }),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(401);
      }
    });

    it("blocks STUDENT from every faculty route", async () => {
      // Sequential, not Promise.all — supertest agents don't reliably
      // multiplex several concurrent requests over one cookie jar.
      expect((await fixtures.studentA.agent.get("/api/v1/faculty/dashboard")).status).toBe(403);
      expect((await fixtures.studentA.agent.get("/api/v1/faculty/courses")).status).toBe(403);
      expect((await fixtures.studentA.agent.get("/api/v1/faculty/labs/schedule")).status).toBe(403);
      expect(
        (
          await fixtures.studentA.agent
            .patch("/api/v1/reservations/bulk-approve")
            .send({ reservationIds: ["00000000-0000-0000-0000-000000000000"] })
        ).status,
      ).toBe(403);
    });

    it("blocks admin roles from the faculty-only routes", async () => {
      const res = await fixtures.superAdmin.agent.get("/api/v1/faculty/dashboard");
      expect(res.status).toBe(403);
    });
  });
});
