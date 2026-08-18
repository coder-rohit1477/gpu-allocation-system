import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { runReservationStatusSweep } from "./modules/reservation/reservationStatusWorker.service.js";

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, "api listening");
});

// Automatic Reservation Status Worker (Phase 6) — advances APPROVED ->
// ACTIVE -> COMPLETED purely on wall-clock time. Only runs when the server
// process actually boots (here), not when tests import createApp()
// directly, so Supertest integration tests stay deterministic and call
// runReservationStatusSweep() themselves with an explicit `now`.
const RESERVATION_SWEEP_INTERVAL_MS = 30_000;
const sweepInterval = setInterval(() => {
  runReservationStatusSweep(prisma).catch((error: unknown) => {
    logger.error({ err: error }, "reservation status sweep failed");
  });
}, RESERVATION_SWEEP_INTERVAL_MS);

// Graceful shutdown (Phase 10 devops) — lets in-flight requests finish and
// stops the sweep interval before the process exits, so `docker stop` /
// orchestrator rollouts don't cut connections mid-response.
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, "shutting down");
  clearInterval(sweepInterval);
  server.close((err) => {
    if (err) {
      logger.error({ err }, "error during shutdown");
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
