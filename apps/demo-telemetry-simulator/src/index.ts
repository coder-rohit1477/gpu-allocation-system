import { writeFile } from "node:fs/promises";
import { env } from "./config/env.js";
import { generateSimulatedHostnames } from "./hostnames.js";
import { generateMetrics } from "./metrics.js";
import { logger } from "./lib/logger.js";
import { sendTelemetry } from "./telemetryClient.js";

/**
 * DEV/DEMO-ONLY GPU node-agent simulator.
 *
 * Stands in for physical GPU node-agents in a local/demo environment by
 * calling the exact same telemetry ingestion HTTP API a real agent would
 * (POST /api/v1/telemetry/heartbeat and /metrics, authenticated with the
 * shared TELEMETRY_INGEST_TOKEN). It never touches Prisma/PostgreSQL and
 * never writes ONLINE/OFFLINE anywhere itself — apps/api's existing
 * telemetry service derives connectivity status purely from heartbeat
 * recency (see modules/telemetry/health.service.ts), exactly as it does
 * for a real agent. Turning this container off lets nodes fall back to
 * OFFLINE through that same real logic, unchanged.
 */

const hostnames = generateSimulatedHostnames();

logger.info(
  { hostnames, intervalMs: env.heartbeatIntervalMs, apiBaseUrl: env.apiBaseUrl },
  "=== DEMO TELEMETRY SIMULATOR STARTING — synthetic GPU node-agent traffic, not real hardware ===",
);

let tick = 0;
let shuttingDown = false;

async function runRound(): Promise<void> {
  const now = new Date();
  // Alternate which endpoint carries this round's reading across ticks —
  // both endpoints persist identically (see telemetry.service.ts), so this
  // simply exercises both real ingestion paths instead of only one.
  const endpoint = tick % 2 === 0 ? "heartbeat" : "metrics";

  const results = await Promise.all(
    hostnames.map(async (hostname) => {
      const metrics = generateMetrics(hostname, tick);
      const result = await sendTelemetry(endpoint, hostname, metrics, now);
      if (result.ok) {
        logger.info(
          { hostname, endpoint, ...metrics },
          "[DEMO TELEMETRY] heartbeat sent — node reporting ONLINE",
        );
      } else {
        logger.warn(
          { hostname, endpoint, status: result.status, error: result.error },
          "[DEMO TELEMETRY] send failed — node will read as DEGRADED/OFFLINE until this recovers",
        );
      }
      return result.ok;
    }),
  );

  const successCount = results.filter(Boolean).length;
  if (successCount > 0) {
    await writeFile(env.healthFilePath, new Date().toISOString()).catch((error: unknown) => {
      logger.warn({ err: error }, "[DEMO TELEMETRY] failed to update healthcheck state file");
    });
  }

  logger.info(
    { successCount, total: hostnames.length, tick },
    "[DEMO TELEMETRY] round complete",
  );
  tick++;
}

async function loop(): Promise<void> {
  while (!shuttingDown) {
    await runRound().catch((error: unknown) => {
      logger.error({ err: error }, "[DEMO TELEMETRY] round failed unexpectedly");
    });
    if (shuttingDown) break;
    await new Promise((resolve) => setTimeout(resolve, env.heartbeatIntervalMs));
  }
}

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, "[DEMO TELEMETRY] shutting down — nodes will go OFFLINE via normal heartbeat-recency expiry");
  shuttingDown = true;
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

loop().catch((error: unknown) => {
  logger.error({ err: error }, "[DEMO TELEMETRY] fatal error");
  process.exitCode = 1;
});
