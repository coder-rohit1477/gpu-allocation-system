import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { runReservationStatusSweep } from "./modules/reservation/reservationStatusWorker.service.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`[api] listening on port ${env.port} (${env.nodeEnv})`);
});

// Automatic Reservation Status Worker (Phase 6) — advances APPROVED ->
// ACTIVE -> COMPLETED purely on wall-clock time. Only runs when the server
// process actually boots (here), not when tests import createApp()
// directly, so Supertest integration tests stay deterministic and call
// runReservationStatusSweep() themselves with an explicit `now`.
const RESERVATION_SWEEP_INTERVAL_MS = 30_000;
setInterval(() => {
  runReservationStatusSweep(prisma).catch((error: unknown) => {
    console.error("[api] reservation status sweep failed", error);
  });
}, RESERVATION_SWEEP_INTERVAL_MS);
