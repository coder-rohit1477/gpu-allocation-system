import { Link } from "react-router-dom";
import { Badge, Card, EmptyState, Skeleton } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";
import { apiClient } from "../api/client.js";
import { useApi } from "../hooks/useApi.js";
import { AsyncSection } from "../components/AsyncSection.js";
import { PageHeader } from "../components/PageHeader.js";
import { ReservationStatusBadge } from "../components/StatusBadge.js";
import { formatDateTime } from "../lib/format.js";

const TODAY_START = new Date();
TODAY_START.setHours(0, 0, 0, 0);
const TODAY_END = new Date(TODAY_START);
TODAY_END.setDate(TODAY_END.getDate() + 1);

export function DashboardPage() {
  const { user } = useAuth();

  const departments = useApi(() => apiClient.departments.list({ pageSize: 100 }), []);
  const activeReservations = useApi(
    () => apiClient.reservations.listMine({ status: "ACTIVE", pageSize: 5 }),
    [],
  );
  const pendingReservations = useApi(
    () => apiClient.reservations.listMine({ status: "PENDING", pageSize: 5 }),
    [],
  );
  const allReservations = useApi(() => apiClient.reservations.listMine({ pageSize: 100 }), []);

  const departmentName = departments.data?.items.find((d) => d.id === user?.departmentId)?.name;

  const todaysSessions =
    allReservations.data?.items.filter((r) => {
      const start = new Date(r.startTime).getTime();
      const end = new Date(r.endTime).getTime();
      return (
        start < TODAY_END.getTime() &&
        end > TODAY_START.getTime() &&
        ["APPROVED", "ACTIVE", "COMPLETED"].includes(r.status)
      );
    }) ?? [];

  return (
    <div className="page">
      <PageHeader
        title={`Welcome back${user ? `, ${user.fullName.split(" ")[0]}` : ""}`}
        description="Here's what's happening with your GPU reservations."
      />

      <Card className="welcome-card">
        <div>
          <p className="welcome-card__name">{user?.fullName}</p>
          <p className="welcome-card__meta">
            {user?.universityId} · {departmentName ?? "—"}
          </p>
        </div>
        <Badge tone="info">{user?.role}</Badge>
      </Card>

      <div className="dashboard-grid">
        <Card>
          <h2>Active reservation</h2>
          <AsyncSection
            loading={activeReservations.loading}
            error={activeReservations.error}
            onRetry={activeReservations.reload}
            isEmpty={activeReservations.data?.items.length === 0}
            emptyState={<EmptyState title="No active session" description="You're not using a GPU right now." />}
            skeleton={<Skeleton height="4rem" />}
          >
            <ul className="stacked-list">
              {activeReservations.data?.items.map((r) => (
                <li key={r.id}>
                  <div>
                    <p className="stacked-list__title">{r.purpose}</p>
                    <p className="stacked-list__meta">
                      {formatDateTime(r.startTime)} – {formatDateTime(r.endTime)}
                    </p>
                  </div>
                  <ReservationStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </AsyncSection>
        </Card>

        <Card>
          <h2>Pending approvals</h2>
          <AsyncSection
            loading={pendingReservations.loading}
            error={pendingReservations.error}
            onRetry={pendingReservations.reload}
            isEmpty={pendingReservations.data?.items.length === 0}
            emptyState={<EmptyState title="Nothing pending" description="All your requests have been decided." />}
            skeleton={<Skeleton height="4rem" />}
          >
            <ul className="stacked-list">
              {pendingReservations.data?.items.map((r) => (
                <li key={r.id}>
                  <div>
                    <p className="stacked-list__title">{r.purpose}</p>
                    <p className="stacked-list__meta">Requested for {formatDateTime(r.startTime)}</p>
                  </div>
                  <ReservationStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
            {pendingReservations.data && pendingReservations.data.total > 5 && (
              <Link to="/reservations" className="see-all-link">
                See all {pendingReservations.data.total} pending →
              </Link>
            )}
          </AsyncSection>
        </Card>

        <Card>
          <h2>Today&apos;s GPU usage</h2>
          <AsyncSection
            loading={allReservations.loading}
            error={allReservations.error}
            onRetry={allReservations.reload}
            isEmpty={todaysSessions.length === 0}
            emptyState={<EmptyState title="No sessions today" description="Nothing scheduled for today." />}
            skeleton={<Skeleton height="4rem" />}
          >
            <ul className="stacked-list">
              {todaysSessions.map((r) => (
                <li key={r.id}>
                  <div>
                    <p className="stacked-list__title">{r.purpose}</p>
                    <p className="stacked-list__meta">
                      {formatDateTime(r.startTime)} – {formatDateTime(r.endTime)}
                    </p>
                  </div>
                  <ReservationStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </AsyncSection>
        </Card>

        <Card>
          <h2>Quick actions</h2>
          <div className="quick-actions">
            <Link to="/gpu-explorer" className="quick-actions__link">
              Browse GPUs
            </Link>
            <Link to="/reservations" className="quick-actions__link">
              My Reservations
            </Link>
            <Link to="/calendar" className="quick-actions__link">
              Weekly Calendar
            </Link>
            <Link to="/notifications" className="quick-actions__link">
              Notifications
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
