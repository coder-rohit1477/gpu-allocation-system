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

// End-to-end coverage for the Phase 5 telemetry ingestion + gpu-node health
// read endpoints, against the real createApp() wired to local Docker
// Postgres/Redis (not mocks) — complements the pure-function unit tests in
// health.service.test.ts and telemetry.service.test.ts.

const TELEMETRY_HEADER = "x-telemetry-token";

async function createGpuNode(fixtures: AdminTestFixtures, label: string): Promise<{
  id: string;
  hostname: string;
}> {
  const res = await fixtures.superAdmin.agent.post("/api/v1/gpu-nodes").send({
    labId: fixtures.labAId,
    hostname: `telemetry-${label}-${runId}.muj.local`,
    gpuModel: "NVIDIA A100 80GB",
    gpuCount: 4,
    totalMemoryGB: 80,
    cpuCores: 32,
    ramGB: 256,
  });
  if (res.status !== 201) {
    throw new Error(`Failed to create GPU node fixture: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.data.id as string, hostname: res.body.data.hostname as string };
}

function payloadFor(hostname: string, overrides: Record<string, unknown> = {}) {
  return {
    hostname,
    gpuUtilization: 42,
    memoryUsedGB: 20,
    temperature: 60,
    powerDraw: 250,
    activeProcesses: 3,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("telemetry + gpu-node health integration", () => {
  let fixtures: AdminTestFixtures;

  beforeAll(async () => {
    fixtures = await buildAdminTestFixtures();
  }, 30_000);

  afterAll(async () => {
    await cleanupAdminTestFixtures(fixtures);
  });

  describe("shared-secret authentication", () => {
    it("rejects a heartbeat with no telemetry token", async () => {
      const node = await createGpuNode(fixtures, "auth-missing");
      const res = await request(app).post("/api/v1/telemetry/heartbeat").send(payloadFor(node.hostname));
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects a heartbeat with an incorrect telemetry token", async () => {
      const node = await createGpuNode(fixtures, "auth-wrong");
      const res = await request(app)
        .post("/api/v1/telemetry/heartbeat")
        .set(TELEMETRY_HEADER, "definitely-not-the-secret")
        .send(payloadFor(node.hostname));
      expect(res.status).toBe(401);
    });

    it("rejects metrics with no telemetry token", async () => {
      const node = await createGpuNode(fixtures, "metrics-auth");
      const res = await request(app).post("/api/v1/telemetry/metrics").send(payloadFor(node.hostname));
      expect(res.status).toBe(401);
    });

    it("accepts a heartbeat with the correct telemetry token", async () => {
      const node = await createGpuNode(fixtures, "auth-ok");
      const res = await request(app)
        .post("/api/v1/telemetry/heartbeat")
        .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
        .send(payloadFor(node.hostname));
      expect(res.status).toBe(200);
    });
  });

  describe("POST /telemetry/heartbeat", () => {
    it("persists a health snapshot, updates GpuNode.lastHeartbeat, and returns ONLINE", async () => {
      const node = await createGpuNode(fixtures, "hb-persist");
      const now = new Date();
      const res = await request(app)
        .post("/api/v1/telemetry/heartbeat")
        .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
        .send(payloadFor(node.hostname, { gpuUtilization: 88, timestamp: now.toISOString() }));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        gpuNodeId: node.id,
        hostname: node.hostname,
        connectivityStatus: "ONLINE",
      });

      const snapshot = await prisma.gpuHealthSnapshot.findUnique({ where: { gpuNodeId: node.id } });
      expect(snapshot?.gpuUtilization).toBe(88);

      const dbNode = await prisma.gpuNode.findUnique({ where: { id: node.id } });
      expect(dbNode?.lastHeartbeat?.toISOString()).toBe(now.toISOString());
    });

    it("returns 404 for an unknown hostname", async () => {
      const res = await request(app)
        .post("/api/v1/telemetry/heartbeat")
        .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
        .send(payloadFor(`unknown-${runId}.muj.local`));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /telemetry/metrics", () => {
    it("appends a historical metric row on every call, upserting only the latest snapshot", async () => {
      const node = await createGpuNode(fixtures, "metrics-persist");
      for (const gpuUtilization of [10, 20, 30]) {
        const res = await request(app)
          .post("/api/v1/telemetry/metrics")
          .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
          .send(payloadFor(node.hostname, { gpuUtilization }));
        expect(res.status).toBe(200);
      }

      const metrics = await prisma.gpuMetric.findMany({
        where: { gpuNodeId: node.id },
        orderBy: { recordedAt: "asc" },
      });
      expect(metrics).toHaveLength(3);
      expect(metrics.map((m) => m.gpuUtilization)).toEqual([10, 20, 30]);

      const snapshot = await prisma.gpuHealthSnapshot.findUnique({ where: { gpuNodeId: node.id } });
      expect(snapshot?.gpuUtilization).toBe(30);
    });
  });

  describe("connectivity status derivation", () => {
    it("reports ONLINE for a heartbeat sent just now", async () => {
      const node = await createGpuNode(fixtures, "status-online");
      await request(app)
        .post("/api/v1/telemetry/heartbeat")
        .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
        .send(payloadFor(node.hostname, { timestamp: new Date().toISOString() }));

      const res = await fixtures.studentA.agent.get(`/api/v1/gpu-nodes/${node.id}/health`);
      expect(res.status).toBe(200);
      expect(res.body.data.connectivityStatus).toBe("ONLINE");
      expect(res.body.data.status).toBe("ONLINE");
    });

    it("reports DEGRADED for a heartbeat ~60s old (within the 30-90s band)", async () => {
      const node = await createGpuNode(fixtures, "status-degraded");
      const sixtySecondsAgo = new Date(Date.now() - 60_000);
      await request(app)
        .post("/api/v1/telemetry/heartbeat")
        .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
        .send(payloadFor(node.hostname, { timestamp: sixtySecondsAgo.toISOString() }));

      const res = await fixtures.studentA.agent.get(`/api/v1/gpu-nodes/${node.id}/health`);
      expect(res.status).toBe(200);
      expect(res.body.data.connectivityStatus).toBe("DEGRADED");
    });

    it("reports OFFLINE for a heartbeat over 90s old", async () => {
      const node = await createGpuNode(fixtures, "status-offline");
      const wellOverThreshold = new Date(Date.now() - 200_000);
      await request(app)
        .post("/api/v1/telemetry/heartbeat")
        .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
        .send(payloadFor(node.hostname, { timestamp: wellOverThreshold.toISOString() }));

      const res = await fixtures.studentA.agent.get(`/api/v1/gpu-nodes/${node.id}/health`);
      expect(res.status).toBe(200);
      expect(res.body.data.connectivityStatus).toBe("OFFLINE");
    });

    it("reports OFFLINE with null metrics for a node that has never sent telemetry", async () => {
      const node = await createGpuNode(fixtures, "status-never");
      const res = await fixtures.studentA.agent.get(`/api/v1/gpu-nodes/${node.id}/health`);
      expect(res.status).toBe(200);
      expect(res.body.data.connectivityStatus).toBe("OFFLINE");
      expect(res.body.data.metrics).toBeNull();
    });
  });

  describe("GET /gpu-nodes/live", () => {
    it("lists nodes in a lab with their live status, filtered by labId", async () => {
      const node = await createGpuNode(fixtures, "live-list");
      await request(app)
        .post("/api/v1/telemetry/heartbeat")
        .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
        .send(payloadFor(node.hostname));

      const res = await fixtures.facultyA.agent
        .get("/api/v1/gpu-nodes/live")
        .query({ labId: fixtures.labAId });

      expect(res.status).toBe(200);
      const item = res.body.data.items.find((n: { gpuNodeId: string }) => n.gpuNodeId === node.id);
      expect(item).toBeDefined();
      expect(item.status).toBe("ONLINE");
    });

    it("excludes nodes from a different lab when filtered", async () => {
      const nodeInB = await fixtures.superAdmin.agent.post("/api/v1/gpu-nodes").send({
        labId: fixtures.labBId,
        hostname: `telemetry-live-labb-${runId}.muj.local`,
        gpuModel: "NVIDIA A100 80GB",
        gpuCount: 4,
        totalMemoryGB: 80,
        cpuCores: 32,
        ramGB: 256,
      });
      expect(nodeInB.status).toBe(201);

      const res = await fixtures.facultyA.agent
        .get("/api/v1/gpu-nodes/live")
        .query({ labId: fixtures.labAId });

      expect(res.status).toBe(200);
      expect(
        res.body.data.items.some((n: { gpuNodeId: string }) => n.gpuNodeId === nodeInB.body.data.id),
      ).toBe(false);
    });
  });

  describe("RBAC on GET endpoints", () => {
    it("rejects unauthenticated access to /gpu-nodes/live", async () => {
      const res = await request(app).get("/api/v1/gpu-nodes/live");
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated access to /gpu-nodes/:id/health", async () => {
      const node = await createGpuNode(fixtures, "rbac-health-anon");
      const res = await request(app).get(`/api/v1/gpu-nodes/${node.id}/health`);
      expect(res.status).toBe(401);
    });

    it("allows any authenticated role (e.g. STUDENT) to read live nodes", async () => {
      const res = await fixtures.studentA.agent.get("/api/v1/gpu-nodes/live");
      expect(res.status).toBe(200);
    });

    it("allows any authenticated role (e.g. STUDENT) to read a node's health", async () => {
      const node = await createGpuNode(fixtures, "rbac-health-ok");
      const res = await fixtures.studentA.agent.get(`/api/v1/gpu-nodes/${node.id}/health`);
      expect(res.status).toBe(200);
    });
  });

  describe("invalid payloads / validation errors", () => {
    it("rejects a heartbeat missing required fields", async () => {
      const res = await request(app)
        .post("/api/v1/telemetry/heartbeat")
        .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
        .send({ hostname: "incomplete.muj.local" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an out-of-range gpuUtilization", async () => {
      const node = await createGpuNode(fixtures, "validation-range");
      const res = await request(app)
        .post("/api/v1/telemetry/heartbeat")
        .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
        .send(payloadFor(node.hostname, { gpuUtilization: 150 }));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects metrics with a non-numeric temperature", async () => {
      const node = await createGpuNode(fixtures, "validation-type");
      const res = await request(app)
        .post("/api/v1/telemetry/metrics")
        .set(TELEMETRY_HEADER, env.telemetry.ingestToken)
        .send(payloadFor(node.hostname, { temperature: "hot" }));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a non-UUID labId query param on /live", async () => {
      const res = await fixtures.studentA.agent
        .get("/api/v1/gpu-nodes/live")
        .query({ labId: "not-a-uuid" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 for /gpu-nodes/:id/health with a well-formed but nonexistent id", async () => {
      const res = await fixtures.studentA.agent.get(
        "/api/v1/gpu-nodes/00000000-0000-0000-0000-000000000000/health",
      );
      expect(res.status).toBe(404);
    });
  });
});
