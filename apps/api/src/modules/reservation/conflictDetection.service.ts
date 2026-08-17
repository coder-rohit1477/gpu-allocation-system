import * as reservationRepository from "./reservation.repository.js";
import type { MaintenanceWindowDb, ReservationDb } from "./reservation.repository.js";

export type ConflictCheckDb = ReservationDb & MaintenanceWindowDb;

export interface ConflictCheckResult {
  hasReservationConflict: boolean;
  hasMaintenanceConflict: boolean;
}

export function isConflictFree(result: ConflictCheckResult): boolean {
  return !result.hasReservationConflict && !result.hasMaintenanceConflict;
}

/**
 * Conflict Detection Engine — the single source of truth for "can this GPU
 * node be booked for [startTime, endTime)". Checked against both other
 * reservations (PENDING/APPROVED/ACTIVE) and admin-scheduled maintenance
 * windows (SCHEDULED/IN_PROGRESS); COMPLETED maintenance never blocks.
 * `excludeReservationId` lets a reservation's own row be ignored when
 * re-validating it (not currently used at create time, but keeps the check
 * reusable for a future "reschedule" flow without a second implementation).
 */
export async function checkConflicts(
  db: ConflictCheckDb,
  gpuNodeId: string,
  startTime: Date,
  endTime: Date,
  excludeReservationId?: string,
): Promise<ConflictCheckResult> {
  const [reservations, maintenanceWindows] = await Promise.all([
    reservationRepository.findOverlappingReservations(
      db,
      gpuNodeId,
      startTime,
      endTime,
      excludeReservationId,
    ),
    reservationRepository.findOverlappingMaintenanceWindows(db, gpuNodeId, startTime, endTime),
  ]);

  return {
    hasReservationConflict: reservations.length > 0,
    hasMaintenanceConflict: maintenanceWindows.length > 0,
  };
}
