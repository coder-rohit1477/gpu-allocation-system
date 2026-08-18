import { Badge } from "@gpu/ui";
import type { BadgeTone } from "@gpu/ui";
import type { ConnectivityStatus, ReservationStatus } from "@gpu/types";

const RESERVATION_TONE: Record<ReservationStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "info",
  ACTIVE: "success",
  COMPLETED: "neutral",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

const CONNECTIVITY_TONE: Record<ConnectivityStatus, BadgeTone> = {
  ONLINE: "success",
  DEGRADED: "warning",
  OFFLINE: "danger",
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge tone={RESERVATION_TONE[status]}>{status}</Badge>;
}

export function ConnectivityBadge({ status }: { status: ConnectivityStatus }) {
  return <Badge tone={CONNECTIVITY_TONE[status]}>{status}</Badge>;
}
