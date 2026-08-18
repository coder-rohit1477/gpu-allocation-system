import { Router, type Router as ExpressRouter } from "express";
import type { HealthCheckResult } from "@gpu/types";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

const router: ExpressRouter = Router();
const startedAt = Date.now();

router.get("/health", (_req, res) => {
  const body: HealthCheckResult = {
    service: "api",
    status: "ok",
    version: process.env.npm_package_version ?? "0.1.0",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});

// Liveness — "is the process alive and able to answer at all", no
// dependency checks. An orchestrator restarts the container when this
// fails; it should never fail just because Postgres/Redis had a blip
// (that's what /ready is for — see below).
router.get("/live", (_req, res) => {
  res.json({ alive: true });
});

// Readiness — "can this instance actually serve traffic right now". An
// orchestrator/load-balancer pulls the instance out of rotation (without
// restarting it) while this fails, and adds it back once both dependencies
// recover. Checked independently so the response says exactly which
// dependency is the problem, not just "something's down".
router.get("/ready", async (_req, res) => {
  const [database, cache] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);

  const ready = database.status === "fulfilled" && cache.status === "fulfilled";

  res.status(ready ? 200 : 503).json({
    ready,
    database: database.status === "fulfilled" ? "connected" : "unreachable",
    cache: cache.status === "fulfilled" ? "connected" : "unreachable",
    ...(database.status === "rejected" && {
      databaseError: database.reason instanceof Error ? database.reason.message : "unknown error",
    }),
    ...(cache.status === "rejected" && {
      cacheError: cache.reason instanceof Error ? cache.reason.message : "unknown error",
    }),
  });
});

export default router;
