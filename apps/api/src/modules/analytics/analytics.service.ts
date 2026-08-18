import type { ReservationStatus } from "@prisma/client";
import * as analyticsRepository from "./analytics.repository.js";
import type { AnalyticsDb } from "./analytics.repository.js";
import { dailyBuckets, monthlyBuckets, parseYearMonth, weeklyBuckets } from "./reportBuckets.js";
import type { DateRange } from "./reportBuckets.js";
import type {
  DailyReportQuery,
  GpuUtilizationQuery,
  MonthlyReportQuery,
  TopCoursesQuery,
  WeeklyReportQuery,
} from "./analytics.dto.js";
import { badRequestError } from "../../common/errors.js";

export type AnalyticsServiceDb = AnalyticsDb;

// ---------------------------------------------------------------------------
// GET /analytics/university
// ---------------------------------------------------------------------------

export interface UniversityAnalytics {
  totals: {
    organizations: number;
    departments: number;
    laboratories: number;
    gpuNodes: number;
    users: number;
    students: number;
    faculty: number;
    courses: number;
  };
  gpuNodesByConnectivity: { online: number; degraded: number; offline: number };
  reservationsByStatus: Record<ReservationStatus, number>;
  totalComputeHours: number;
  generatedAt: string;
}

export async function getUniversityAnalytics(
  db: AnalyticsServiceDb,
  now: Date = new Date(),
): Promise<UniversityAnalytics> {
  const [totals, connectivity, reservationsByStatus, totalComputeHours] = await Promise.all([
    analyticsRepository.getInstitutionCounts(db),
    analyticsRepository.listNodeConnectivity(db, {}, now),
    analyticsRepository.getReservationStatusBreakdown(db),
    analyticsRepository.getTotalComputeHours(db),
  ]);

  const gpuNodesByConnectivity = { online: 0, degraded: 0, offline: 0 };
  for (const row of connectivity) {
    if (row.connectivityStatus === "ONLINE") gpuNodesByConnectivity.online++;
    else if (row.connectivityStatus === "DEGRADED") gpuNodesByConnectivity.degraded++;
    else gpuNodesByConnectivity.offline++;
  }

  return {
    totals,
    gpuNodesByConnectivity,
    reservationsByStatus,
    totalComputeHours,
    generatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET /analytics/departments
// ---------------------------------------------------------------------------

export interface DepartmentAnalyticsRow {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  laboratories: number;
  gpuNodes: number;
  students: number;
  faculty: number;
  totalReservations: number;
  totalComputeHours: number;
  /** Percent of the department's GPU nodes currently backing an ACTIVE reservation. */
  utilizationPercent: number;
}

export async function listDepartmentAnalytics(db: AnalyticsServiceDb): Promise<DepartmentAnalyticsRow[]> {
  const departments = await analyticsRepository.listDepartmentsWithLabCounts(db);

  return Promise.all(
    departments.map(async (dept): Promise<DepartmentAnalyticsRow> => {
      const [students, faculty, totalReservations, totalComputeHours, activeReservations] = await Promise.all([
        analyticsRepository.countUsersInDepartment(db, dept.id, "STUDENT"),
        analyticsRepository.countUsersInDepartment(db, dept.id, "FACULTY"),
        analyticsRepository.countReservationsInDepartment(db, dept.id),
        analyticsRepository.getTotalComputeHours(db, { departmentId: dept.id }),
        analyticsRepository.countActiveReservationsInDepartment(db, dept.id),
      ]);

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        departmentCode: dept.code,
        laboratories: dept.laboratoryCount,
        gpuNodes: dept.gpuNodeCount,
        students,
        faculty,
        totalReservations,
        totalComputeHours,
        utilizationPercent:
          dept.gpuNodeCount === 0 ? 0 : Math.round((activeReservations / dept.gpuNodeCount) * 100),
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// GET /analytics/gpu-utilization
// ---------------------------------------------------------------------------

export interface GpuUtilizationRow {
  gpuNodeId: string;
  hostname: string;
  gpuModel: string;
  laboratoryId: string;
  connectivityStatus: "ONLINE" | "DEGRADED" | "OFFLINE";
  currentUtilizationPercent: number | null;
  avgUtilizationPercent7d: number | null;
}

export async function getGpuUtilization(
  db: AnalyticsServiceDb,
  query: GpuUtilizationQuery,
  now: Date = new Date(),
): Promise<GpuUtilizationRow[]> {
  const connectivityRows = await analyticsRepository.listNodeConnectivity(
    db,
    { labId: query.labId, departmentId: query.departmentId },
    now,
  );
  const nodeIds = connectivityRows.map((row) => row.node.id);

  const [snapshots, weeklyAverages] = await Promise.all([
    db.gpuHealthSnapshot.findMany({ where: { gpuNodeId: { in: nodeIds } } }),
    nodeIds.length === 0
      ? Promise.resolve([])
      : db.gpuMetric.groupBy({
          by: ["gpuNodeId"],
          where: { gpuNodeId: { in: nodeIds }, recordedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
          _avg: { gpuUtilization: true },
        }),
  ]);

  const snapshotByNode = new Map(snapshots.map((s) => [s.gpuNodeId, s]));
  const weeklyAvgByNode = new Map(weeklyAverages.map((row) => [row.gpuNodeId, row._avg.gpuUtilization]));

  return connectivityRows.map(({ node, connectivityStatus }) => ({
    gpuNodeId: node.id,
    hostname: node.hostname,
    gpuModel: node.gpuModel,
    laboratoryId: node.labId,
    connectivityStatus,
    currentUtilizationPercent: snapshotByNode.get(node.id)?.gpuUtilization ?? null,
    avgUtilizationPercent7d: weeklyAvgByNode.get(node.id) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// GET /analytics/students
// ---------------------------------------------------------------------------

export interface StudentsAnalytics {
  totalStudents: number;
  activeStudents: number;
  totalComputeHours: number;
  avgComputeHoursPerActiveStudent: number;
  byDepartment: {
    departmentId: string;
    departmentName: string;
    totalStudents: number;
    activeStudents: number;
  }[];
}

export async function getStudentsAnalytics(db: AnalyticsServiceDb): Promise<StudentsAnalytics> {
  // Compute hours are attributable to any reservation owner, not only
  // students (faculty may also book directly — see reservation.routes.ts's
  // BOOKING_ROLES) — this total re-derives from AllocationSession rows
  // joined back to a STUDENT-owned reservation, rather than reusing
  // analyticsRepository.getTotalComputeHours()'s institution-wide figure.
  const [departments, activeStudentIds, institutionCounts, studentComputeHours] = await Promise.all([
    analyticsRepository.listDepartmentsWithLabCounts(db),
    analyticsRepository.listStudentIdsWithReservations(db),
    analyticsRepository.getInstitutionCounts(db),
    db.allocationSession.aggregate({
      _sum: { computeHours: true },
      where: { reservation: { user: { role: "STUDENT" } } },
    }),
  ]);

  const byDepartment = await Promise.all(
    departments.map(async (dept) => {
      const [totalStudents, activeStudents] = await Promise.all([
        analyticsRepository.countUsersInDepartment(db, dept.id, "STUDENT"),
        db.user.count({
          where: { departmentId: dept.id, role: "STUDENT", id: { in: [...activeStudentIds] } },
        }),
      ]);
      return { departmentId: dept.id, departmentName: dept.name, totalStudents, activeStudents };
    }),
  );

  const activeCount = activeStudentIds.size;
  const studentHours = Number(studentComputeHours._sum.computeHours ?? 0);

  return {
    totalStudents: institutionCounts.students,
    activeStudents: activeCount,
    totalComputeHours: studentHours,
    avgComputeHoursPerActiveStudent: activeCount === 0 ? 0 : Math.round((studentHours / activeCount) * 100) / 100,
    byDepartment,
  };
}

// ---------------------------------------------------------------------------
// GET /analytics/courses
// ---------------------------------------------------------------------------

export interface CourseAnalyticsRow {
  courseId: string;
  courseCode: string;
  courseName: string;
  semester: string;
  totalReservations: number;
  activeReservations: number;
  totalComputeHours: number;
}

export async function listTopCourses(
  db: AnalyticsServiceDb,
  query: TopCoursesQuery,
): Promise<CourseAnalyticsRow[]> {
  const courses = await analyticsRepository.listCoursesForAnalytics(db);

  const rows = await Promise.all(
    courses.map(async (course): Promise<CourseAnalyticsRow> => {
      const stats = await analyticsRepository.getCourseReservationStats(db, course.id);
      return {
        courseId: course.id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        semester: course.semester,
        ...stats,
      };
    }),
  );

  return rows.sort((a, b) => b.totalReservations - a.totalReservations).slice(0, query.limit);
}

// ---------------------------------------------------------------------------
// GET /reports/daily | /weekly | /monthly
// ---------------------------------------------------------------------------

export interface ReportBucket {
  periodStart: string;
  periodEnd: string;
  reservationsCreated: number;
  reservationsByStatus: Record<ReservationStatus, number>;
  totalComputeHours: number;
}

export interface Report {
  granularity: "daily" | "weekly" | "monthly";
  buckets: ReportBucket[];
  generatedAt: string;
}

async function buildReport(
  db: AnalyticsServiceDb,
  granularity: Report["granularity"],
  ranges: DateRange[],
  now: Date,
): Promise<Report> {
  const buckets = await Promise.all(
    ranges.map(async (range): Promise<ReportBucket> => {
      const raw = await analyticsRepository.computeReportBucket(db, range);
      return {
        periodStart: range.start.toISOString(),
        periodEnd: range.end.toISOString(),
        ...raw,
      };
    }),
  );
  return { granularity, buckets, generatedAt: now.toISOString() };
}

export async function getDailyReport(
  db: AnalyticsServiceDb,
  query: DailyReportQuery,
  now: Date = new Date(),
): Promise<Report> {
  return buildReport(db, "daily", dailyBuckets(query.date ?? now, query.days), now);
}

export async function getWeeklyReport(
  db: AnalyticsServiceDb,
  query: WeeklyReportQuery,
  now: Date = new Date(),
): Promise<Report> {
  return buildReport(db, "weekly", weeklyBuckets(query.weekOf ?? now, query.weeks), now);
}

export async function getMonthlyReport(
  db: AnalyticsServiceDb,
  query: MonthlyReportQuery,
  now: Date = new Date(),
): Promise<Report> {
  let anchor = now;
  if (query.month) {
    const parsed = parseYearMonth(query.month);
    if (!parsed) throw badRequestError(`Invalid month "${query.month}" — expected YYYY-MM`);
    anchor = parsed;
  }
  return buildReport(db, "monthly", monthlyBuckets(anchor, query.months), now);
}
