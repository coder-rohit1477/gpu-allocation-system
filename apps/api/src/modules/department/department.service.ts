import type { Department, PrismaClient } from "@prisma/client";
import { recordAdminAuditEvent } from "../../common/audit.js";
import { badRequestError, conflictError, notFoundError } from "../../common/errors.js";
import {
  buildPaginatedResult,
  paginationArgs,
  type PaginatedResult,
} from "../../common/pagination.js";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "../../common/prismaErrors.js";
import * as departmentRepository from "./department.repository.js";
import type {
  CreateDepartmentInput,
  ListDepartmentsQuery,
  UpdateDepartmentInput,
} from "./department.dto.js";

export type DepartmentServiceDb = Pick<PrismaClient, "department" | "organization" | "auditLog">;

export async function listDepartments(
  db: DepartmentServiceDb,
  query: ListDepartmentsQuery,
): Promise<PaginatedResult<Department>> {
  const { skip, take } = paginationArgs(query);
  const args = { search: query.search, organizationId: query.organizationId };
  const [items, total] = await Promise.all([
    departmentRepository.listDepartments(db, { skip, take, ...args }),
    departmentRepository.countDepartments(db, args),
  ]);
  return buildPaginatedResult(items, total, query);
}

export async function getDepartment(db: DepartmentServiceDb, id: string): Promise<Department> {
  const department = await departmentRepository.findDepartmentById(db, id);
  if (!department) throw notFoundError("Department", id);
  return department;
}

export async function createDepartment(
  db: DepartmentServiceDb,
  actorId: string,
  input: CreateDepartmentInput,
): Promise<Department> {
  const organization = await db.organization.findUnique({ where: { id: input.organizationId } });
  if (!organization) throw badRequestError(`Organization "${input.organizationId}" does not exist`);

  const existing = await departmentRepository.findDepartmentByOrgAndCode(
    db,
    input.organizationId,
    input.code,
  );
  if (existing) {
    throw conflictError(`Department code "${input.code}" is already in use in this organization`);
  }

  let department: Department;
  try {
    department = await departmentRepository.createDepartment(db, {
      organization: { connect: { id: input.organizationId } },
      name: input.name,
      code: input.code,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError(`Department code "${input.code}" is already in use in this organization`);
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_DEPARTMENT_CREATED",
    resourceType: "Department",
    resourceId: department.id,
    metadata: { organizationId: department.organizationId, code: department.code },
  });

  return department;
}

export async function updateDepartment(
  db: DepartmentServiceDb,
  actorId: string,
  id: string,
  input: UpdateDepartmentInput,
): Promise<Department> {
  const current = await getDepartment(db, id);

  if (input.code) {
    const existing = await departmentRepository.findDepartmentByOrgAndCode(
      db,
      current.organizationId,
      input.code,
    );
    if (existing && existing.id !== id) {
      throw conflictError(`Department code "${input.code}" is already in use in this organization`);
    }
  }

  let department: Department;
  try {
    department = await departmentRepository.updateDepartment(db, id, input);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError(`Department code "${input.code}" is already in use in this organization`);
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_DEPARTMENT_UPDATED",
    resourceType: "Department",
    resourceId: department.id,
    metadata: { changes: input },
  });

  return department;
}

export async function deleteDepartment(
  db: DepartmentServiceDb,
  actorId: string,
  id: string,
): Promise<void> {
  await getDepartment(db, id);

  try {
    await departmentRepository.deleteDepartment(db, id);
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      throw conflictError(
        "Department cannot be deleted while it still has laboratories or other dependent records",
      );
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_DEPARTMENT_DELETED",
    resourceType: "Department",
    resourceId: id,
  });
}
