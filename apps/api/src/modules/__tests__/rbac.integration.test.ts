import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  app,
  buildAdminTestFixtures,
  cleanupAdminTestFixtures,
  runId,
  type AdminTestFixtures,
} from "./testFixtures.js";
import request from "supertest";

describe("admin module RBAC", () => {
  let fixtures: AdminTestFixtures;

  beforeAll(async () => {
    fixtures = await buildAdminTestFixtures();
  });

  afterAll(async () => {
    await cleanupAdminTestFixtures(fixtures);
  });

  describe("unauthenticated access", () => {
    it("rejects every admin route without a session cookie", async () => {
      const anonymous = request(app);
      const responses = await Promise.all([
        anonymous.get("/api/v1/departments"),
        anonymous.get("/api/v1/laboratories"),
        anonymous.get("/api/v1/gpu-nodes"),
        anonymous.get("/api/v1/users"),
        anonymous.get("/api/v1/courses"),
        anonymous.post("/api/v1/departments").send({}),
      ]);
      for (const res of responses) {
        expect(res.status).toBe(401);
      }
    });
  });

  describe("department module", () => {
    it("blocks STUDENT from creating a department", async () => {
      const res = await fixtures.studentA.agent.post("/api/v1/departments").send({
        organizationId: fixtures.organizationId,
        name: `Rejected Dept ${runId}`,
        code: `REJ-${runId}`,
      });
      expect(res.status).toBe(403);
    });

    it("blocks DEPARTMENT_ADMIN from creating a new department (SUPER_ADMIN only)", async () => {
      const res = await fixtures.deptAdminA.agent.post("/api/v1/departments").send({
        organizationId: fixtures.organizationId,
        name: `Rejected Dept 2 ${runId}`,
        code: `REJ2-${runId}`,
      });
      expect(res.status).toBe(403);
    });

    it("allows SUPER_ADMIN to create a department", async () => {
      const res = await fixtures.superAdmin.agent.post("/api/v1/departments").send({
        organizationId: fixtures.organizationId,
        name: `Allowed Dept ${runId}`,
        code: `OK-${runId}`,
      });
      expect(res.status).toBe(201);
    });

    it("allows a DEPARTMENT_ADMIN to rename their own department", async () => {
      const res = await fixtures.deptAdminA.agent
        .patch(`/api/v1/departments/${fixtures.departmentAId}`)
        .send({ name: `Dept A Renamed ${runId}` });
      expect(res.status).toBe(200);
    });

    it("blocks a DEPARTMENT_ADMIN from renaming a different department", async () => {
      const res = await fixtures.deptAdminA.agent
        .patch(`/api/v1/departments/${fixtures.departmentBId}`)
        .send({ name: `Hijacked ${runId}` });
      expect(res.status).toBe(403);
    });
  });

  describe("laboratory module (department-scoped)", () => {
    it("allows LAB_ADMIN to update a laboratory in their own department", async () => {
      const res = await fixtures.labAdminA.agent
        .patch(`/api/v1/laboratories/${fixtures.labAId}`)
        .send({ floor: "9" });
      expect(res.status).toBe(200);
    });

    it("blocks LAB_ADMIN from updating a laboratory in a different department", async () => {
      const res = await fixtures.labAdminA.agent
        .patch(`/api/v1/laboratories/${fixtures.labBId}`)
        .send({ floor: "9" });
      expect(res.status).toBe(403);
    });

    it("blocks FACULTY from creating a laboratory", async () => {
      const res = await fixtures.facultyA.agent.post("/api/v1/laboratories").send({
        departmentId: fixtures.departmentAId,
        name: `Rejected Lab ${runId}`,
        location: "X",
        floor: "1",
      });
      expect(res.status).toBe(403);
    });
  });

  describe("GPU node module (Lab Admin authority)", () => {
    it("allows LAB_ADMIN to create a GPU node in their own department's lab", async () => {
      const res = await fixtures.labAdminA.agent.post("/api/v1/gpu-nodes").send({
        labId: fixtures.labAId,
        hostname: `labadmin-node-${runId}.muj.local`,
        gpuModel: "NVIDIA A100 80GB",
        gpuCount: 4,
        totalMemoryGB: 80,
        cpuCores: 32,
        ramGB: 256,
      });
      expect(res.status).toBe(201);
    });

    it("blocks LAB_ADMIN from creating a GPU node in another department's lab", async () => {
      const res = await fixtures.labAdminA.agent.post("/api/v1/gpu-nodes").send({
        labId: fixtures.labBId,
        hostname: `cross-dept-node-${runId}.muj.local`,
        gpuModel: "NVIDIA A100 80GB",
        gpuCount: 4,
        totalMemoryGB: 80,
        cpuCores: 32,
        ramGB: 256,
      });
      expect(res.status).toBe(403);
    });

    it("blocks STUDENT from changing a GPU node's status", async () => {
      const created = await fixtures.labAdminA.agent.post("/api/v1/gpu-nodes").send({
        labId: fixtures.labAId,
        hostname: `status-target-${runId}.muj.local`,
        gpuModel: "NVIDIA H100",
        gpuCount: 8,
        totalMemoryGB: 80,
        cpuCores: 64,
        ramGB: 512,
      });
      expect(created.status).toBe(201);

      const res = await fixtures.studentA.agent
        .patch(`/api/v1/gpu-nodes/${created.body.data.id}/status`)
        .send({ status: "MAINTENANCE" });
      expect(res.status).toBe(403);
    });

    it("allows LAB_ADMIN to update the heartbeat timestamp manually", async () => {
      const created = await fixtures.labAdminA.agent.post("/api/v1/gpu-nodes").send({
        labId: fixtures.labAId,
        hostname: `heartbeat-target-${runId}.muj.local`,
        gpuModel: "NVIDIA H100",
        gpuCount: 8,
        totalMemoryGB: 80,
        cpuCores: 64,
        ramGB: 512,
      });
      expect(created.status).toBe(201);
      expect(created.body.data.lastHeartbeat).toBeNull();

      const res = await fixtures.labAdminA.agent.patch(
        `/api/v1/gpu-nodes/${created.body.data.id}/heartbeat`,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.lastHeartbeat).not.toBeNull();
    });
  });

  describe("user module (role assignment authority)", () => {
    it("blocks STUDENT and FACULTY from listing users (PII-sensitive)", async () => {
      const [studentRes, facultyRes] = await Promise.all([
        fixtures.studentA.agent.get("/api/v1/users"),
        fixtures.facultyA.agent.get("/api/v1/users"),
      ]);
      expect(studentRes.status).toBe(403);
      expect(facultyRes.status).toBe(403);
    });

    it("allows a DEPARTMENT_ADMIN to promote a student in their department to LAB_ADMIN", async () => {
      const res = await fixtures.deptAdminA.agent
        .patch(`/api/v1/users/${fixtures.studentA.id}/role`)
        .send({ role: "LAB_ADMIN" });
      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe("LAB_ADMIN");

      // Restore for later tests/idempotency.
      await fixtures.superAdmin.agent
        .patch(`/api/v1/users/${fixtures.studentA.id}/role`)
        .send({ role: "STUDENT" });
    });

    it("blocks a DEPARTMENT_ADMIN from assigning SUPER_ADMIN (authorized roles only)", async () => {
      const res = await fixtures.deptAdminA.agent
        .patch(`/api/v1/users/${fixtures.studentA.id}/role`)
        .send({ role: "SUPER_ADMIN" });
      expect(res.status).toBe(403);
    });

    it("blocks a DEPARTMENT_ADMIN from assigning a role to a user outside their department", async () => {
      const res = await fixtures.deptAdminA.agent
        .patch(`/api/v1/users/${fixtures.deptAdminB.id}/role`)
        .send({ role: "FACULTY" });
      expect(res.status).toBe(403);
    });

    it("blocks a DEPARTMENT_ADMIN from reassigning a user's department (SUPER_ADMIN only)", async () => {
      const res = await fixtures.deptAdminA.agent
        .patch(`/api/v1/users/${fixtures.studentA.id}/department`)
        .send({ departmentId: fixtures.departmentBId });
      expect(res.status).toBe(403);
    });

    it("allows SUPER_ADMIN to reassign a user's department", async () => {
      const res = await fixtures.superAdmin.agent
        .patch(`/api/v1/users/${fixtures.facultyA.id}/department`)
        .send({ departmentId: fixtures.departmentBId });
      expect(res.status).toBe(200);
      expect(res.body.data.departmentId).toBe(fixtures.departmentBId);

      // Restore.
      await fixtures.superAdmin.agent
        .patch(`/api/v1/users/${fixtures.facultyA.id}/department`)
        .send({ departmentId: fixtures.departmentAId });
    });

    it("allows a DEPARTMENT_ADMIN to suspend and reactivate a user in their department", async () => {
      const suspend = await fixtures.deptAdminA.agent
        .patch(`/api/v1/users/${fixtures.studentA.id}/status`)
        .send({ status: "SUSPENDED" });
      expect(suspend.status).toBe(200);
      expect(suspend.body.data.status).toBe("SUSPENDED");

      const reactivate = await fixtures.deptAdminA.agent
        .patch(`/api/v1/users/${fixtures.studentA.id}/status`)
        .send({ status: "ACTIVE" });
      expect(reactivate.status).toBe(200);
      expect(reactivate.body.data.status).toBe("ACTIVE");
    });
  });
});
