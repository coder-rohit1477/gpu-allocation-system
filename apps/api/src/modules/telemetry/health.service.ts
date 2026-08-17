import type { GpuHealthSnapshot, PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";

/** Derived connectivity status — purely a function of heartbeat recency. */
export type ConnectivityStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

/**
 * Rules: heartbeat age < onlineThreshold → ONLINE; between the two
 * thresholds (inclusive) → DEGRADED; beyond degradedThreshold → OFFLINE.
 * A node that has never sent a heartbeat is OFFLINE.
 *
 * Pure and deterministic (no DB/clock side effects beyond the `now` you
 * pass in) so it can be unit-tested with fixed timestamps instead of
 * sleeping in tests.
 */
export function computeConnectivityStatus(
  lastHeartbeat: Date | null,
  now: Date = new Date(),
  onlineThresholdSeconds: number = env.telemetry.onlineThresholdSeconds,
  degradedThresholdSeconds: number = env.telemetry.degradedThresholdSeconds,
): ConnectivityStatus {
  if (!lastHeartbeat) return "OFFLINE";

  const ageSeconds = (now.getTime() - lastHeartbeat.getTime()) / 1000;
  if (ageSeconds < onlineThresholdSeconds) return "ONLINE";
  if (ageSeconds <= degradedThresholdSeconds) return "DEGRADED";
  return "OFFLINE";
}

export type HealthDb = Pick<PrismaClient, "gpuHealthSnapshot">;

export async function getHealthSnapshot(
  db: HealthDb,
  gpuNodeId: string,
): Promise<GpuHealthSnapshot | null> {
  return db.gpuHealthSnapshot.findUnique({ where: { gpuNodeId } });
}

export async function listHealthSnapshots(
  db: HealthDb,
  gpuNodeIds: string[],
): Promise<GpuHealthSnapshot[]> {
  if (gpuNodeIds.length === 0) return [];
  return db.gpuHealthSnapshot.findMany({ where: { gpuNodeId: { in: gpuNodeIds } } });
}
