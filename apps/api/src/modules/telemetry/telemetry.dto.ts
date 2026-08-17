import { z } from "zod";

// Shared by both /telemetry/heartbeat and /telemetry/metrics — see
// telemetry.service.ts for why the two endpoints persist identically.
export const telemetryPayloadSchema = z.object({
  hostname: z.string().trim().min(1).max(255),
  gpuUtilization: z.coerce.number().min(0).max(100),
  memoryUsedGB: z.coerce.number().min(0).max(4096),
  temperature: z.coerce.number().min(-50).max(150),
  powerDraw: z.coerce.number().min(0).max(5000),
  activeProcesses: z.coerce.number().int().min(0).max(10_000),
  timestamp: z.coerce.date(),
});
export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;

export const listLiveGpuNodesQuerySchema = z.object({
  labId: z.string().uuid().optional(),
});
export type ListLiveGpuNodesQuery = z.infer<typeof listLiveGpuNodesQuerySchema>;
