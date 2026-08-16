import type { Request, Response } from "express";
import { ok, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import * as gpuNodeService from "./gpuNode.service.js";
import {
  changeGpuNodeStatusSchema,
  createGpuNodeSchema,
  listGpuNodesQuerySchema,
  updateGpuNodeHeartbeatSchema,
  updateGpuNodeSchema,
} from "./gpuNode.dto.js";

export async function listGpuNodesHandler(req: Request, res: Response): Promise<void> {
  const query = listGpuNodesQuerySchema.parse(req.query);
  const result = await gpuNodeService.listGpuNodes(prisma, query);
  ok(res, result);
}

export async function getGpuNodeHandler(req: Request, res: Response): Promise<void> {
  const node = await gpuNodeService.getGpuNode(prisma, requireParam(req, "id"));
  ok(res, node);
}

export async function createGpuNodeHandler(req: Request, res: Response): Promise<void> {
  const input = createGpuNodeSchema.parse(req.body);
  const node = await gpuNodeService.createGpuNode(prisma, req.user!.id, input);
  ok(res, node, 201);
}

export async function updateGpuNodeHandler(req: Request, res: Response): Promise<void> {
  const input = updateGpuNodeSchema.parse(req.body);
  const node = await gpuNodeService.updateGpuNode(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, node);
}

export async function changeGpuNodeStatusHandler(req: Request, res: Response): Promise<void> {
  const input = changeGpuNodeStatusSchema.parse(req.body);
  const node = await gpuNodeService.changeGpuNodeStatus(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, node);
}

export async function updateGpuNodeHeartbeatHandler(req: Request, res: Response): Promise<void> {
  const input = updateGpuNodeHeartbeatSchema.parse(req.body);
  const node = await gpuNodeService.updateGpuNodeHeartbeat(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, node);
}

export async function deleteGpuNodeHandler(req: Request, res: Response): Promise<void> {
  await gpuNodeService.deleteGpuNode(prisma, req.user!.id, requireParam(req, "id"));
  ok(res, { deleted: true });
}
