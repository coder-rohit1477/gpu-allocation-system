import { useMemo, useState } from "react";
import { BarChart, Card, EmptyState, Skeleton, StatusBar, TrendChart } from "@gpu/ui";
import { apiClient } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { AsyncSection } from "../../components/AsyncSection.js";
import { PageHeader } from "../../components/PageHeader.js";
import { CHART_COLORS } from "../../lib/chartColors.js";
import { formatDate, formatHours } from "../../lib/format.js";

const TREND_DAYS = 14;
const TOP_COURSES_LIMIT = 10;

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__value">{value}</span>
      <span className="stat-tile__label">{label}</span>
    </div>
  );
}

export function AdminAnalyticsPage() {
  const [departmentId, setDepartmentId] = useState("");

  const university = useApi(() => apiClient.analytics.university(), []);
  const departments = useApi(() => apiClient.analytics.departments(), []);
  const gpuUtilization = useApi(
    () => apiClient.analytics.gpuUtilization(departmentId ? { departmentId } : undefined),
    [departmentId],
  );
  const students = useApi(() => apiClient.analytics.students(), []);
  const topCourses = useApi(() => apiClient.analytics.courses({ limit: TOP_COURSES_LIMIT }), []);
  const trend = useApi(() => apiClient.reports.daily({ days: TREND_DAYS }), []);

  const departmentOptionsForFilter = departments.data?.items ?? [];

  const utilizationBars = useMemo(
    () =>
      (gpuUtilization.data?.items ?? [])
        .filter((n) => n.currentUtilizationPercent !== null)
        .sort((a, b) => (b.currentUtilizationPercent ?? 0) - (a.currentUtilizationPercent ?? 0))
        .slice(0, 15)
        .map((n) => ({ label: n.hostname, value: n.currentUtilizationPercent ?? 0 })),
    [gpuUtilization.data],
  );

  const departmentReservationBars = useMemo(
    () =>
      (departments.data?.items ?? [])
        .map((d) => ({ label: d.departmentCode, value: d.totalReservations }))
        .sort((a, b) => b.value - a.value),
    [departments.data],
  );

  const departmentComputeHourBars = useMemo(
    () =>
      (departments.data?.items ?? [])
        .map((d) => ({ label: d.departmentCode, value: Math.round(d.totalComputeHours * 100) / 100 }))
        .sort((a, b) => b.value - a.value),
    [departments.data],
  );

  const trendPoints = useMemo(
    () => (trend.data?.buckets ?? []).map((b) => ({ label: formatDate(b.periodStart), value: b.reservationsCreated })),
    [trend.data],
  );

  const topCourseBars = useMemo(
    () =>
      (topCourses.data?.items ?? []).map((c) => ({
        label: c.courseCode,
        value: c.totalReservations,
      })),
    [topCourses.data],
  );

  return (
    <div className="page">
      <PageHeader title="Analytics" description="University-wide GPU usage, reservations, and compute hours." />

      <AsyncSection
        loading={university.loading}
        error={university.error}
        onRetry={university.reload}
        skeleton={<Skeleton height="6rem" />}
      >
        {university.data && (
          <Card className="stat-tile-row">
            <StatTile label="GPU nodes" value={university.data.totals.gpuNodes} />
            <StatTile label="Students" value={university.data.totals.students} />
            <StatTile label="Faculty" value={university.data.totals.faculty} />
            <StatTile label="Courses" value={university.data.totals.courses} />
            <StatTile label="Compute hours" value={formatHours(university.data.totalComputeHours)} />
            <StatTile label="Active students" value={students.data?.activeStudents ?? "—"} />
          </Card>
        )}
      </AsyncSection>

      <div className="analytics-grid">
        <Card>
          <h2>GPU Utilization</h2>
          <label className="form__field form__field--inline">
            <span>Department</span>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">All departments</option>
              {departmentOptionsForFilter.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.departmentName}
                </option>
              ))}
            </select>
          </label>
          <AsyncSection
            loading={gpuUtilization.loading}
            error={gpuUtilization.error}
            onRetry={gpuUtilization.reload}
            isEmpty={utilizationBars.length === 0}
            emptyState={<EmptyState title="No live utilization data" description="No node has reported telemetry recently." />}
            skeleton={<Skeleton height="10rem" />}
          >
            <BarChart
              data={utilizationBars}
              color={CHART_COLORS.blue}
              ariaLabel="Current GPU utilization percent by node"
              valueFormatter={(v) => `${v}%`}
            />
          </AsyncSection>
        </Card>

        <Card>
          <h2>Department Comparison</h2>
          <p className="page-header__description">Total reservations per department.</p>
          <AsyncSection
            loading={departments.loading}
            error={departments.error}
            onRetry={departments.reload}
            isEmpty={departmentReservationBars.length === 0}
            emptyState={<EmptyState title="No departments yet" />}
            skeleton={<Skeleton height="10rem" />}
          >
            <BarChart
              data={departmentReservationBars}
              color={CHART_COLORS.orange}
              ariaLabel="Total reservations by department"
            />
          </AsyncSection>
        </Card>

        <Card>
          <h2>Reservation Trends</h2>
          <p className="page-header__description">Reservations created per day, last {TREND_DAYS} days.</p>
          <AsyncSection
            loading={trend.loading}
            error={trend.error}
            onRetry={trend.reload}
            isEmpty={trendPoints.length === 0}
            emptyState={<EmptyState title="No trend data yet" />}
            skeleton={<Skeleton height="10rem" />}
          >
            <TrendChart data={trendPoints} color={CHART_COLORS.blue} ariaLabel="Reservations created per day" />
          </AsyncSection>
        </Card>

        <Card>
          <h2>Compute Hours</h2>
          <p className="page-header__description">Total compute hours per department.</p>
          <AsyncSection
            loading={departments.loading}
            error={departments.error}
            onRetry={departments.reload}
            isEmpty={departmentComputeHourBars.length === 0}
            emptyState={<EmptyState title="No compute hours recorded yet" />}
            skeleton={<Skeleton height="10rem" />}
          >
            <BarChart
              data={departmentComputeHourBars}
              color={CHART_COLORS.aqua}
              ariaLabel="Total compute hours by department"
              valueFormatter={(v) => `${v} h`}
            />
          </AsyncSection>
        </Card>

        <Card>
          <h2>Offline Nodes</h2>
          <p className="page-header__description">GPU node connectivity across the institution.</p>
          <AsyncSection
            loading={university.loading}
            error={university.error}
            onRetry={university.reload}
            skeleton={<Skeleton height="4rem" />}
          >
            {university.data && (
              <StatusBar
                ariaLabel="GPU node connectivity breakdown"
                segments={[
                  { label: "Online", value: university.data.gpuNodesByConnectivity.online, tone: "good" },
                  { label: "Degraded", value: university.data.gpuNodesByConnectivity.degraded, tone: "warning" },
                  { label: "Offline", value: university.data.gpuNodesByConnectivity.offline, tone: "critical" },
                ]}
              />
            )}
          </AsyncSection>
        </Card>

        <Card>
          <h2>Top Courses</h2>
          <p className="page-header__description">Courses ranked by total reservations.</p>
          <AsyncSection
            loading={topCourses.loading}
            error={topCourses.error}
            onRetry={topCourses.reload}
            isEmpty={topCourseBars.length === 0}
            emptyState={<EmptyState title="No course bookings yet" />}
            skeleton={<Skeleton height="10rem" />}
          >
            <BarChart data={topCourseBars} color={CHART_COLORS.violet} ariaLabel="Top courses by reservation count" />
          </AsyncSection>
        </Card>
      </div>
    </div>
  );
}
