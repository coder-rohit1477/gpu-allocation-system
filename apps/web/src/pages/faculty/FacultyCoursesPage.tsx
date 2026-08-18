import { useMemo, useState } from "react";
import { Card, EmptyState, Skeleton } from "@gpu/ui";
import { apiClient } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { AsyncSection } from "../../components/AsyncSection.js";
import { PageHeader } from "../../components/PageHeader.js";

function CourseCardSkeleton() {
  return (
    <div className="gpu-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i}>
          <Skeleton height="1.25rem" width="60%" />
          <Skeleton height="1rem" width="40%" />
          <Skeleton height="1rem" width="80%" />
        </Card>
      ))}
    </div>
  );
}

/**
 * No `search` param exists on GET /api/v1/faculty/courses (see
 * faculty.dto.ts's listFacultyCoursesQuerySchema — pagination only), so
 * filtering happens client-side against the already-fetched page, same
 * approach MyReservationsPage.tsx takes for its status tabs.
 */
export function FacultyCoursesPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);

  const courses = useApi(() => apiClient.faculty.courses({ pageSize: 100 }), []);

  const filtered = useMemo(() => {
    const items = courses.data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (c) => c.courseCode.toLowerCase().includes(term) || c.courseName.toLowerCase().includes(term),
    );
  }, [courses.data, search]);

  return (
    <div className="page">
      <PageHeader title="My Courses" description="Your courses and how their reservations are progressing." />

      <Card className="filter-bar">
        <label className="form__field form__field--inline">
          <span>Search</span>
          <input
            type="search"
            placeholder="Course code or name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
      </Card>

      <AsyncSection
        loading={courses.loading}
        error={courses.error}
        onRetry={courses.reload}
        isEmpty={filtered.length === 0}
        emptyState={
          <EmptyState
            title={courses.data?.items.length ? "No courses match your search" : "No courses assigned"}
            description={
              courses.data?.items.length
                ? "Try a different search term."
                : "You don't have any courses assigned yet."
            }
          />
        }
        skeleton={<CourseCardSkeleton />}
      >
        <div className="gpu-grid">
          {filtered.map((course) => (
            <Card key={course.id} className="gpu-card">
              <div className="gpu-card__header">
                <h3>{course.courseCode}</h3>
              </div>
              <p className="gpu-card__model">{course.courseName}</p>
              <p className="stacked-list__meta">{course.semester}</p>
              <dl className="gpu-card__specs">
                <div>
                  <dt>Pending</dt>
                  <dd>{course.pendingReservations}</dd>
                </div>
                <div>
                  <dt>Approved</dt>
                  <dd>{course.approvedReservations}</dd>
                </div>
                <div>
                  <dt>Active</dt>
                  <dd>{course.activeReservations}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      </AsyncSection>
    </div>
  );
}
