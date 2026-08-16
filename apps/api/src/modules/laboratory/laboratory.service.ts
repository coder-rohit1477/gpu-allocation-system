import type { Laboratory, PrismaClient } from "@prisma/client";
import { recordAdminAuditEvent } from "../../common/audit.js";
import { badRequestError, conflictError, notFoundError } from "../../common/errors.js";
import {
  buildPaginatedResult,
  paginationArgs,
  type PaginatedResult,
} from "../../common/pagination.js";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "../../common/prismaErrors.js";
import * as laboratoryRepository from "./laboratory.repository.js";
import type {
  CreateLaboratoryInput,
  ListLaboratoriesQuery,
  UpdateLaboratoryInput,
} from "./laboratory.dto.js";

export type LaboratoryServiceDb = Pick<PrismaClient, "laboratory" | "department" | "auditLog">;

export async function listLaboratories(
  db: LaboratoryServiceDb,
  query: ListLaboratoriesQuery,
): Promise<PaginatedResult<Laboratory>> {
  const { skip, take } = paginationArgs(query);
  const filters = { search: query.search, departmentId: query.departmentId, status: query.status };
  const [items, total] = await Promise.all([
    laboratoryRepository.listLaboratories(db, { skip, take, ...filters }),
    laboratoryRepository.countLaboratories(db, filters),
  ]);
  return buildPaginatedResult(items, total, query);
}

export async function getLaboratory(db: LaboratoryServiceDb, id: string): Promise<Laboratory> {
  const laboratory = await laboratoryRepository.findLaboratoryById(db, id);
  if (!laboratory) throw notFoundError("Laboratory", id);
  return laboratory;
}

export async function createLaboratory(
  db: LaboratoryServiceDb,
  actorId: string,
  input: CreateLaboratoryInput,
): Promise<Laboratory> {
  const department = await db.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw badRequestError(`Department "${input.departmentId}" does not exist`);

  const existing = await laboratoryRepository.findLaboratoryByDeptAndName(
    db,
    input.departmentId,
    input.name,
  );
  if (existing) {
    throw conflictError(`A laboratory named "${input.name}" already exists in this department`);
  }

  let laboratory: Laboratory;
  try {
    laboratory = await laboratoryRepository.createLaboratory(db, {
      department: { connect: { id: input.departmentId } },
      name: input.name,
      location: input.location,
      floor: input.floor,
      status: input.status,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError(`A laboratory named "${input.name}" already exists in this department`);
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_LABORATORY_CREATED",
    resourceType: "Laboratory",
    resourceId: laboratory.id,
    metadata: { departmentId: laboratory.departmentId },
  });

  return laboratory;
}

export async function updateLaboratory(
  db: LaboratoryServiceDb,
  actorId: string,
  id: string,
  input: UpdateLaboratoryInput,
): Promise<Laboratory> {
  const current = await getLaboratory(db, id);

  if (input.name) {
    const existing = await laboratoryRepository.findLaboratoryByDeptAndName(
      db,
      current.departmentId,
      input.name,
    );
    if (existing && existing.id !== id) {
      throw conflictError(`A laboratory named "${input.name}" already exists in this department`);
    }
  }

  let laboratory: Laboratory;
  try {
    laboratory = await laboratoryRepository.updateLaboratory(db, id, input);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError(`A laboratory named "${input.name}" already exists in this department`);
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_LABORATORY_UPDATED",
    resourceType: "Laboratory",
    resourceId: laboratory.id,
    metadata: { changes: input },
  });

  return laboratory;
}

export async function deleteLaboratory(
  db: LaboratoryServiceDb,
  actorId: string,
  id: string,
): Promise<void> {
  await getLaboratory(db, id);

  try {
    await laboratoryRepository.deleteLaboratory(db, id);
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      throw conflictError(
        "Laboratory cannot be deleted while it still has GPU nodes assigned to it",
      );
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_LABORATORY_DELETED",
    resourceType: "Laboratory",
    resourceId: id,
  });
}
