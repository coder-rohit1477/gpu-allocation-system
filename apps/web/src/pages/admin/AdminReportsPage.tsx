import { useMemo, useState } from "react";
import { Button, Card, EmptyState, Skeleton, Tabs, TrendChart } from "@gpu/ui";
import type { Report, ReportGranularity } from "@gpu/types";
import { apiClient } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { AsyncSection } from "../../components/AsyncSection.js";
import { PageHeader } from "../../components/PageHeader.js";
import { ReservationStatusBadge } from "../../components/StatusBadge.js";
import { CHART_COLORS } from "../../lib/chartColors.js";
import { downloadCsv } from "../../lib/exportCsv.js";
import { formatDate, formatHours } from "../../lib/format.js";

const GRANULARITIES: { value: ReportGranularity; label: string; defaultCount: number; countLabel: string }[] = [
  { value: "daily", label: "Daily", defaultCount: 14, countLabel: "Days" },
  { value: "weekly", label: "Weekly", defaultCount: 8, countLabel: "Weeks" },
  { value: "monthly", label: "Monthly", defaultCount: 6, countLabel: "Months" },
];

const STATUS_ORDER = ["PENDING", "APPROVED", "ACTIVE", "COMPLETED", "REJECTED", "CANCELLED"] as const;

function exportReportCsv(report: Report): void {
  const headers = [
    "Period start",
    "Period end",
    "Reservations created",
    "Compute hours",
    ...STATUS_ORDER.map((s) => `Status: ${s}`),
  ];
  const rows = report.buckets.map((bucket) => [
    bucket.periodStart,
    bucket.periodEnd,
    String(bucket.reservationsCreated),
    String(bucket.totalComputeHours),
    ...STATUS_ORDER.map((s) => String(bucket.reservationsByStatus[s])),
  ]);
  downloadCsv(`${report.granularity}-report.csv`, headers, rows);
}

export function AdminReportsPage() {
  const [granularity, setGranularity] = useState<ReportGranularity>("daily");
  const active = GRANULARITIES.find((g) => g.value === granularity)!;
  const [count, setCount] = useState(active.defaultCount);

  const report = useApi(() => {
    if (granularity === "daily") return apiClient.reports.daily({ days: count });
    if (granularity === "weekly") return apiClient.reports.weekly({ weeks: count });
    return apiClient.reports.monthly({ months: count });
  }, [granularity, count]);

  const trendPoints = useMemo(
    () => (report.data?.buckets ?? []).map((b) => ({ label: formatDate(b.periodStart), value: b.reservationsCreated })),
    [report.data],
  );

  function handleGranularityChange(value: string) {
    const next = GRANULARITIES.find((g) => g.value === value) ?? GRANULARITIES[0]!;
    setGranularity(next.value);
    setCount(next.defaultCount);
  }

  return (
    <div className="page">
      <PageHeader
        title="Reports"
        description="Time-bucketed reservation and compute-hour rollups."
        actions={
          <Button variant="secondary" onClick={() => report.data && exportReportCsv(report.data)} disabled={!report.data}>
            Export CSV
          </Button>
        }
      />

      <Card className="filter-bar">
        <Tabs
          items={GRANULARITIES.map((g) => ({ value: g.value, label: g.label }))}
          value={granularity}
          onChange={handleGranularityChange}
          aria-label="Report granularity"
        />
        <label className="form__field form__field--inline">
          <span>{active.countLabel}</span>
          <input
            type="number"
            min={1}
            max={90}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </Card>

      <AsyncSection
        loading={report.loading}
        error={report.error}
        onRetry={report.reload}
        isEmpty={report.data?.buckets.length === 0}
        emptyState={<EmptyState title="No data in this range" />}
        skeleton={
          <Card>
            <Skeleton height="12rem" />
          </Card>
        }
      >
        <Card>
          <TrendChart data={trendPoints} color={CHART_COLORS.blue} ariaLabel="Reservations created per period" />
        </Card>

        <Card className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">{active.label} report</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Created</th>
                <th scope="col">Compute hours</th>
                <th scope="col">By status</th>
              </tr>
            </thead>
            <tbody>
              {report.data?.buckets.map((bucket) => (
                <tr key={bucket.periodStart}>
                  <td>{formatDate(bucket.periodStart)}</td>
                  <td>{bucket.reservationsCreated}</td>
                  <td>{formatHours(bucket.totalComputeHours)}</td>
                  <td>
                    <div className="report-status-cell">
                      {STATUS_ORDER.filter((s) => bucket.reservationsByStatus[s] > 0).map((s) => (
                        <span key={s} className="report-status-cell__item">
                          <ReservationStatusBadge status={s} /> {bucket.reservationsByStatus[s]}
                        </span>
                      ))}
                    </div>
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
