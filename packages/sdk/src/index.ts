import type {
  ApiResult,
  Course,
  CourseAnalyticsRow,
  CreateReservationInput,
  DailyReportQuery,
  Department,
  DepartmentAnalyticsRow,
  GpuNode,
  GpuNodeAvailability,
  GpuNodeAvailabilityQuery,
  GpuUtilizationQuery,
  GpuUtilizationRow,
  HealthCheckResult,
  Laboratory,
  LaboratoryCalendar,
  LaboratoryCalendarQuery,
  ListCoursesQuery,
  ListDepartmentsQuery,
  ListGpuNodesQuery,
  ListLaboratoriesQuery,
  ListMyReservationsQuery,
  LoginInput,
  MonthlyReportQuery,
  Organization,
  PaginatedResult,
  PublicUser,
  Report,
  Reservation,
  StudentsAnalytics,
  TopCoursesQuery,
  UniversityAnalytics,
  WeeklyReportQuery,
} from "@gpu/types";

export interface GpuPlatformClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/** Thrown for any non-2xx or `{ ok: false }` API response. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type QueryValue = string | number | boolean | undefined;

/**
 * Accepts `object` rather than `Record<string, QueryValue>` so every DTO
 * query type (ListGpuNodesQuery, GpuNodeAvailabilityQuery, ...) can be
 * passed as-is — TypeScript won't structurally assign a named interface to
 * an indexed `Record` type without an explicit index signature, even when
 * every field is already a primitive. The cast below is the one place that
 * assumption is made, instead of at every call site.
 */
function toQueryString(params?: object): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, QueryValue>)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Typed client for the GPU Resource Management Platform API. Every method
 * consumes an endpoint that already exists (Phases 2-7) — this file adds no
 * new server behavior, only a typed wrapper the frontend can call.
 *
 * Auth is cookie-based (httpOnly access/refresh cookies set by the API), so
 * every request is sent with `credentials: "include"` rather than an
 * Authorization header.
 */
export class GpuPlatformClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GpuPlatformClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    // Bind to globalThis: browsers' native `fetch` throws "Illegal
    // invocation" if called with any other `this` (e.g. as `this.fetchImpl(...)`
    // on a class instance) — Node's fetch doesn't enforce this, so the bug
    // only surfaces at runtime in an actual browser, not in unit tests.
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  private async request<T>(
    path: string,
    init: RequestInit & { query?: object } = {},
  ): Promise<T> {
    const { query, headers, body, ...rest } = init;
    const response = await this.fetchImpl(`${this.baseUrl}${path}${toQueryString(query)}`, {
      ...rest,
      body,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
    });

    // Handful of endpoints (e.g. GET /health) don't use the {ok, data}
    // envelope; only parse it when the content-type says JSON.
    const contentType = response.headers.get("content-type") ?? "";
    const payload: unknown = contentType.includes("application/json")
      ? await response.json()
      : undefined;

    if (payload && typeof payload === "object" && "ok" in payload) {
      const result = payload as ApiResult<T>;
      if (!result.ok) {
        throw new ApiError(result.error.code, result.error.message, response.status);
      }
      return result.data;
    }

    if (!response.ok) {
      throw new ApiError("UNKNOWN_ERROR", `Request failed with status ${response.status}`, response.status);
    }
    return payload as T;
  }

  async getHealth(): Promise<HealthCheckResult> {
    return this.request<HealthCheckResult>("/health");
  }

  readonly auth = {
    login: (input: LoginInput): Promise<{ user: PublicUser }> =>
      this.request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(input) }),
    me: (): Promise<{ user: PublicUser }> => this.request("/api/v1/auth/me"),
    logout: (): Promise<{ loggedOut: true }> => this.request("/api/v1/auth/logout", { method: "POST" }),
  };

  readonly organizations = {
    list: (): Promise<PaginatedResult<Organization>> => this.request("/api/v1/organizations"),
  };

  readonly departments = {
    list: (query?: ListDepartmentsQuery): Promise<PaginatedResult<Department>> =>
      this.request("/api/v1/departments", { query }),
  };

  readonly laboratories = {
    list: (query?: ListLaboratoriesQuery): Promise<PaginatedResult<Laboratory>> =>
      this.request("/api/v1/laboratories", { query }),
    calendar: (laboratoryId: string, query?: LaboratoryCalendarQuery): Promise<LaboratoryCalendar> =>
      this.request(`/api/v1/laboratories/${laboratoryId}/calendar`, { query }),
  };

  readonly courses = {
    list: (query?: ListCoursesQuery): Promise<PaginatedResult<Course>> =>
      this.request("/api/v1/courses", { query }),
  };

  readonly gpuNodes = {
    list: (query?: ListGpuNodesQuery): Promise<PaginatedResult<GpuNode>> =>
      this.request("/api/v1/gpu-nodes", { query }),
    availability: (query?: GpuNodeAvailabilityQuery): Promise<{ items: GpuNodeAvailability[] }> =>
      this.request("/api/v1/gpu-nodes/availability", { query }),
  };

  readonly reservations = {
    listMine: (query?: ListMyReservationsQuery): Promise<PaginatedResult<Reservation>> =>
      this.request("/api/v1/reservations/me", { query }),
    create: (input: CreateReservationInput): Promise<Reservation> =>
      this.request("/api/v1/reservations", { method: "POST", body: JSON.stringify(input) }),
    cancel: (id: string): Promise<Reservation> =>
      this.request(`/api/v1/reservations/${id}`, { method: "DELETE" }),
  };

  readonly analytics = {
    university: (): Promise<UniversityAnalytics> => this.request("/api/v1/analytics/university"),
    departments: (): Promise<{ items: DepartmentAnalyticsRow[] }> =>
      this.request("/api/v1/analytics/departments"),
    gpuUtilization: (query?: GpuUtilizationQuery): Promise<{ items: GpuUtilizationRow[] }> =>
      this.request("/api/v1/analytics/gpu-utilization", { query }),
    students: (): Promise<StudentsAnalytics> => this.request("/api/v1/analytics/students"),
    courses: (query?: TopCoursesQuery): Promise<{ items: CourseAnalyticsRow[] }> =>
      this.request("/api/v1/analytics/courses", { query }),
  };

  readonly reports = {
    daily: (query?: DailyReportQuery): Promise<Report> => this.request("/api/v1/reports/daily", { query }),
    weekly: (query?: WeeklyReportQuery): Promise<Report> =>
      this.request("/api/v1/reports/weekly", { query }),
    monthly: (query?: MonthlyReportQuery): Promise<Report> =>
      this.request("/api/v1/reports/monthly", { query }),
  };
}
