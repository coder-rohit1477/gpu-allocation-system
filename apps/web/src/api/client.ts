import { GpuPlatformClient } from "@gpu/sdk";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/** Single shared client instance — cookie-based auth means there is no
 * per-user token to thread through, so one instance for the whole app is fine. */
export const apiClient = new GpuPlatformClient({ baseUrl: apiUrl });

export { ApiError } from "@gpu/sdk";
