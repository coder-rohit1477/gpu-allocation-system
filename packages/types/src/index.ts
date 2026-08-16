/**
 * Foundation-level shared types. Domain types (users, reservations, GPUs, etc.)
 * are intentionally out of scope for Phase 1 and will be added as those
 * modules are implemented.
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
