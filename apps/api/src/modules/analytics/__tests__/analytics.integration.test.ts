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
import { runReservationStatusSweep } from "../../reservation/reservationStatusWorker.service.js";

// End-to-end coverage for Phase 9's analytics/reporting layer against the
// real createApp() wired to local Docker Postgres. Builds one small,
// deterministic dataset (a completed reservation with real compute hours,
// via the same status-sweep helper Phase 6/7's own integration tests use)
// and asserts the analytics/report endpoints surface it correctly.

const TELEMETRY_HEADER = "x-telemetry-token";
const createdNodeIds: string[] = [];

async function createOnlineGpuNode(
  fixtures: AdminTestFixtures,
  label: string,
  labId: string,
): Promise<{ id: string; hostname: string }> {
  const res = await fixtures.superAdmin.agent.post("/api/v1/gpu-nodes").send({
    labId,
    hostname: `analytics-${label}-${runId}.muj.local`,
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

  const hbRes = await request(app)
    .post("/api/v1/telemetry/heartbeat")
    .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
    .send({
      hostname: res.body.data.hostname,
      gpuUtilization: 42,
      memoryUsedGB: 20,
      temperature: 60,
      powerDraw: 250,
      activeProcesses: 2,
      timestamp: new Date().toISOString(),
    });
  if (hbRes.status !== 200) {
    throw new Error(`Failed to send heartbeat fixture: ${hbRes.status} ${JSON.stringify(hbRes.body)}`);
  }
  return { id: res.body.data.id as string, hostname: res.body.data.hostname as string };
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

describe("analytics + reports", () => {
  let fixtures: AdminTestFixtures;
  let courseId: string;
  let completedReservationId: string;

  beforeAll(async () => {
    fixtures = await buildAdminTestFixtures();

    const node = await createOnlineGpuNode(fixtures, "primary", fixtures.labAId);

    const course = await fixtures.superAdmin.agent.post("/api/v1/courses").send({
      courseCode: `ANLY-${runId}`,
      courseName: "Analytics Test Course",
      semester: "Monsoon 2026",
      facultyId: fixtures.facultyA.id,
    });
    if (course.status !== 201) {
      throw new Error(`Failed to create course fixture: ${course.status} ${JSON.stringify(course.body)}`);
    }
    courseId = course.body.data.id as string;

    const startTime = minutesFromNow(1);
    const endTime = minutesFromNow(2);
    const created = await fixtures.studentA.agent.post("/api/v1/reservations").send({
      gpuNodeId: node.id,
      courseId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      purpose: "Analytics fixture session",
    });
    if (created.status !== 201) {
      throw new Error(`Failed to create reservation fixture: ${created.status} ${JSON.stringify(created.body)}`);
    }
    completedReservationId = created.body.data.id as string;

    const approved = await fixtures.facultyA.agent.patch(
      `/api/v1/reservations/${completedReservationId}/approve`,
    );
    if (approved.status !== 200) {
      throw new Error(`Failed to approve reservation fixture: ${approved.status} ${JSON.stringify(approved.body)}`);
    }

    // Advance it straight through ACTIVE -> COMPLETED so a real
    // AllocationSession.computeHours row exists for analytics to sum.
    await runReservationStatusSweep(prisma, new Date(startTime.getTime() + 5_000));
    const sweep = await runReservationStatusSweep(prisma, new Date(endTime.getTime() + 5_000));
    if (!sweep.completed.includes(completedReservationId)) {
      throw new Error("Fixture reservation did not complete via the status sweep");
    }
  }, 30_000);

  afterAll(async () => {
    if (createdNodeIds.length > 0) {
      await prisma.reservation.deleteMany({ where: { gpuNodeId: { in: createdNodeIds } } });
    }
    await cleanupAdminTestFixtures(fixtures);
  });

  describe("GET /analytics/university", () => {
    it("reports institution-wide totals including the fixture's compute hours", async () => {
      const res = await fixtures.superAdmin.agent.get("/api/v1/analytics/university");
      expect(res.status).toBe(200);
      expect(res.body.data.totals.gpuNodes).toBeGreaterThanOrEqual(1);
      expect(res.body.data.reservationsByStatus.COMPLETED).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalComputeHours).toBeGreaterThan(0);
      expect(res.body.data.gpuNodesByConnectivity.online).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /analytics/departments", () => {
    it("includes a row for the fixture's department with correct counts", async () => {
      const res = await fixtures.superAdmin.agent.get("/api/v1/analytics/departments");
      expect(res.status).toBe(200);
      const row = res.body.data.items.find(
        (d: { departmentId: string }) => d.departmentId === fixtures.departmentAId,
      );
      expect(row).toBeDefined();
      expect(row.gpuNodes).toBeGreaterThanOrEqual(1);
      expect(row.students).toBeGreaterThanOrEqual(1);
      expect(row.totalComputeHours).toBeGreaterThan(0);
    });
  });

  describe("GET /analytics/gpu-utilization", () => {
    it("reports connectivity and utilization for nodes in the requested lab", async () => {
      const res = await fixtures.superAdmin.agent
        .get("/api/v1/analytics/gpu-utilization")
        .query({ labId: fixtures.labAId });
      expect(res.status).toBe(200);
      const node = res.body.data.items.find((n: { hostname: string }) =>
        n.hostname.startsWith(`analytics-primary-${runId}`),
      );
      expect(node).toBeDefined();
      expect(node.connectivityStatus).toBe("ONLINE");
      expect(node.currentUtilizationPercent).toBe(42);
    });
  });

  describe("GET /analytics/students", () => {
    it("counts the fixture student as active with positive compute hours", async () => {
      const res = await fixtures.superAdmin.agent.get("/api/v1/analytics/students");
      expect(res.status).toBe(200);
      expect(res.body.data.activeStudents).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalComputeHours).toBeGreaterThan(0);
      const deptRow = res.body.data.byDepartment.find(
        (d: { departmentId: string }) => d.departmentId === fixtures.departmentAId,
      );
      expect(deptRow.activeStudents).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /analytics/courses", () => {
    it("surfaces the fixture course with its reservation and compute-hour totals", async () => {
      const res = await fixtures.superAdmin.agent.get("/api/v1/analytics/courses").query({ limit: 50 });
      expect(res.status).toBe(200);
      const course = res.body.data.items.find((c: { courseId: string }) => c.courseId === courseId);
      expect(course).toBeDefined();
      expect(course.totalReservations).toBeGreaterThanOrEqual(1);
      expect(course.totalComputeHours).toBeGreaterThan(0);
    });
  });

  describe("GET /reports/daily", () => {
    it("includes today's fixture reservation in the final bucket", async () => {
      const res = await fixtures.superAdmin.agent.get("/api/v1/reports/daily").query({ days: 1 });
      expect(res.status).toBe(200);
      expect(res.body.data.granularity).toBe("daily");
      expect(res.body.data.buckets).toHaveLength(1);
      expect(res.body.data.buckets[0].reservationsCreated).toBeGreaterThanOrEqual(1);
      expect(res.body.data.buckets[0].totalComputeHours).toBeGreaterThan(0);
    });

    it("returns CSV when format=csv is requested", async () => {
      const res = await fixtures.superAdmin.agent
        .get("/api/v1/reports/daily")
        .query({ days: 1, format: "csv" });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.text.split("\n")[0]).toContain("periodStart");
      expect(res.text.split("\n")).toHaveLength(2); // header + 1 bucket row
    });
  });

  describe("GET /reports/weekly", () => {
    it("returns the requested number of weekly buckets", async () => {
      const res = await fixtures.superAdmin.agent.get("/api/v1/reports/weekly").query({ weeks: 3 });
      expect(res.status).toBe(200);
      expect(res.body.data.granularity).toBe("weekly");
      expect(res.body.data.buckets).toHaveLength(3);
    });
  });

  describe("GET /reports/monthly", () => {
    it("returns the requested number of monthly buckets", async () => {
      const res = await fixtures.superAdmin.agent.get("/api/v1/reports/monthly").query({ months: 2 });
      expect(res.status).toBe(200);
      expect(res.body.data.granularity).toBe("monthly");
      expect(res.body.data.buckets).toHaveLength(2);
    });

    it("rejects a malformed month parameter", async () => {
      const res = await fixtures.superAdmin.agent.get("/api/v1/reports/monthly").query({ month: "2026-13" });
      expect(res.status).toBe(400);
    });
  });

  describe("RBAC", () => {
    it("rejects unauthenticated access", async () => {
      const responses = await Promise.all([
        request(app).get("/api/v1/analytics/university"),
        request(app).get("/api/v1/reports/daily"),
      ]);
      for (const res of responses) expect(res.status).toBe(401);
    });

    it("blocks STUDENT and FACULTY from every analytics/report route", async () => {
      expect((await fixtures.studentA.agent.get("/api/v1/analytics/university")).status).toBe(403);
      expect((await fixtures.facultyA.agent.get("/api/v1/analytics/university")).status).toBe(403);
      expect((await fixtures.studentA.agent.get("/api/v1/reports/daily")).status).toBe(403);
      expect((await fixtures.facultyA.agent.get("/api/v1/reports/weekly")).status).toBe(403);
    });

    it("allows LAB_ADMIN to read analytics", async () => {
      const res = await fixtures.labAdminA.agent.get("/api/v1/analytics/gpu-utilization");
      expect(res.status).toBe(200);
    });
  });
});
