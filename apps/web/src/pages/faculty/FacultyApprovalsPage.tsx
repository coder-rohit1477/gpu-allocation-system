import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Badge, Button, Card, EmptyState, Skeleton } from "@gpu/ui";
import type { Reservation, ReservationPriority } from "@gpu/types";
import { apiClient } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { AsyncSection } from "../../components/AsyncSection.js";
import { PageHeader } from "../../components/PageHeader.js";
import { Modal } from "../../components/Modal.js";
import { ReservationStatusBadge } from "../../components/StatusBadge.js";
import { errorMessage } from "../../lib/errors.js";
import { formatDateTime } from "../../lib/format.js";

interface EnrichedReservation extends Reservation {
  hostname: string;
  courseLabel: string;
  priority: ReservationPriority;
}

const PRIORITY_RANK: Record<ReservationPriority, number> = { COURSEWORK: 0, RESEARCH: 1 };

function ConfirmBulkModal({
  action,
  reservations,
  onClose,
  onDone,
}: {
  action: "approve" | "reject";
  reservations: EnrichedReservation[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const reservationIds = reservations.map((r) => r.id);
      if (action === "approve") {
        await apiClient.reservations.bulkApprove({ reservationIds });
      } else {
        await apiClient.reservations.bulkReject({ reservationIds, reason: reason.trim() || undefined });
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={action === "approve" ? `Approve ${reservations.length} reservations?` : `Reject ${reservations.length} reservations?`}
      onClose={onClose}
    >
      <form className="form" onSubmit={(e) => void handleConfirm(e)}>
        <p className="form__hint">
          This is transactional: if any one of these fails, none of them will be {action === "approve" ? "approved" : "rejected"}.
        </p>

        <ul className="stacked-list">
          {reservations.map((r) => (
            <li key={r.id}>
              <div>
                <p className="stacked-list__title">{r.purpose}</p>
                <p className="stacked-list__meta">
                  {r.courseLabel} · {r.hostname} · {formatDateTime(r.startTime)} – {formatDateTime(r.endTime)}
                </p>
              </div>
              <Badge tone={r.priority === "COURSEWORK" ? "info" : "neutral"}>
                {r.priority === "COURSEWORK" ? "Coursework" : "Research"}
              </Badge>
            </li>
          ))}
        </ul>

        {action === "reject" && (
          <label className="form__field">
            <span>Reason (optional)</span>
            <textarea
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Shared with every student in this batch"
            />
          </label>
        )}

        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}

        <div className="form__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? action === "approve"
                ? "Approving…"
                : "Rejecting…"
              : action === "approve"
                ? `Approve ${reservations.length}`
                : `Reject ${reservations.length}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function FacultyApprovalsPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);

  const pending = useApi(() => apiClient.reservations.pending({ pageSize: 100 }), []);
  const gpuNodes = useApi(() => apiClient.gpuNodes.list({ pageSize: 100 }), []);
  const courses = useApi(() => apiClient.courses.list({ pageSize: 100 }), []);

  const hostnameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of gpuNodes.data?.items ?? []) map.set(node.id, node.hostname);
    return map;
  }, [gpuNodes.data]);

  const courseLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of courses.data?.items ?? []) map.set(course.id, `${course.courseCode} — ${course.courseName}`);
    return map;
  }, [courses.data]);

  const items = useMemo((): EnrichedReservation[] => {
    const enriched = (pending.data?.items ?? []).map((r): EnrichedReservation => ({
      ...r,
      hostname: hostnameById.get(r.gpuNodeId) ?? "Unknown node",
      courseLabel: r.courseId ? (courseLabelById.get(r.courseId) ?? "Unknown course") : "— (research/personal)",
      priority: r.courseId ? "COURSEWORK" : "RESEARCH",
    }));
    // Same ordering as the backend's priority queue (apps/api's
    // priorityQueue.ts): coursework before research, then soonest-starting
    // first — so this list matches what faculty see on the dashboard preview.
    return enriched.sort((a, b) => {
      const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (rankDiff !== 0) return rankDiff;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [pending.data, hostnameById, courseLabelById]);

  const loading = pending.loading || gpuNodes.loading || courses.loading;
  const error = pending.error ?? gpuNodes.error ?? courses.error;

  const allSelected = items.length > 0 && items.every((r) => selected.has(r.id));
  const selectedReservations = items.filter((r) => selected.has(r.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((r) => r.id)));
  }

  function handleDone() {
    setConfirming(null);
    setSelected(new Set());
    pending.reload();
  }

  return (
    <div className="page">
      <PageHeader
        title="Pending Approvals"
        description="Select one or more reservations to approve or reject together."
      />

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={() => {
          pending.reload();
          gpuNodes.reload();
          courses.reload();
        }}
        isEmpty={items.length === 0}
        emptyState={<EmptyState title="Nothing pending" description="No reservations are waiting on your decision." />}
        skeleton={
          <Card>
            <Skeleton height="4rem" />
            <Skeleton height="4rem" />
            <Skeleton height="4rem" />
          </Card>
        }
      >
        <Card className="filter-bar bulk-actions-bar">
          <label className="approval-select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all pending reservations"
            />
            <span>{selected.size > 0 ? `${selected.size} selected` : "Select all"}</span>
          </label>
          <div className="reservation-row__actions">
            <Button
              variant="secondary"
              onClick={() => setConfirming("reject")}
              disabled={selected.size === 0}
            >
              Reject selected
            </Button>
            <Button onClick={() => setConfirming("approve")} disabled={selected.size === 0}>
              Approve selected
            </Button>
          </div>
        </Card>

        <Card>
          <ul className="stacked-list stacked-list--reservations">
            {items.map((reservation) => (
              <li key={reservation.id} className="reservation-row">
                <div className="reservation-row__summary">
                  <label className="approval-row__select">
                    <input
                      type="checkbox"
                      checked={selected.has(reservation.id)}
                      onChange={() => toggleOne(reservation.id)}
                      aria-label={`Select reservation: ${reservation.purpose}`}
                    />
                    <div>
                      <p className="stacked-list__title">{reservation.purpose}</p>
                      <p className="stacked-list__meta">
                        {reservation.courseLabel} · {reservation.hostname} ·{" "}
                        {formatDateTime(reservation.startTime)} – {formatDateTime(reservation.endTime)}
                      </p>
                    </div>
                  </label>
                  <div className="reservation-row__actions">
                    <Badge tone={reservation.priority === "COURSEWORK" ? "info" : "neutral"}>
                      {reservation.priority === "COURSEWORK" ? "Coursework" : "Research"}
                    </Badge>
                    <ReservationStatusBadge status={reservation.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </AsyncSection>

      {confirming && (
        <ConfirmBulkModal
          action={confirming}
          reservations={selectedReservations}
          onClose={() => setConfirming(null)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
