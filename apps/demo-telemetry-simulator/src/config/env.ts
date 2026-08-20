import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got "${raw}"`);
  }
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  // Same shared secret the real telemetry ingestion endpoints check
  // (apps/api/src/modules/telemetry/requireTelemetryToken.ts) — this
  // simulator authenticates exactly like a real node-agent would, no
  // special-cased bypass.
  telemetryToken: required("TELEMETRY_INGEST_TOKEN"),

  // Base URL of the API this simulator posts telemetry to. Defaults to the
  // Docker Compose service name on the internal network (see
  // docker-compose.demo.yml); override for `pnpm dev` against a locally
  // running API.
  apiBaseUrl: process.env.DEMO_SIMULATOR_API_BASE_URL ?? "http://api:4000",

  // How often each simulated node sends telemetry. Must stay comfortably
  // below TELEMETRY_ONLINE_THRESHOLD_SECONDS (default 30s) or the node
  // would flap between ONLINE/DEGRADED between rounds.
  heartbeatIntervalMs: intFromEnv("DEMO_SIMULATOR_HEARTBEAT_INTERVAL_MS", 10_000),

  // Node topology this simulator generates hostnames for — deliberately
  // mirrors apps/api/prisma/seed.ts's deterministic hostname derivation
  // (`${dept}-gpu-node-${NN}.muj.local`) instead of hardcoding the seeded
  // nodes' database UUIDs. A real node-agent only ever knows its own
  // hostname, not a directory of every other node, so recomputing the same
  // deterministic seeded hostnames — rather than calling an authenticated
  // discovery API this agent has no user session for — is the realistic
  // choice here, not a shortcut.
  departments: (process.env.DEMO_SIMULATOR_DEPARTMENTS ?? "cse,ai,ds")
    .split(",")
    .map((dept) => dept.trim().toLowerCase())
    .filter(Boolean),
  nodesPerDepartment: intFromEnv("DEMO_SIMULATOR_NODES_PER_DEPARTMENT", 4),
  hostnameSuffix: process.env.DEMO_SIMULATOR_HOSTNAME_SUFFIX ?? ".muj.local",

  // Where the healthcheck script looks for proof of a recent successful
  // send — see healthcheck.mjs.
  healthFilePath: process.env.DEMO_SIMULATOR_HEALTH_FILE ?? "/tmp/demo-telemetry-simulator-alive",
};
