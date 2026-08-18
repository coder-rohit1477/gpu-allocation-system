import { Link } from "react-router-dom";
import { Badge, Card, EmptyState, Skeleton } from "@gpu/ui";
import type { FacultyReservationSummary } from "@gpu/types";
import { apiClient } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { AsyncSection } from "../../components/AsyncSection.js";
import { PageHeader } from "../../components/PageHeader.js";
import { ReservationStatusBadge } from "../../components/StatusBadge.js";
import { formatDateTime } from "../../lib/format.js";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__value">{value}</span>
      <span className="stat-tile__label">{label}</span>
    </div>
  );
}

function ReservationSummaryRow({ reservation }: { reservation: FacultyReservationSummary }) {
  return (
    <li>
      <div>
        <p className="stacked-list__title">{reservation.purpose}</p>
        <p className="stacked-list__meta">
          {reservation.hostname} · {reservation.laboratoryName} ·{" "}
          {formatDateTime(reservation.startTime)} – {formatDateTime(reservation.endTime)}
        </p>
      </div>
      <div className="reservation-row__actions">
        <Badge tone={reservation.priority === "COURSEWORK" ? "info" : "neutral"}>
          {reservation.priority === "COURSEWORK" ? "Coursework" : "Research"}
        </Badge>
        <ReservationStatusBadge status={reservation.status} />
      </div>
    </li>
  );
}

export function FacultyDashboardPage() {
  const dashboard = useApi(() => apiClient.faculty.dashboard(), []);

  return (
    <div className="page">
      <PageHeader
        title="Faculty Dashboard"
        description="Pending approvals, today's sessions, and GPU usage across your department."
      />

      <AsyncSection
        loading={dashboard.loading}
        error={dashboard.error}
        onRetry={dashboard.reload}
        skeleton={<Skeleton height="6rem" />}
      >
        {dashboard.data && (
          <Card className="stat-tile-row">
            <StatTile label="Pending approvals" value={dashboard.data.pendingApprovals.total} />
            <StatTile label="Today's sessions" value={dashboard.data.todaysSessions.length} />
            <StatTile label="Active GPUs" value={`${dashboard.data.activeGpuUsage.activeNodes} / ${dashboard.data.activeGpuUsage.totalNodes}`} />
            <StatTile label="GPU utilization" value={`${dashboard.data.activeGpuUsage.utilizationPercent}%`} />
            <StatTile label="Upcoming reservations" value={dashboard.data.upcomingReservations.length} />
          </Card>
        )}
      </AsyncSection>

      <div className="dashboard-grid">
        <Card>
          <h2>Pending approvals</h2>
          <AsyncSection
            loading={dashboard.loading}
            error={dashboard.error}
            onRetry={dashboard.reload}
            isEmpty={dashboard.data?.pendingApprovals.items.length === 0}
            emptyState={<EmptyState title="Nothing pending" description="No reservations are waiting on your decision." />}
            skeleton={<Skeleton height="4rem" />}
          >
            <ul className="stacked-list">
              {dashboard.data?.pendingApprovals.items.map((r) => (
                <ReservationSummaryRow key={r.id} reservation={r} />
              ))}
            </ul>
            {dashboard.data && dashboard.data.pendingApprovals.total > dashboard.data.pendingApprovals.items.length && (
              <Link to="/faculty/approvals" className="see-all-link">
                See all {dashboard.data.pendingApprovals.total} pending →
              </Link>
            )}
          </AsyncSection>
        </Card>

        <Card>
          <h2>Today&apos;s GPU sessions</h2>
          <AsyncSection
            loading={dashboard.loading}
            error={dashboard.error}
            onRetry={dashboard.reload}
            isEmpty={dashboard.data?.todaysSessions.length === 0}
            emptyState={<EmptyState title="No sessions today" description="Nothing scheduled in your department's labs today." />}
            skeleton={<Skeleton height="4rem" />}
          >
            <ul className="stacked-list">
              {dashboard.data?.todaysSessions.map((r) => (
                <ReservationSummaryRow key={r.id} reservation={r} />
              ))}
            </ul>
          </AsyncSection>
        </Card>

        <Card>
          <h2>Upcoming reservations</h2>
          <AsyncSection
            loading={dashboard.loading}
            error={dashboard.error}
            onRetry={dashboard.reload}
            isEmpty={dashboard.data?.upcomingReservations.length === 0}
            emptyState={<EmptyState title="Nothing upcoming" description="No approved reservations are scheduled yet." />}
            skeleton={<Skeleton height="4rem" />}
          >
            <ul className="stacked-list">
              {dashboard.data?.upcomingReservations.map((r) => (
                <ReservationSummaryRow key={r.id} reservation={r} />
              ))}
            </ul>
          </AsyncSection>
        </Card>

        <Card>
          <h2>Quick actions</h2>
          <div className="quick-actions">
            <Link to="/faculty/approvals" className="quick-actions__link">
              Review Approvals
            </Link>
            <Link to="/faculty/courses" className="quick-actions__link">
              My Courses
            </Link>
            <Link to="/faculty/schedule" className="quick-actions__link">
              Weekly Schedule
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
