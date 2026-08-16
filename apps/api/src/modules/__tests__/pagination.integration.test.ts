import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildAdminTestFixtures,
  cleanupAdminTestFixtures,
  runId,
  type AdminTestFixtures,
} from "./testFixtures.js";

describe("admin module pagination, search, and filtering", () => {
  let fixtures: AdminTestFixtures;

  beforeAll(async () => {
    fixtures = await buildAdminTestFixtures();

    // buildAdminTestFixtures() already creates one laboratory ("Lab A") in
    // department A, so 22 more here brings the total to exactly 23 — the
    // page math below assumes that total.
    for (let i = 0; i < 22; i++) {
      await fixtures.superAdmin.agent.post("/api/v1/laboratories").send({
        departmentId: fixtures.departmentAId,
        name: `Pagination Lab ${runId} #${String(i).padStart(2, "0")}`,
        location: "Test Block",
        floor: "1",
      });
    }
  }, 30_000);

  afterAll(async () => {
    await cleanupAdminTestFixtures(fixtures);
  });

  describe("pagination", () => {
    it("returns a full first page with correct totals", async () => {
      const res = await fixtures.superAdmin.agent
        .get("/api/v1/laboratories")
        .query({ departmentId: fixtures.departmentAId, page: 1, pageSize: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(10);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.pageSize).toBe(10);
      expect(res.body.data.total).toBe(23);
      expect(res.body.data.totalPages).toBe(3);
    });

    it("returns the partial last page", async () => {
      const res = await fixtures.superAdmin.agent
        .get("/api/v1/laboratories")
        .query({ departmentId: fixtures.departmentAId, page: 3, pageSize: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(3);
      expect(res.body.data.page).toBe(3);
    });

    it("returns an empty page past the end without erroring", async () => {
      const res = await fixtures.superAdmin.agent
        .get("/api/v1/laboratories")
        .query({ departmentId: fixtures.departmentAId, page: 10, pageSize: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.total).toBe(23);
    });

    it("rejects a pageSize above the maximum with a validation error", async () => {
      const res = await fixtures.superAdmin.agent
        .get("/api/v1/laboratories")
        .query({ departmentId: fixtures.departmentAId, page: 1, pageSize: 500 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("search and filtering", () => {
    it("search narrows GPU node results by hostname/model substring", async () => {
      await fixtures.superAdmin.agent.post("/api/v1/gpu-nodes").send({
        labId: fixtures.labAId,
        hostname: `alpha-search-${runId}.muj.local`,
        gpuModel: "NVIDIA A100 80GB",
        gpuCount: 4,
        totalMemoryGB: 80,
        cpuCores: 32,
        ramGB: 256,
      });
      await fixtures.superAdmin.agent.post("/api/v1/gpu-nodes").send({
        labId: fixtures.labAId,
        hostname: `beta-search-${runId}.muj.local`,
        gpuModel: "NVIDIA A100 80GB",
        gpuCount: 4,
        totalMemoryGB: 80,
        cpuCores: 32,
        ramGB: 256,
      });
      await fixtures.superAdmin.agent.post("/api/v1/gpu-nodes").send({
        labId: fixtures.labAId,
        hostname: `gamma-unrelated-${runId}.muj.local`,
        gpuModel: "NVIDIA V100 32GB",
        gpuCount: 2,
        totalMemoryGB: 32,
        cpuCores: 16,
        ramGB: 128,
      });

      const res = await fixtures.superAdmin.agent
        .get("/api/v1/gpu-nodes")
        .query({ labId: fixtures.labAId, search: `search-${runId}` });

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      const hostnames = res.body.data.items.map((n: { hostname: string }) => n.hostname).sort();
      expect(hostnames).toEqual(
        [`alpha-search-${runId}.muj.local`, `beta-search-${runId}.muj.local`].sort(),
      );
    });

    it("filter narrows GPU node results by status", async () => {
      const created = await fixtures.superAdmin.agent.post("/api/v1/gpu-nodes").send({
        labId: fixtures.labAId,
        hostname: `filter-target-${runId}.muj.local`,
        gpuModel: "NVIDIA H100",
        gpuCount: 8,
        totalMemoryGB: 80,
        cpuCores: 64,
        ramGB: 512,
      });
      await fixtures.superAdmin.agent
        .patch(`/api/v1/gpu-nodes/${created.body.data.id}/status`)
        .send({ status: "MAINTENANCE" });

      const res = await fixtures.superAdmin.agent
        .get("/api/v1/gpu-nodes")
        .query({ labId: fixtures.labAId, status: "MAINTENANCE" });

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((n: { status: string }) => n.status === "MAINTENANCE")).toBe(
        true,
      );
      expect(res.body.data.items.some((n: { id: string }) => n.id === created.body.data.id)).toBe(
        true,
      );
    });

    it("filter narrows user results by role and department", async () => {
      const res = await fixtures.superAdmin.agent
        .get("/api/v1/users")
        .query({ departmentId: fixtures.departmentAId, role: "STUDENT" });

      expect(res.status).toBe(200);
      expect(
        res.body.data.items.every(
          (u: { role: string; departmentId: string }) =>
            u.role === "STUDENT" && u.departmentId === fixtures.departmentAId,
        ),
      ).toBe(true);
      expect(res.body.data.items.some((u: { id: string }) => u.id === fixtures.studentA.id)).toBe(
        true,
      );
    });
  });
});
