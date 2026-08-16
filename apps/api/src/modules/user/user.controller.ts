import type { Request, Response } from "express";
import { ok, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import * as userService from "./user.service.js";
import {
  assignUserDepartmentSchema,
  assignUserRoleSchema,
  changeUserStatusSchema,
  createUserSchema,
  listUsersQuerySchema,
  updateUserProfileSchema,
} from "./user.dto.js";

export async function listUsersHandler(req: Request, res: Response): Promise<void> {
  const query = listUsersQuerySchema.parse(req.query);
  const result = await userService.listUsers(prisma, query);
  ok(res, result);
}

export async function getUserHandler(req: Request, res: Response): Promise<void> {
  const user = await userService.getUser(prisma, requireParam(req, "id"));
  ok(res, user);
}

export async function createUserHandler(req: Request, res: Response): Promise<void> {
  const input = createUserSchema.parse(req.body);
  const { user, temporaryPassword } = await userService.createUser(
    prisma,
    req.user!.id,
    req.user!.role,
    input,
  );
  ok(res, { user, temporaryPassword }, 201);
}

export async function updateUserProfileHandler(req: Request, res: Response): Promise<void> {
  const input = updateUserProfileSchema.parse(req.body);
  const user = await userService.updateUserProfile(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, user);
}

export async function changeUserStatusHandler(req: Request, res: Response): Promise<void> {
  const input = changeUserStatusSchema.parse(req.body);
  const user = await userService.changeUserStatus(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, user);
}

export async function assignUserDepartmentHandler(req: Request, res: Response): Promise<void> {
  const input = assignUserDepartmentSchema.parse(req.body);
  const user = await userService.assignUserDepartment(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, user);
}

export async function assignUserRoleHandler(req: Request, res: Response): Promise<void> {
  const input = assignUserRoleSchema.parse(req.body);
  const user = await userService.assignUserRole(
    prisma,
    req.user!.id,
    req.user!.role,
    requireParam(req, "id"),
    input,
  );
  ok(res, user);
}
