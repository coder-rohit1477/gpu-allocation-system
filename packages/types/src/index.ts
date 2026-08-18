/**
 * Foundation-level shared types, plus (Phase 8) the domain types the Student
 * Portal needs to consume the Phase 2-7 APIs. These are hand-written mirrors
 * of each API's response/request shapes (the API itself is the source of
 * truth; nothing here changes backend behavior) — kept here rather than
 * duplicated per-consumer since both @gpu/sdk and apps/web need them.
 */

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type ServiceStatus = "ok" | "degraded" | "down";

export interface HealthCheckResult {
  service: string;
  status: ServiceStatus;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Enums (mirrors apps/api/prisma/schema.prisma)
// ---------------------------------------------------------------------------

export type UserRole = "SUPER_ADMIN" | "DEPARTMENT_ADMIN" | "LAB_ADMIN" | "FACULTY" | "STUDENT";
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type LabStatus = "ACTIVE" | "MAINTENANCE" | "INACTIVE";
export type GpuStatus = "AVAILABLE" | "BUSY" | "MAINTENANCE" | "OFFLINE";
export type ReservationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";
export type MaintenanceStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";
/** Derived heartbeat-recency status (Phase 5 telemetry), distinct from GpuStatus. */
export type ConnectivityStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Auth (Phase 3)
// ---------------------------------------------------------------------------

export interface PublicUser {
  id: string;
  universityId: string;
  fullName: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  status: UserStatus;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Organizational hierarchy (Phase 2/4)
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface Laboratory {
  id: string;
  departmentId: string;
  name: string;
  location: string;
  floor: string;
  status: LabStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  courseCode: string;
  courseName: string;
  semester: string;
  facultyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListCoursesQuery extends PaginationQuery {
  search?: string;
  facultyId?: string;
  semester?: string;
}

export interface ListLaboratoriesQuery extends PaginationQuery {
  search?: string;
  departmentId?: string;
  status?: LabStatus;
}

export interface ListDepartmentsQuery extends PaginationQuery {
  search?: string;
  organizationId?: string;
}

// ---------------------------------------------------------------------------
// GPU inventory (Phase 4)
// ---------------------------------------------------------------------------

export interface GpuNode {
  id: string;
  labId: string;
  hostname: string;
  gpuModel: string;
  gpuCount: number;
  totalMemoryGB: number;
  cpuCores: number;
  ramGB: number;
  status: GpuStatus;
  lastHeartbeat: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListGpuNodesQuery extends PaginationQuery {
  search?: string;
  labId?: string;
  status?: GpuStatus;
}

// ---------------------------------------------------------------------------
// Reservations / booking engine (Phase 6)
// ---------------------------------------------------------------------------

export interface Reservation {
  id: string;
  userId: string;
  gpuNodeId: string;
  courseId: string | null;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  purpose: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationInput {
  gpuNodeId?: string;
  labId?: string;
  courseId?: string;
  startTime: string;
  endTime: string;
  purpose: string;
  minGpuCount?: number;
  minMemoryGB?: number;
}

export interface ListMyReservationsQuery extends PaginationQuery {
  status?: ReservationStatus;
}

export interface GpuNodeAvailabilityQuery {
  labId?: string;
  startTime?: string;
  endTime?: string;
  minGpuCount?: number;
  minMemoryGB?: number;
}

export interface GpuNodeAvailability {
  gpuNodeId: string;
  hostname: string;
  labId: string;
  gpuModel: string;
  gpuCount: number;
  totalMemoryGB: number;
  connectivityStatus: ConnectivityStatus;
  available: boolean;
}

export interface LaboratoryCalendarQuery {
  from?: string;
  to?: string;
}

export interface LaboratoryCalendarReservation {
  id: string;
  gpuNodeId: string;
  userId: string;
  status: ReservationStatus;
  startTime: string;
  endTime: string;
}

export interface LaboratoryCalendarMaintenanceWindow {
  id: string;
  gpuNodeId: string;
  status: MaintenanceStatus;
  startTime: string;
  endTime: string;
}

export interface LaboratoryCalendar {
  laboratoryId: string;
  from: string;
  to: string;
  nodes: { id: string; hostname: string }[];
  reservations: LaboratoryCalendarReservation[];
  maintenanceWindows: LaboratoryCalendarMaintenanceWindow[];
}

// ---------------------------------------------------------------------------
// Analytics & reporting (Phase 9)
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
  utilizationPercent: number;
}

export interface GpuUtilizationQuery {
  departmentId?: string;
  labId?: string;
}

export interface GpuUtilizationRow {
  gpuNodeId: string;
  hostname: string;
  gpuModel: string;
  laboratoryId: string;
  connectivityStatus: ConnectivityStatus;
  currentUtilizationPercent: number | null;
  avgUtilizationPercent7d: number | null;
}

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

export interface TopCoursesQuery {
  limit?: number;
}

export interface CourseAnalyticsRow {
  courseId: string;
  courseCode: string;
  courseName: string;
  semester: string;
  totalReservations: number;
  activeReservations: number;
  totalComputeHours: number;
}

export type ReportGranularity = "daily" | "weekly" | "monthly";
export type ReportFormat = "json" | "csv";

export interface ReportBucket {
  periodStart: string;
  periodEnd: string;
  reservationsCreated: number;
  reservationsByStatus: Record<ReservationStatus, number>;
  totalComputeHours: number;
}

export interface Report {
  granularity: ReportGranularity;
  buckets: ReportBucket[];
  generatedAt: string;
}

export interface DailyReportQuery {
  date?: string;
  days?: number;
}

export interface WeeklyReportQuery {
  weekOf?: string;
  weeks?: number;
}

export interface MonthlyReportQuery {
  month?: string;
  months?: number;
}

// ---------------------------------------------------------------------------
// Faculty workflow (Phase 7)
// ---------------------------------------------------------------------------

/** Mirrors apps/api's priorityQueue.ts: derived from whether courseId is set,
 * not a stored column — a reservation tied to a course (scheduled coursework)
 * outranks a standalone research/personal booking in the approval queue. */
export type ReservationPriority = "COURSEWORK" | "RESEARCH";

export interface FacultyReservationSummary {
  id: string;
  userId: string;
  courseId: string | null;
  gpuNodeId: string;
  hostname: string;
  laboratoryId: string;
  laboratoryName: string;
  status: ReservationStatus;
  startTime: string;
  endTime: string;
  purpose: string;
  priority: ReservationPriority;
}

export interface FacultyDashboard {
  pendingApprovals: { total: number; items: FacultyReservationSummary[] };
  todaysSessions: FacultyReservationSummary[];
  activeGpuUsage: {
    activeReservations: number;
    totalNodes: number;
    activeNodes: number;
    utilizationPercent: number;
  };
  upcomingReservations: FacultyReservationSummary[];
}

export interface FacultyCourseSummary {
  id: string;
  courseCode: string;
  courseName: string;
  semester: string;
  pendingReservations: number;
  approvedReservations: number;
  activeReservations: number;
}

export interface WeeklyLabSchedule {
  weekStart: string;
  weekEnd: string;
  laboratories: {
    laboratoryId: string;
    laboratoryName: string;
    reservations: FacultyReservationSummary[];
  }[];
}

export interface FacultyWeeklyScheduleQuery {
  weekOf?: string;
}

export type ListPendingReservationsQuery = PaginationQuery;

export interface BulkApproveReservationsInput {
  reservationIds: string[];
}

export interface BulkRejectReservationsInput {
  reservationIds: string[];
  reason?: string;
}
