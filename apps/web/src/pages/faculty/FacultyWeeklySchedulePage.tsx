import { useState } from "react";
import { Badge, Button, Card, EmptyState, Skeleton } from "@gpu/ui";
import { apiClient } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { AsyncSection } from "../../components/AsyncSection.js";
import { PageHeader } from "../../components/PageHeader.js";
import { ReservationStatusBadge } from "../../components/StatusBadge.js";
import { formatTime } from "../../lib/format.js";
import { addDays, formatWeekRange, isSameDay, startOfWeek, weekDays } from "../../lib/week.js";

const STATUS_CLASS: Record<string, string> = {
  PENDING: "calendar-block--pending",
  APPROVED: "calendar-block--approved",
  ACTIVE: "calendar-block--active",
  COMPLETED: "calendar-block--completed",
  REJECTED: "calendar-block--rejected",
  CANCELLED: "calendar-block--cancelled",
};

export function FacultyWeeklySchedulePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const schedule = useApi(
    () => apiClient.faculty.labSchedule({ weekOf: weekStart.toISOString() }),
    [weekStart.toISOString()],
  );

  const days = weekDays(weekStart);
  const laboratories = schedule.data?.laboratories ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Weekly Lab Schedule"
        description="This week's reservations across your department's laboratories, grouped by lab."
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
      </Card>

      <AsyncSection
        loading={schedule.loading}
        error={schedule.error}
        onRetry={schedule.reload}
        isEmpty={laboratories.length === 0}
        emptyState={
          <EmptyState
            title="No laboratories to show"
            description="Your department has no laboratories, or no reservations fall in this week."
          />
        }
        skeleton={
          <Card>
            <Skeleton height="12rem" />
          </Card>
        }
      >
        <div className="calendar-week-header">
          {days.map(({ date, label }) => (
            <div
              key={label}
              className={`calendar-week-header__day${isSameDay(date, new Date()) ? " calendar-week-header__day--today" : ""}`}
            >
              <span>{label}</span>
              <span className="calendar-week-header__date">{date.getDate()}</span>
            </div>
          ))}
        </div>

        {laboratories.map((lab) => (
          <Card key={lab.laboratoryId} className="calendar-lab">
            <h2>{lab.laboratoryName}</h2>
            <div className="calendar-grid">
              {days.map(({ date, label }) => {
                const dayReservations = lab.reservations.filter((r) => isSameDay(new Date(r.startTime), date));
                return (
                  <div key={label} className="calendar-grid__day">
                    {dayReservations.length === 0 ? (
                      <p className="calendar-grid__empty">—</p>
                    ) : (
                      dayReservations.map((r) => (
                        <div
                          key={r.id}
                          className={`calendar-block ${STATUS_CLASS[r.status] ?? ""}`}
                          title={`${r.purpose} · ${r.status} · ${formatTime(r.startTime)}–${formatTime(r.endTime)}`}
                        >
                          <span>
                            {formatTime(r.startTime)}–{formatTime(r.endTime)}
                          </span>
                          <span className="calendar-block__mine-tag">
                            {r.priority === "COURSEWORK" ? "Coursework" : "Research"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>

            {lab.reservations.length > 0 && (
              <details className="reservation-row__details">
                <summary>View this lab&apos;s reservations as a list</summary>
                <ul className="stacked-list">
                  {lab.reservations.map((r) => (
                    <li key={r.id}>
                      <div>
                        <p className="stacked-list__title">{r.purpose}</p>
                        <p className="stacked-list__meta">
                          {r.hostname} · {formatTime(r.startTime)}–{formatTime(r.endTime)}
                        </p>
                      </div>
                      <div className="reservation-row__actions">
                        <Badge tone={r.priority === "COURSEWORK" ? "info" : "neutral"}>
                          {r.priority === "COURSEWORK" ? "Coursework" : "Research"}
                        </Badge>
                        <ReservationStatusBadge status={r.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        ))}
      </AsyncSection>
    </div>
  );
}
