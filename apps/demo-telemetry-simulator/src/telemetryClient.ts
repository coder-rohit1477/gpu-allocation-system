import { env } from "./config/env.js";
import type { SimulatedMetrics } from "./metrics.js";

export type TelemetryEndpoint = "heartbeat" | "metrics";

export interface TelemetrySendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * Posts to the real ingestion endpoints (apps/api's
 * POST /api/v1/telemetry/heartbeat and /metrics) using the same
 * X-Telemetry-Token shared-secret header a physical node-agent uses — see
 * apps/api/src/modules/telemetry/requireTelemetryToken.ts. No Prisma, no
 * direct DB access: this is an HTTP client and nothing else.
 */
export async function sendTelemetry(
  endpoint: TelemetryEndpoint,
  hostname: string,
  metrics: SimulatedMetrics,
  timestamp: Date,
): Promise<TelemetrySendResult> {
  const url = `${env.apiBaseUrl}/api/v1/telemetry/${endpoint}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telemetry-token": env.telemetryToken,
      },
      body: JSON.stringify({
        hostname,
        gpuUtilization: metrics.gpuUtilization,
        memoryUsedGB: metrics.memoryUsedGB,
        temperature: metrics.temperature,
        powerDraw: metrics.powerDraw,
        activeProcesses: metrics.activeProcesses,
        timestamp: timestamp.toISOString(),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, status: response.status, error: body.slice(0, 500) };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
