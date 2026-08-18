import { useState } from "react";
import { Button, Card, EmptyState, Skeleton } from "@gpu/ui";
import type { Laboratory, LaboratoryCalendar } from "@gpu/types";
import { apiClient } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";
import { useApi } from "../hooks/useApi.js";
import { AsyncSection } from "../components/AsyncSection.js";
import { PageHeader } from "../components/PageHeader.js";
import { formatTime } from "../lib/format.js";
import { addDays, formatWeekRange, isSameDay, startOfWeek, weekDays } from "../lib/week.js";

const STATUS_CLASS: Record<string, string> = {
  PENDING: "calendar-block--pending",
  APPROVED: "calendar-block--approved",
  ACTIVE: "calendar-block--active",
  COMPLETED: "calendar-block--completed",
  REJECTED: "calendar-block--rejected",
  CANCELLED: "calendar-block--cancelled",
};

interface LabWithCalendar {
  lab: Laboratory;
  calendar: LaboratoryCalendar;
}

export function WeeklyCalendarPage() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [scope, setScope] = useState<"mine" | "all">("mine");

  const departmentId = scope === "mine" ? (user?.departmentId ?? undefined) : undefined;

  const laboratories = useApi(
    () => apiClient.laboratories.list({ departmentId, pageSize: 50 }),
    [departmentId],
  );

  const weekEnd = addDays(weekStart, 7);
  const labs = laboratories.data?.items ?? [];
  const labsKey = labs.map((l) => l.id).join(",");

  const calendars = useApi<LabWithCalendar[]>(
    () =>
      Promise.all(
        labs.map(async (lab) => ({
          lab,
          calendar: await apiClient.laboratories.calendar(lab.id, {
            from: weekStart.toISOString(),
            to: weekEnd.toISOString(),
          }),
        })),
      ),
    [labsKey, weekStart.toISOString()],
  );

  const days = weekDays(weekStart);

  return (
    <div className="page">
      <PageHeader
        title="Weekly Calendar"
        description="Reservations across your department's laboratories, grouped by lab."
      />

      <Card className="filter-bar">
        <div className="week-nav">
          <Button variant="secondary" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Previous week">
            ← Prev
          </Button>
          <span className="week-nav__range">{formatWeekRange(weekStart)}</span>
          <Button variant="secondary" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Next week">
            Next →
          </Button>
          <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            This week
          </Button>
        </div>

        <label className="form__field form__field--inline">
          <span>Scope</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as "mine" | "all")}>
            <option value="mine">My department</option>
            <option value="all">All departments</option>
          </select>
        </label>
      </Card>

      <AsyncSection
        loading={laboratories.loading || calendars.loading}
        error={laboratories.error ?? calendars.error}
        onRetry={() => {
          laboratories.reload();
          calendars.reload();
        }}
        isEmpty={labs.length === 0}
        emptyState={<EmptyState title="No laboratories to show" description="There are no laboratories in this scope." />}
        skeleton={
          <Card>
            <Skeleton height="12rem" />
          </Card>
        }
      >
        <div className="calendar-week-header">
          {days.map(({ date, label }) => (
            <div key={label} className={`calendar-week-header__day${isSameDay(date, new Date()) ? " calendar-week-header__day--today" : ""}`}>
              <span>{label}</span>
              <span className="calendar-week-header__date">{date.getDate()}</span>
            </div>
          ))}
        </div>

        {calendars.data?.map(({ lab, calendar }) => (
          <Card key={lab.id} className="calendar-lab">
            <h2>{lab.name}</h2>
            <div className="calendar-grid">
              {days.map(({ date, label }) => {
                const dayReservations = calendar.reservations.filter((r) => isSameDay(new Date(r.startTime), date));
                return (
                  <div key={label} className="calendar-grid__day">
                    {dayReservations.length === 0 ? (
                      <p className="calendar-grid__empty">—</p>
                    ) : (
                      dayReservations.map((r) => (
                        <div
                          key={r.id}
                          className={`calendar-block ${STATUS_CLASS[r.status] ?? ""}${r.userId === user?.id ? " calendar-block--mine" : ""}`}
                          title={`${r.status} · ${formatTime(r.startTime)}–${formatTime(r.endTime)}`}
                        >
                          <span>
                            {formatTime(r.startTime)}–{formatTime(r.endTime)}
                          </span>
                          {r.userId === user?.id && <span className="calendar-block__mine-tag">You</span>}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </AsyncSection>
    </div>
  );
}
