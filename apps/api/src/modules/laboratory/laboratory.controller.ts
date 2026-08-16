import type { Request, Response } from "express";
import { ok, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import * as laboratoryService from "./laboratory.service.js";
import {
  createLaboratorySchema,
  listLaboratoriesQuerySchema,
  updateLaboratorySchema,
} from "./laboratory.dto.js";

export async function listLaboratoriesHandler(req: Request, res: Response): Promise<void> {
  const query = listLaboratoriesQuerySchema.parse(req.query);
  const result = await laboratoryService.listLaboratories(prisma, query);
  ok(res, result);
}

export async function getLaboratoryHandler(req: Request, res: Response): Promise<void> {
  const laboratory = await laboratoryService.getLaboratory(prisma, requireParam(req, "id"));
  ok(res, laboratory);
}

export async function createLaboratoryHandler(req: Request, res: Response): Promise<void> {
  const input = createLaboratorySchema.parse(req.body);
  const laboratory = await laboratoryService.createLaboratory(prisma, req.user!.id, input);
  ok(res, laboratory, 201);
}

export async function updateLaboratoryHandler(req: Request, res: Response): Promise<void> {
  const input = updateLaboratorySchema.parse(req.body);
  const laboratory = await laboratoryService.updateLaboratory(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, laboratory);
}

export async function deleteLaboratoryHandler(req: Request, res: Response): Promise<void> {
  await laboratoryService.deleteLaboratory(prisma, req.user!.id, requireParam(req, "id"));
  ok(res, { deleted: true });
}
