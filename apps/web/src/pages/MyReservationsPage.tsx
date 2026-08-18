import { useMemo, useState } from "react";
import { Button, Card, EmptyState, Skeleton, Tabs } from "@gpu/ui";
import type { TabItem } from "@gpu/ui";
import type { Reservation, ReservationStatus } from "@gpu/types";
import { apiClient } from "../api/client.js";
import { useApi } from "../hooks/useApi.js";
import { AsyncSection } from "../components/AsyncSection.js";
import { PageHeader } from "../components/PageHeader.js";
import { ReservationStatusBadge } from "../components/StatusBadge.js";
import { errorMessage } from "../lib/errors.js";
import { formatDateTime } from "../lib/format.js";

const TABS: { value: "ALL" | ReservationStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

const CANCELLABLE: ReservationStatus[] = ["PENDING", "APPROVED"];
const PAGE_SIZE = 10;

function ReservationRow({
  reservation,
  gpuHostname,
  courseLabel,
  onCancelled,
}: {
  reservation: Reservation;
  gpuHostname: string;
  courseLabel: string;
  onCancelled: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      await apiClient.reservations.cancel(reservation.id);
      onCancelled();
    } catch (err) {
      setError(errorMessage(err));
      setCancelling(false);
      setConfirming(false);
    }
  }

  return (
    <li className="reservation-row">
      <div className="reservation-row__summary">
        <div>
          <p className="stacked-list__title">{reservation.purpose}</p>
          <p className="stacked-list__meta">
            {gpuHostname} · {formatDateTime(reservation.startTime)} – {formatDateTime(reservation.endTime)}
          </p>
        </div>
        <div className="reservation-row__actions">
          {/* Status badge doubles as the faculty decision indicator: PENDING
              means awaiting a decision, APPROVED/REJECTED are the decision itself. */}
          <ReservationStatusBadge status={reservation.status} />
          {CANCELLABLE.includes(reservation.status) &&
            (confirming ? (
              <span className="confirm-inline">
                <span>Cancel it?</span>
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={cancelling}>
                  No
                </Button>
                <Button onClick={() => void handleCancel()} disabled={cancelling}>
                  {cancelling ? "Cancelling…" : "Yes, cancel"}
                </Button>
              </span>
            ) : (
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                Cancel
              </Button>
            ))}
        </div>
      </div>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <details className="reservation-row__details">
        <summary>View details</summary>
        <dl className="detail-grid">
          <div>
            <dt>GPU node</dt>
            <dd>{gpuHostname}</dd>
          </div>
          <div>
            <dt>Course</dt>
            <dd>{courseLabel}</dd>
          </div>
          <div>
            <dt>Requested</dt>
            <dd>{formatDateTime(reservation.createdAt)}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{formatDateTime(reservation.updatedAt)}</dd>
          </div>
        </dl>
      </details>
    </li>
  );
}

export function MyReservationsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("ALL");
  const [page, setPage] = useState(1);

  const reservations = useApi(() => apiClient.reservations.listMine({ pageSize: 100 }), []);
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

  const filtered = useMemo(() => {
    const items = reservations.data?.items ?? [];
    const byTab = tab === "ALL" ? items : items.filter((r) => r.status === tab);
    return [...byTab].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [reservations.data, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabItems: TabItem[] = TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count:
      t.value === "ALL"
        ? reservations.data?.items.length
        : reservations.data?.items.filter((r) => r.status === t.value).length,
  }));

  return (
    <div className="page">
      <PageHeader title="My Reservations" description="Every GPU reservation you've made, past and present." />

      <Tabs
        items={tabItems}
        value={tab}
        onChange={(value) => {
          setTab(value as (typeof TABS)[number]["value"]);
          setPage(1);
        }}
        aria-label="Filter reservations by status"
      />

      <AsyncSection
        loading={reservations.loading}
        error={reservations.error}
        onRetry={reservations.reload}
        isEmpty={filtered.length === 0}
        emptyState={
          <EmptyState
            title="No reservations here"
            description={tab === "ALL" ? "You haven't booked a GPU yet." : `You have no ${tab.toLowerCase()} reservations.`}
          />
        }
        skeleton={
          <Card>
            <Skeleton height="4rem" />
            <Skeleton height="4rem" />
            <Skeleton height="4rem" />
          </Card>
        }
      >
        <Card>
          <ul className="stacked-list stacked-list--reservations">
            {pageItems.map((reservation) => (
              <ReservationRow
                key={reservation.id}
                reservation={reservation}
                gpuHostname={hostnameById.get(reservation.gpuNodeId) ?? "Unknown node"}
                courseLabel={reservation.courseId ? (courseLabelById.get(reservation.courseId) ?? "Unknown course") : "— (research/personal)"}
                onCancelled={reservations.reload}
              />
            ))}
          </ul>

          {totalPages > 1 && (
            <nav className="pagination" aria-label="Reservation pages">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </nav>
          )}
        </Card>
      </AsyncSection>
    </div>
  );
}
