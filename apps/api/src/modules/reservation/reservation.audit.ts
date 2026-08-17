import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Booking-engine audit actions. Kept separate from admin/audit.ts and
 * auth/audit.ts (different modules, different action vocabularies, same
 * underlying append-only AuditLog table) — mirrors the precedent those two
 * modules already set rather than sharing one grab-bag union.
 */
export type ReservationAuditAction =
  | "RESERVATION_CREATED"
  | "RESERVATION_APPROVED"
  | "RESERVATION_REJECTED"
  | "RESERVATION_CANCELLED"
  | "RESERVATION_ACTIVATED"
  | "RESERVATION_COMPLETED";

export interface RecordReservationAuditEventInput {
  /** Null for system-initiated transitions (the status worker activating/completing a reservation). */
  actorId: string | null;
  action: ReservationAuditAction;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export async function recordReservationAuditEvent(
  prisma: Pick<PrismaClient, "auditLog">,
  input: RecordReservationAuditEventInput,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      resourceType: "Reservation",
      resourceId: input.resourceId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
