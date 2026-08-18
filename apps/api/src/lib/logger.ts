import pino from "pino";
import { env, isProduction } from "../config/env.js";

/**
 * Structured (JSON) logging for production/log-aggregator consumption;
 * human-readable in local dev. `LOG_LEVEL` is read directly from
 * `process.env` here rather than added to config/env.ts, so this file adds
 * a devops concern without touching the auth/telemetry-adjacent env module.
 */
export const logger = pino({
  // vitest sets NODE_ENV=test regardless of .env — silent by default there
  // so `pnpm test` output stays readable; still overridable via LOG_LEVEL.
  level: process.env.LOG_LEVEL ?? (env.nodeEnv === "test" ? "silent" : isProduction ? "info" : "debug"),
  base: { service: "api", env: env.nodeEnv },
  // Pretty-printed only for interactive local dev (`pnpm dev`) — CI/test
  // runs and production both want plain JSON lines, the former so a
  // worker-thread transport never has to spin up during a test run.
  transport:
    env.nodeEnv === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
      : undefined,
});
