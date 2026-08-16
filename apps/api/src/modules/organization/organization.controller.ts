import type { Request, Response } from "express";
import { ok, requireParam } from "../../common/http.js";
import * as organizationService from "./organization.service.js";
import {
  createOrganizationSchema,
  listOrganizationsQuerySchema,
  updateOrganizationSchema,
} from "./organization.dto.js";
import { prisma } from "../../lib/prisma.js";

export async function listOrganizationsHandler(req: Request, res: Response): Promise<void> {
  const query = listOrganizationsQuerySchema.parse(req.query);
  const result = await organizationService.listOrganizations(prisma, query);
  ok(res, result);
}

export async function getOrganizationHandler(req: Request, res: Response): Promise<void> {
  const organization = await organizationService.getOrganization(prisma, requireParam(req, "id"));
  ok(res, organization);
}

export async function createOrganizationHandler(req: Request, res: Response): Promise<void> {
  const input = createOrganizationSchema.parse(req.body);
  // Mounted behind `authenticate` (see organization.routes.ts), so req.user is always set.
  const organization = await organizationService.createOrganization(prisma, req.user!.id, input);
  ok(res, organization, 201);
}

export async function updateOrganizationHandler(req: Request, res: Response): Promise<void> {
  const input = updateOrganizationSchema.parse(req.body);
  const organization = await organizationService.updateOrganization(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, organization);
}
