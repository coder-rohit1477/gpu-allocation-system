import type { Request, Response } from "express";
import { ok, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";
import * as telemetryService from "./telemetry.service.js";
import { listLiveGpuNodesQuerySchema, telemetryPayloadSchema } from "./telemetry.dto.js";

export async function heartbeatHandler(req: Request, res: Response): Promise<void> {
  const payload = telemetryPayloadSchema.parse(req.body);
  const result = await telemetryService.ingestTelemetry(prisma, redis, payload);
  ok(res, result);
}

export async function metricsHandler(req: Request, res: Response): Promise<void> {
  const payload = telemetryPayloadSchema.parse(req.body);
  const result = await telemetryService.ingestTelemetry(prisma, redis, payload);
  ok(res, result);
}

export async function listLiveGpuNodesHandler(req: Request, res: Response): Promise<void> {
  const query = listLiveGpuNodesQuerySchema.parse(req.query);
  const nodes = await telemetryService.listLiveNodes(prisma, { labId: query.labId });
  ok(res, { items: nodes });
}

export async function getGpuNodeHealthHandler(req: Request, res: Response): Promise<void> {
  const health = await telemetryService.getNodeHealth(prisma, requireParam(req, "id"));
  ok(res, health);
}
