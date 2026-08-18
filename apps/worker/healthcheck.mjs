// Used as this image's Docker HEALTHCHECK — see apps/worker/Dockerfile. The
// worker has no HTTP server, so "healthy" is defined as "can still reach
// Redis" (the one dependency it has) rather than a port check.
import { Redis } from "ioredis";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
  lazyConnect: true,
});

try {
  await connection.connect();
  await connection.ping();
  connection.disconnect();
  process.exit(0);
} catch {
  connection.disconnect();
  process.exit(1);
}
