import type { Reservation } from "@prisma/client";

/**
 * Phase 7's priority classification. Deliberately derived rather than a new
 * schema column: a reservation tied to a Course (coursework, e.g. a
 * scheduled lab session) is distinguished from a standalone booking
 * (research/individual use) purely by whether `courseId` is set — Phase 2's
 * Reservation.courseId already captures exactly this distinction.
 */
export type ReservationPriority = "COURSEWORK" | "RESEARCH";

export function priorityOf(reservation: Pick<Reservation, "courseId">): ReservationPriority {
  return reservation.courseId ? "COURSEWORK" : "RESEARCH";
}

const PRIORITY_RANK: Record<ReservationPriority, number> = { COURSEWORK: 0, RESEARCH: 1 };

/**
 * Orders a faculty member's approval queue so scheduled class sessions
 * (coursework) are not left waiting behind individual research requests.
 * Stable within each priority tier: ties are broken by startTime ascending
 * (soonest-starting session first), and Array.prototype.sort is stable per
 * spec, so equal-priority/equal-startTime input order is preserved.
 */
export function sortByPriority<T extends Pick<Reservation, "courseId" | "startTime">>(
  reservations: T[],
): T[] {
  return [...reservations].sort((a, b) => {
    const rankDiff = PRIORITY_RANK[priorityOf(a)] - PRIORITY_RANK[priorityOf(b)];
    if (rankDiff !== 0) return rankDiff;
    return a.startTime.getTime() - b.startTime.getTime();
  });
}
