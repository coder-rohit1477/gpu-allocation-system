import { useMemo, useState } from "react";
import { Button, Card, EmptyState, Skeleton } from "@gpu/ui";
import type { ReservationStatus } from "@gpu/types";
import { apiClient } from "../api/client.js";
import { useApi } from "../hooks/useApi.js";
import { AsyncSection } from "../components/AsyncSection.js";
import { PageHeader } from "../components/PageHeader.js";
import { ReservationStatusBadge } from "../components/StatusBadge.js";
import { downloadCsv } from "../lib/exportCsv.js";
import { formatDate, formatHours, hoursBetween } from "../lib/format.js";

const HISTORY_STATUSES: { value: ReservationStatus; label: string }[] = [
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REJECTED", label: "Rejected" },
];

export function ReservationHistoryPage() {
  const [status, setStatus] = useState<ReservationStatus>("COMPLETED");

  const reservations = useApi(
    () => apiClient.reservations.listMine({ status, pageSize: 100 }),
    [status],
  );
  const gpuNodes = useApi(() => apiClient.gpuNodes.list({ pageSize: 100 }), []);
  const courses = useApi(() => apiClient.courses.list({ pageSize: 100 }), []);

  const hostnameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of gpuNodes.data?.items ?? []) map.set(node.id, node.hostname);
    return map;
  }, [gpuNodes.data]);

  const courseLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of courses.data?.items ?? []) map.set(course.id, course.courseCode);
    return map;
  }, [courses.data]);

  const rows = useMemo(
    () =>
      (reservations.data?.items ?? [])
        .slice()
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [reservations.data],
  );

  function handleExport() {
    downloadCsv(
      `reservation-history-${status.toLowerCase()}.csv`,
      ["Date", "GPU Used", "Course", "Purpose", "Compute Hours", "Status"],
      rows.map((r) => [
        formatDate(r.startTime),
        hostnameById.get(r.gpuNodeId) ?? r.gpuNodeId,
        r.courseId ? (courseLabelById.get(r.courseId) ?? r.courseId) : "—",
        r.purpose,
        r.status === "COMPLETED" ? String(hoursBetween(r.startTime, r.endTime)) : "—",
        r.status,
      ]),
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Reservation History"
        description="Your completed, cancelled, and rejected reservations."
        actions={
          <Button variant="secondary" onClick={handleExport} disabled={rows.length === 0}>
            Export CSV
          </Button>
        }
      />

      <Card className="filter-bar">
        <label className="form__field form__field--inline">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as ReservationStatus)}>
            {HISTORY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <AsyncSection
        loading={reservations.loading}
        error={reservations.error}
        onRetry={reservations.reload}
        isEmpty={rows.length === 0}
        emptyState={<EmptyState title="No history yet" description="Nothing in this category yet." />}
        skeleton={
          <Card>
            <Skeleton height="10rem" />
          </Card>
        }
      >
        <Card className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">Reservation history</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">GPU Used</th>
                <th scope="col">Course</th>
                <th scope="col">Compute Hours</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.startTime)}</td>
                  <td>{hostnameById.get(r.gpuNodeId) ?? "—"}</td>
                  <td>{r.courseId ? (courseLabelById.get(r.courseId) ?? "—") : "—"}</td>
                  <td>{r.status === "COMPLETED" ? formatHours(hoursBetween(r.startTime, r.endTime)) : "—"}</td>
                  <td>
                    <ReservationStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </AsyncSection>
    </div>
  );
}
