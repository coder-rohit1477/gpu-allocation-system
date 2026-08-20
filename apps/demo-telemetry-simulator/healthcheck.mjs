// Used as this image's Docker HEALTHCHECK — see Dockerfile. The simulator
// has no HTTP server of its own, so "healthy" is defined as "has this
// process written a fresh timestamp after successfully sending telemetry
// recently" — see src/index.ts's runRound(). A stale/missing file means
// every send has been failing (e.g. wrong token, API unreachable), which
// is exactly what an operator running the demo would want surfaced.
import { stat } from "node:fs/promises";

const healthFilePath = process.env.DEMO_SIMULATOR_HEALTH_FILE ?? "/tmp/demo-telemetry-simulator-alive";
const intervalMs = Number.parseInt(process.env.DEMO_SIMULATOR_HEARTBEAT_INTERVAL_MS ?? "10000", 10);
const maxAgeMs = Math.max(intervalMs * 3, 60_000);

try {
  const stats = await stat(healthFilePath);
  const ageMs = Date.now() - stats.mtimeMs;
  process.exit(ageMs <= maxAgeMs ? 0 : 1);
} catch {
  process.exit(1);
}
