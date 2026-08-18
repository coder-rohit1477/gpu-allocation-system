import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (env.nodeEnv === "production" ? "info" : "debug"),
  base: { service: "worker", env: env.nodeEnv },
});
