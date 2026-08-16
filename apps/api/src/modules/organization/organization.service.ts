import type { Organization, PrismaClient } from "@prisma/client";
import { recordAdminAuditEvent } from "../../common/audit.js";
import { conflictError, notFoundError } from "../../common/errors.js";
import {
  buildPaginatedResult,
  paginationArgs,
  type PaginatedResult,
} from "../../common/pagination.js";
import { isUniqueConstraintError } from "../../common/prismaErrors.js";
import * as organizationRepository from "./organization.repository.js";
import type {
  CreateOrganizationInput,
  ListOrganizationsQuery,
  UpdateOrganizationInput,
} from "./organization.dto.js";

export type OrganizationServiceDb = Pick<PrismaClient, "organization" | "auditLog">;

export async function listOrganizations(
  db: OrganizationServiceDb,
  query: ListOrganizationsQuery,
): Promise<PaginatedResult<Organization>> {
  const { skip, take } = paginationArgs(query);
  const [items, total] = await Promise.all([
    organizationRepository.listOrganizations(db, { skip, take, search: query.search }),
    organizationRepository.countOrganizations(db, { search: query.search }),
  ]);
  return buildPaginatedResult(items, total, query);
}

export async function getOrganization(
  db: OrganizationServiceDb,
  id: string,
): Promise<Organization> {
  const organization = await organizationRepository.findOrganizationById(db, id);
  if (!organization) throw notFoundError("Organization", id);
  return organization;
}

export async function createOrganization(
  db: OrganizationServiceDb,
  actorId: string,
  input: CreateOrganizationInput,
): Promise<Organization> {
  const existing = await organizationRepository.findOrganizationByCode(db, input.code);
  if (existing) throw conflictError(`Organization code "${input.code}" is already in use`);

  let organization: Organization;
  try {
    organization = await organizationRepository.createOrganization(db, input);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError(`Organization code "${input.code}" is already in use`);
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_ORGANIZATION_CREATED",
    resourceType: "Organization",
    resourceId: organization.id,
    metadata: { code: organization.code },
  });

  return organization;
}

export async function updateOrganization(
  db: OrganizationServiceDb,
  actorId: string,
  id: string,
  input: UpdateOrganizationInput,
): Promise<Organization> {
  await getOrganization(db, id);

  if (input.code) {
    const existing = await organizationRepository.findOrganizationByCode(db, input.code);
    if (existing && existing.id !== id) {
      throw conflictError(`Organization code "${input.code}" is already in use`);
    }
  }

  let organization: Organization;
  try {
    organization = await organizationRepository.updateOrganization(db, id, input);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError(`Organization code "${input.code}" is already in use`);
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_ORGANIZATION_UPDATED",
    resourceType: "Organization",
    resourceId: organization.id,
    metadata: { changes: input },
  });

  return organization;
}
