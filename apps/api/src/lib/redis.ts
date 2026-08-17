import { Redis } from "ioredis";
import { env } from "../config/env.js";

declare global {
  var __redis: Redis | undefined;
}

export const redis =
  globalThis.__redis ?? new Redis(env.redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}

redis.on("error", (error: unknown) => {
  // Redis is used for best-effort pub/sub event publishing (see
  // modules/telemetry/publishGpuEvent.ts) — an outage must never block
  // telemetry ingestion, so we log and move on rather than crash.
  console.error("[redis] connection error", error);
});
