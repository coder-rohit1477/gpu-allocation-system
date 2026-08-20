import pino from "pino";
import { env } from "../config/env.js";

// `demo: true` on every line, plus the "DEMO-TELEMETRY" service name, so
// this is unmistakable in aggregated logs as synthetic data — never to be
// confused with a real GPU node-agent's telemetry.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (env.nodeEnv === "production" ? "info" : "debug"),
  base: { service: "DEMO-TELEMETRY-SIMULATOR", demo: true, env: env.nodeEnv },
});
