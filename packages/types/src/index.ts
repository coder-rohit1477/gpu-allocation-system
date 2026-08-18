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
