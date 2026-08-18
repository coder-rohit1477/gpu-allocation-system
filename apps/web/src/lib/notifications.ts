import type { Reservation, ReservationStatus } from "@gpu/types";

export type NotificationTone = "success" | "warning" | "danger" | "info";

export interface DerivedNotification {
  id: string;
  reservationId: string;
  title: string;
  message: string;
  tone: NotificationTone;
  /** ISO timestamp used for sorting/grouping — the reservation's updatedAt. */
  occurredAt: string;
}

const STATUS_COPY: Partial<
  Record<ReservationStatus, { title: string; tone: NotificationTone; message: (purpose: string) => string }>
> = {
  APPROVED: {
    title: "Reservation approved",
    tone: "success",
    message: (purpose) => `Your reservation for "${purpose}" was approved by faculty.`,
  },
  REJECTED: {
    title: "Reservation rejected",
    tone: "danger",
    message: (purpose) => `Your reservation for "${purpose}" was rejected by faculty.`,
  },
  ACTIVE: {
    title: "Session started",
    tone: "info",
    message: (purpose) => `Your session for "${purpose}" is now active.`,
  },
  COMPLETED: {
    title: "Session completed",
    tone: "info",
    message: (purpose) => `Your session for "${purpose}" has completed.`,
  },
  CANCELLED: {
    title: "Reservation cancelled",
    tone: "warning",
    message: (purpose) => `Your reservation for "${purpose}" was cancelled.`,
  },
};

/**
 * There is no Notification API (Phase 1-7 never implemented one, and Phase 8
 * may not add backend endpoints), so the Notification Center is derived
 * client-side from GET /reservations/me — every reservation that has left
 * PENDING carries a real, meaningful status change worth surfacing. This is
 * a real feed of real events, not fabricated data; it just has no
 * `isRead` field of its own; see notificationReadState.ts for how read/unread
 * is tracked without a backend field to persist it in.
 */
export function deriveNotifications(reservations: Reservation[]): DerivedNotification[] {
  const notifications: DerivedNotification[] = [];

  for (const reservation of reservations) {
    const copy = STATUS_COPY[reservation.status];
    if (!copy) continue; // PENDING has no event to announce yet.
    notifications.push({
      id: `${reservation.id}:${reservation.status}`,
      reservationId: reservation.id,
      title: copy.title,
      message: copy.message(reservation.purpose),
      tone: copy.tone,
      occurredAt: reservation.updatedAt,
    });
  }

  return notifications.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}
