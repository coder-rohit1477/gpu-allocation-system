import { pinoHttp } from "pino-http";
import { logger } from "../lib/logger.js";

/**
 * Structured HTTP access logging (Phase 10 devops) — one JSON line per
 * request with method/path/status/duration/request-id. Purely an
 * observability layer: it reads nothing from and writes nothing into any
 * business-logic module.
 */
export const requestLogger = pinoHttp({
  logger,
  autoLogging: {
    // The Docker/orchestrator healthcheck hits these every few seconds —
    // logging each one would drown out everything else.
    ignore: (req) => req.url === "/health" || req.url === "/ready",
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
