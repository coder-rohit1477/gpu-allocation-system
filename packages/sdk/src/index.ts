import type { HealthCheckResult } from "@gpu/types";

export interface GpuPlatformClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/**
 * Minimal foundation client. Only exposes the platform health check for now;
 * domain-specific methods (auth, reservations, GPU inventory, ...) are added
 * as those API modules are implemented in later phases.
 */
export class GpuPlatformClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GpuPlatformClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getHealth(): Promise<HealthCheckResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    return (await response.json()) as HealthCheckResult;
  }
}
