import type { PrismaClient, Reservation } from "@prisma/client";
import { recordReservationAuditEvent } from "./reservation.audit.js";
import * as reservationRepository from "./reservation.repository.js";

export type ReservationWorkerDb = Pick<PrismaClient, "reservation" | "allocationSession" | "auditLog">;

export interface ReservationStatusSweepResult {
  activated: string[];
  completed: string[];
}

function computeHours(from: Date, to: Date): number {
  return Math.round(((to.getTime() - from.getTime()) / 3_600_000) * 100) / 100;
}

async function completeReservation(
  db: ReservationWorkerDb,
  reservation: Reservation,
  sessionStart: Date,
  sessionEnd: Date,
  now: Date,
): Promise<void> {
  await reservationRepository.updateReservationStatus(db, reservation.id, "COMPLETED");

  const runningSession = await db.allocationSession.findFirst({
    where: { reservationId: reservation.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });

  if (runningSession) {
    await db.allocationSession.update({
      where: { id: runningSession.id },
      data: { endedAt: sessionEnd, status: "COMPLETED", computeHours: computeHours(runningSession.startedAt, sessionEnd) },
    });
  } else {
    // Reached COMPLETED without ever passing through ACTIVE (the sweep
    // interval missed the activation window entirely) — still record a
    // session so compute-hour accounting stays complete.
    await db.allocationSession.create({
      data: {
        reservationId: reservation.id,
        startedAt: sessionStart,
        endedAt: sessionEnd,
        computeHours: computeHours(sessionStart, sessionEnd),
        status: "COMPLETED",
      },
    });
  }

  await recordReservationAuditEvent(db, {
    actorId: null,
    action: "RESERVATION_COMPLETED",
    resourceId: reservation.id,
    metadata: { at: now.toISOString() },
  });
}

/**
 * Automatic Reservation Status Worker — advances reservations through
 * APPROVED -> ACTIVE -> COMPLETED purely based on wall-clock time, no user
 * action required. Deliberately an interval-driven sweep inside the API
 * process (wired up in index.ts) rather than a BullMQ job in apps/worker:
 * apps/worker has no Prisma/database access configured, and adding it just
 * for this would be a bigger change than the feature warrants. Accepting
 * `now` as a parameter (default real time) is what makes this testable
 * without sleeping in tests — see __tests__/reservation.integration.test.ts.
 */
export async function runReservationStatusSweep(
  db: ReservationWorkerDb,
  now: Date = new Date(),
): Promise<ReservationStatusSweepResult> {
  const activated: string[] = [];
  const completed: string[] = [];

  const toActivate = await reservationRepository.findReservationsToActivate(db, now);
  for (const reservation of toActivate) {
    if (reservation.endTime.getTime() <= now.getTime()) {
      // Approved but never activated in time (its whole window already
      // elapsed) — go straight to COMPLETED rather than getting stuck.
      await completeReservation(db, reservation, reservation.startTime, reservation.endTime, now);
      completed.push(reservation.id);
      continue;
    }

    await reservationRepository.updateReservationStatus(db, reservation.id, "ACTIVE");
    await db.allocationSession.create({
      data: { reservationId: reservation.id, startedAt: now, status: "RUNNING" },
    });
    await recordReservationAuditEvent(db, {
      actorId: null,
      action: "RESERVATION_ACTIVATED",
      resourceId: reservation.id,
      metadata: { at: now.toISOString() },
    });
    activated.push(reservation.id);
  }

  const toComplete = await reservationRepository.findReservationsToComplete(db, now);
  for (const reservation of toComplete) {
    // Close out at the reservation's scheduled endTime, not the sweep's
    // `now` — the sweep interval means `now` may run a little late.
    await completeReservation(db, reservation, reservation.startTime, reservation.endTime, now);
    completed.push(reservation.id);
  }

  return { activated, completed };
}
