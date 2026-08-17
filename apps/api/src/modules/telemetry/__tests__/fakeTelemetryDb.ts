import crypto from "node:crypto";
import type { GpuStatus, MaintenanceStatus } from "@prisma/client";
import type { TelemetryServiceDb } from "../telemetry.service.js";

export interface FakeGpuNodeRow {
  id: string;
  labId: string;
  hostname: string;
  gpuModel: string;
  gpuCount: number;
  totalMemoryGB: number;
  cpuCores: number;
  ramGB: number;
  status: GpuStatus;
  lastHeartbeat: Date | null;
}

interface FakeSnapshotRow {
  gpuNodeId: string;
  gpuUtilization: number;
  memoryUsedGB: number;
  temperature: number;
  powerDraw: number;
  activeProcesses: number;
  lastHeartbeat: Date;
}

interface FakeMetricRow {
  id: string;
  gpuNodeId: string;
  gpuUtilization: number;
  memoryUsedGB: number;
  temperature: number;
  powerDraw: number;
  activeProcesses: number;
  recordedAt: Date;
}

interface FakeMaintenanceWindowRow {
  id: string;
  gpuNodeId: string;
  status: MaintenanceStatus;
  startTime: Date;
  endTime: Date;
}

/** Minimal in-memory stand-in for the Prisma delegates telemetry.service.ts uses. */
export function createFakeTelemetryDb(seedNodes: FakeGpuNodeRow[] = []) {
  const nodes = new Map(seedNodes.map((n) => [n.id, n]));
  const snapshots = new Map<string, FakeSnapshotRow>();
  const metrics: FakeMetricRow[] = [];
  const maintenanceWindows: FakeMaintenanceWindowRow[] = [];

  const db = {
    gpuNode: {
      findUnique: async ({ where }: { where: { id?: string; hostname?: string } }) => {
        if (where.id) return nodes.get(where.id) ?? null;
        if (where.hostname) return [...nodes.values()].find((n) => n.hostname === where.hostname) ?? null;
        return null;
      },
      findMany: async ({ where }: { where?: { labId?: string } } = {}) => {
        const all = [...nodes.values()];
        if (where?.labId) return all.filter((n) => n.labId === where.labId);
        return all;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeGpuNodeRow> }) => {
        const node = nodes.get(where.id);
        if (!node) throw new Error("node not found");
        Object.assign(node, data);
        return node;
      },
    },
    gpuHealthSnapshot: {
      findUnique: async ({ where }: { where: { gpuNodeId: string } }) => snapshots.get(where.gpuNodeId) ?? null,
      findMany: async ({ where }: { where: { gpuNodeId: { in: string[] } } }) =>
        where.gpuNodeId.in.map((id) => snapshots.get(id)).filter((s): s is FakeSnapshotRow => Boolean(s)),
      upsert: async ({
        where,
        create,
      }: {
        where: { gpuNodeId: string };
        create: FakeSnapshotRow;
        update: Partial<FakeSnapshotRow>;
      }) => {
        const row: FakeSnapshotRow = { ...create };
        snapshots.set(where.gpuNodeId, row);
        return row;
      },
    },
    gpuMetric: {
      create: async ({ data }: { data: Omit<FakeMetricRow, "id"> }) => {
        const row: FakeMetricRow = { id: crypto.randomUUID(), ...data };
        metrics.push(row);
        return row;
      },
    },
    maintenanceWindow: {
      findFirst: async ({
        where,
      }: {
        where: {
          gpuNodeId: string;
          OR: [{ status: "IN_PROGRESS" }, { status: "SCHEDULED"; startTime: { lte: Date }; endTime: { gte: Date } }];
        };
      }) => {
        const now = where.OR[1].startTime.lte;
        return (
          maintenanceWindows.find((w) => {
            if (w.gpuNodeId !== where.gpuNodeId) return false;
            if (w.status === "IN_PROGRESS") return true;
            if (w.status === "SCHEDULED") {
              return w.startTime.getTime() <= now.getTime() && w.endTime.getTime() >= now.getTime();
            }
            return false;
          }) ?? null
        );
      },
      findMany: async ({
        where,
      }: {
        where: {
          gpuNodeId: { in: string[] };
          OR: [{ status: "IN_PROGRESS" }, { status: "SCHEDULED"; startTime: { lte: Date }; endTime: { gte: Date } }];
        };
      }) => {
        const now = where.OR[1].startTime.lte;
        return maintenanceWindows.filter((w) => {
          if (!where.gpuNodeId.in.includes(w.gpuNodeId)) return false;
          if (w.status === "IN_PROGRESS") return true;
          if (w.status === "SCHEDULED") {
            return w.startTime.getTime() <= now.getTime() && w.endTime.getTime() >= now.getTime();
          }
          return false;
        });
      },
    },
  };

  return {
    db: db as unknown as TelemetryServiceDb,
    nodes,
    snapshots,
    metrics,
    maintenanceWindows,
  };
}
