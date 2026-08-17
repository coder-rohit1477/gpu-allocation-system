import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../common/errors.js";
import { getNodeHealth, ingestTelemetry, listLiveNodes } from "../telemetry.service.js";
import type { TelemetryPayload } from "../telemetry.dto.js";
import { createFakeTelemetryDb, type FakeGpuNodeRow } from "./fakeTelemetryDb.js";

function makeNode(overrides: Partial<FakeGpuNodeRow> = {}): FakeGpuNodeRow {
  return {
    id: "node-1",
    labId: "lab-1",
    hostname: "gpu-01.muj.local",
    gpuModel: "NVIDIA A100 80GB",
    gpuCount: 4,
    totalMemoryGB: 80,
    cpuCores: 32,
    ramGB: 256,
    status: "AVAILABLE",
    lastHeartbeat: null,
    ...overrides,
  };
}

function makePayload(overrides: Partial<TelemetryPayload> = {}): TelemetryPayload {
  return {
    hostname: "gpu-01.muj.local",
    gpuUtilization: 55,
    memoryUsedGB: 40,
    temperature: 65,
    powerDraw: 300,
    activeProcesses: 2,
    timestamp: new Date(),
    ...overrides,
  };
}

function fakePublisher() {
  return { publish: vi.fn().mockResolvedValue(1) };
}

describe("ingestTelemetry", () => {
  it("rejects telemetry for an unknown hostname", async () => {
    const { db } = createFakeTelemetryDb([]);
    await expect(ingestTelemetry(db, fakePublisher(), makePayload())).rejects.toThrow(AppError);
  });

  it("persists a health snapshot, a historical metric row, and updates lastHeartbeat", async () => {
    const node = makeNode();
    const { db, snapshots, metrics, nodes } = createFakeTelemetryDb([node]);
    const payload = makePayload({ gpuUtilization: 77 });

    const result = await ingestTelemetry(db, fakePublisher(), payload);

    expect(result).toMatchObject({ gpuNodeId: "node-1", hostname: "gpu-01.muj.local" });
    expect(snapshots.get("node-1")?.gpuUtilization).toBe(77);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.gpuUtilization).toBe(77);
    expect(nodes.get("node-1")?.lastHeartbeat).toEqual(payload.timestamp);
  });

  it("publishes a Redis event with the computed connectivity status", async () => {
    const node = makeNode();
    const { db } = createFakeTelemetryDb([node]);
    const publisher = fakePublisher();

    await ingestTelemetry(db, publisher, makePayload({ timestamp: new Date() }));

    expect(publisher.publish).toHaveBeenCalledOnce();
    const [, payload] = publisher.publish.mock.calls[0]!;
    expect(JSON.parse(payload as string)).toMatchObject({ hostname: "gpu-01.muj.local", status: "ONLINE" });
  });

  it("accumulates multiple historical metric rows across repeated ingestion", async () => {
    const node = makeNode();
    const { db, metrics } = createFakeTelemetryDb([node]);

    await ingestTelemetry(db, fakePublisher(), makePayload({ gpuUtilization: 10 }));
    await ingestTelemetry(db, fakePublisher(), makePayload({ gpuUtilization: 20 }));
    await ingestTelemetry(db, fakePublisher(), makePayload({ gpuUtilization: 30 }));

    expect(metrics).toHaveLength(3);
    expect(metrics.map((m) => m.gpuUtilization)).toEqual([10, 20, 30]);
  });
});

describe("getNodeHealth", () => {
  it("throws NOT_FOUND for an unknown node id", async () => {
    const { db } = createFakeTelemetryDb([]);
    await expect(getNodeHealth(db, "missing-id")).rejects.toThrow(AppError);
  });

  it("reports OFFLINE with no snapshot for a node that has never reported in", async () => {
    const node = makeNode({ lastHeartbeat: null });
    const { db } = createFakeTelemetryDb([node]);

    const health = await getNodeHealth(db, "node-1");

    expect(health.status).toBe("OFFLINE");
    expect(health.connectivityStatus).toBe("OFFLINE");
    expect(health.metrics).toBeNull();
    expect(health.underMaintenance).toBe(false);
  });

  it("reports MAINTENANCE instead of OFFLINE when an IN_PROGRESS window covers the node", async () => {
    const node = makeNode({ lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000) });
    const { db, maintenanceWindows } = createFakeTelemetryDb([node]);
    maintenanceWindows.push({
      id: "mw-1",
      gpuNodeId: "node-1",
      status: "IN_PROGRESS",
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 60_000),
    });

    const health = await getNodeHealth(db, "node-1");

    expect(health.connectivityStatus).toBe("OFFLINE");
    expect(health.status).toBe("MAINTENANCE");
    expect(health.underMaintenance).toBe(true);
  });

  it("does not report MAINTENANCE for a SCHEDULED window outside its time range", async () => {
    const node = makeNode({ lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000) });
    const { db, maintenanceWindows } = createFakeTelemetryDb([node]);
    maintenanceWindows.push({
      id: "mw-2",
      gpuNodeId: "node-1",
      status: "SCHEDULED",
      startTime: new Date(Date.now() + 3600_000),
      endTime: new Date(Date.now() + 7200_000),
    });

    const health = await getNodeHealth(db, "node-1");

    expect(health.status).toBe("OFFLINE");
    expect(health.underMaintenance).toBe(false);
  });
});

describe("listLiveNodes", () => {
  it("computes independent statuses for each node", async () => {
    const online = makeNode({ id: "node-online", hostname: "online.muj.local", lastHeartbeat: new Date() });
    const offline = makeNode({
      id: "node-offline",
      hostname: "offline.muj.local",
      lastHeartbeat: new Date(Date.now() - 3600_000),
    });
    const { db } = createFakeTelemetryDb([online, offline]);

    const results = await listLiveNodes(db);
    const byId = new Map(results.map((r) => [r.gpuNodeId, r]));

    expect(byId.get("node-online")?.status).toBe("ONLINE");
    expect(byId.get("node-offline")?.status).toBe("OFFLINE");
  });

  it("filters by labId", async () => {
    const inLabA = makeNode({ id: "a", hostname: "a.muj.local", labId: "lab-a" });
    const inLabB = makeNode({ id: "b", hostname: "b.muj.local", labId: "lab-b" });
    const { db } = createFakeTelemetryDb([inLabA, inLabB]);

    const results = await listLiveNodes(db, { labId: "lab-a" });

    expect(results).toHaveLength(1);
    expect(results[0]?.gpuNodeId).toBe("a");
  });
});
