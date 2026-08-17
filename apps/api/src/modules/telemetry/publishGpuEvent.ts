import type { Redis } from "ioredis";
import type { ConnectivityStatus } from "./health.service.js";

export const GPU_HEALTH_CHANNEL = "gpu:health:updated";

export interface GpuHealthEvent {
  gpuNodeId: string;
  hostname: string;
  status: ConnectivityStatus | "MAINTENANCE";
  gpuUtilization: number;
  memoryUsedGB: number;
  temperature: number;
  powerDraw: number;
  activeProcesses: number;
  lastHeartbeat: string;
}

/** Narrow surface used for publishing — real ioredis client or a test double. */
export type Publisher = Pick<Redis, "publish">;

/**
 * Best-effort: a Redis outage must never fail telemetry ingestion, since
 * Postgres (not Redis) is the durable record. Callers await this but it
 * never rejects — failures are logged and swallowed.
 */
export async function publishGpuHealthEvent(publisher: Publisher, event: GpuHealthEvent): Promise<void> {
  try {
    await publisher.publish(GPU_HEALTH_CHANNEL, JSON.stringify(event));
  } catch (error) {
    console.error("[telemetry] failed to publish gpu health event", error);
  }
}
