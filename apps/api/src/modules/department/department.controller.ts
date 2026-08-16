import type { Request, Response } from "express";
import { ok, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import * as departmentService from "./department.service.js";
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from "./department.dto.js";

export async function listDepartmentsHandler(req: Request, res: Response): Promise<void> {
  const query = listDepartmentsQuerySchema.parse(req.query);
  const result = await departmentService.listDepartments(prisma, query);
  ok(res, result);
}

export async function getDepartmentHandler(req: Request, res: Response): Promise<void> {
  const department = await departmentService.getDepartment(prisma, requireParam(req, "id"));
  ok(res, department);
}

export async function createDepartmentHandler(req: Request, res: Response): Promise<void> {
  const input = createDepartmentSchema.parse(req.body);
  const department = await departmentService.createDepartment(prisma, req.user!.id, input);
  ok(res, department, 201);
}

export async function updateDepartmentHandler(req: Request, res: Response): Promise<void> {
  const input = updateDepartmentSchema.parse(req.body);
  const department = await departmentService.updateDepartment(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, department);
}

export async function deleteDepartmentHandler(req: Request, res: Response): Promise<void> {
  await departmentService.deleteDepartment(prisma, req.user!.id, requireParam(req, "id"));
  ok(res, { deleted: true });
}
