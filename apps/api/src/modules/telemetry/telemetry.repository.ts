import type { GpuHealthSnapshot, GpuMetric, PrismaClient } from "@prisma/client";
import type { TelemetryPayload } from "./telemetry.dto.js";

export type TelemetryWriteDb = Pick<PrismaClient, "gpuHealthSnapshot" | "gpuMetric">;

/** One row per node — latest known state, upserted on every ingestion call. */
export async function upsertHealthSnapshot(
  db: TelemetryWriteDb,
  gpuNodeId: string,
  payload: TelemetryPayload,
): Promise<GpuHealthSnapshot> {
  const fields = {
    gpuUtilization: payload.gpuUtilization,
    memoryUsedGB: payload.memoryUsedGB,
    temperature: payload.temperature,
    powerDraw: payload.powerDraw,
    activeProcesses: payload.activeProcesses,
    lastHeartbeat: payload.timestamp,
  };

  return db.gpuHealthSnapshot.upsert({
    where: { gpuNodeId },
    update: fields,
    create: { gpuNodeId, ...fields },
  });
}

/** Append-only — "store every metric historically". */
export async function createMetric(
  db: TelemetryWriteDb,
  gpuNodeId: string,
  payload: TelemetryPayload,
): Promise<GpuMetric> {
  return db.gpuMetric.create({
    data: {
      gpuNodeId,
      gpuUtilization: payload.gpuUtilization,
      memoryUsedGB: payload.memoryUsedGB,
      temperature: payload.temperature,
      powerDraw: payload.powerDraw,
      activeProcesses: payload.activeProcesses,
      recordedAt: payload.timestamp,
    },
  });
}

export async function listMetricsForNode(
  db: Pick<PrismaClient, "gpuMetric">,
  gpuNodeId: string,
  limit: number,
): Promise<GpuMetric[]> {
  return db.gpuMetric.findMany({
    where: { gpuNodeId },
    orderBy: { recordedAt: "desc" },
    take: limit,
  });
}
