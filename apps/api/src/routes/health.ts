import { Router, type Router as ExpressRouter } from "express";
import type { HealthCheckResult } from "@gpu/types";
import { prisma } from "../lib/prisma.js";

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

router.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ready: true, database: "connected" });
  } catch (error) {
    res.status(503).json({
      ready: false,
      database: "unreachable",
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
});

export default router;
