import crypto from "node:crypto";
import type { PrismaClient, User, UserRole } from "@prisma/client";
import { recordAdminAuditEvent } from "../../common/audit.js";
import {
  badRequestError,
  conflictError,
  forbiddenError,
  notFoundError,
} from "../../common/errors.js";
import {
  buildPaginatedResult,
  paginationArgs,
  type PaginatedResult,
} from "../../common/pagination.js";
import { isUniqueConstraintError } from "../../common/prismaErrors.js";
// Reusing Phase 3's password hashing utility — this is *using* the auth
// module's public API to provision a login-able account, not modifying it.
import { hashPassword } from "../auth/password.js";
import * as userRepository from "./user.repository.js";
import type {
  AssignUserDepartmentInput,
  AssignUserRoleInput,
  ChangeUserStatusInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateUserProfileInput,
} from "./user.dto.js";

export type UserServiceDb = Pick<
  PrismaClient,
  "user" | "department" | "userCredential" | "auditLog"
>;

export interface CreatedUser {
  user: User;
  /** Present only when no password was supplied — shown to the caller once. */
  temporaryPassword?: string;
}

/**
 * Roles a DEPARTMENT_ADMIN may hand out. They may never create a peer or
 * superior admin — only SUPER_ADMIN can do that. SUPER_ADMIN itself may
 * assign any role.
 */
const DEPARTMENT_ADMIN_ASSIGNABLE_ROLES: readonly UserRole[] = ["LAB_ADMIN", "FACULTY", "STUDENT"];

function assertRoleAssignmentAuthorized(actorRole: UserRole, targetRole: UserRole): void {
  if (actorRole === "SUPER_ADMIN") return;

  if (actorRole === "DEPARTMENT_ADMIN") {
    if (!DEPARTMENT_ADMIN_ASSIGNABLE_ROLES.includes(targetRole)) {
      throw forbiddenError(
        `Department admins may only assign the LAB_ADMIN, FACULTY, or STUDENT roles (attempted: ${targetRole})`,
      );
    }
    return;
  }

  throw forbiddenError("You do not have permission to assign roles");
}

function generateTemporaryPassword(): string {
  // 24 random bytes, base64url-encoded — well above any reasonable minimum
  // length/entropy bar, and URL/JSON-safe so it's easy to hand back as-is.
  return crypto.randomBytes(24).toString("base64url");
}

export async function listUsers(
  db: UserServiceDb,
  query: ListUsersQuery,
): Promise<PaginatedResult<User>> {
  const { skip, take } = paginationArgs(query);
  const filters = {
    search: query.search,
    role: query.role,
    departmentId: query.departmentId,
    status: query.status,
  };
  const [items, total] = await Promise.all([
    userRepository.listUsers(db, { skip, take, ...filters }),
    userRepository.countUsers(db, filters),
  ]);
  return buildPaginatedResult(items, total, query);
}

export async function getUser(db: UserServiceDb, id: string): Promise<User> {
  const user = await userRepository.findUserById(db, id);
  if (!user) throw notFoundError("User", id);
  return user;
}

export async function createUser(
  db: UserServiceDb,
  actorId: string,
  actorRole: UserRole,
  input: CreateUserInput,
): Promise<CreatedUser> {
  assertRoleAssignmentAuthorized(actorRole, input.role);

  if (input.departmentId) {
    const department = await db.department.findUnique({ where: { id: input.departmentId } });
    if (!department) throw badRequestError(`Department "${input.departmentId}" does not exist`);
  }

  const [existingByEmail, existingByUniversityId] = await Promise.all([
    userRepository.findUserByEmail(db, input.email),
    userRepository.findUserByUniversityId(db, input.universityId),
  ]);
  if (existingByEmail) throw conflictError(`Email "${input.email}" is already in use`);
  if (existingByUniversityId) {
    throw conflictError(`University ID "${input.universityId}" is already in use`);
  }

  const temporaryPassword = input.password ? undefined : generateTemporaryPassword();
  const passwordHash = await hashPassword(input.password ?? temporaryPassword!);

  let user: User;
  try {
    user = await userRepository.createUser(db, {
      universityId: input.universityId,
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      department: input.departmentId ? { connect: { id: input.departmentId } } : undefined,
      credential: { create: { passwordHash } },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError("Email or university ID is already in use");
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_USER_CREATED",
    resourceType: "User",
    resourceId: user.id,
    metadata: { role: user.role, departmentId: user.departmentId },
  });

  return { user, temporaryPassword };
}

export async function updateUserProfile(
  db: UserServiceDb,
  actorId: string,
  id: string,
  input: UpdateUserProfileInput,
): Promise<User> {
  await getUser(db, id);

  if (input.email) {
    const existing = await userRepository.findUserByEmail(db, input.email);
    if (existing && existing.id !== id) {
      throw conflictError(`Email "${input.email}" is already in use`);
    }
  }

  let user: User;
  try {
    user = await userRepository.updateUser(db, id, input);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError(`Email "${input.email}" is already in use`);
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_USER_PROFILE_UPDATED",
    resourceType: "User",
    resourceId: user.id,
    metadata: { changes: input },
  });

  return user;
}

export async function changeUserStatus(
  db: UserServiceDb,
  actorId: string,
  id: string,
  input: ChangeUserStatusInput,
): Promise<User> {
  const current = await getUser(db, id);
  const user = await userRepository.updateUser(db, id, { status: input.status });

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_USER_STATUS_CHANGED",
    resourceType: "User",
    resourceId: user.id,
    metadata: { from: current.status, to: user.status },
  });

  return user;
}

export async function assignUserDepartment(
  db: UserServiceDb,
  actorId: string,
  id: string,
  input: AssignUserDepartmentInput,
): Promise<User> {
  const current = await getUser(db, id);

  if (input.departmentId) {
    const department = await db.department.findUnique({ where: { id: input.departmentId } });
    if (!department) throw badRequestError(`Department "${input.departmentId}" does not exist`);
  } else if (current.role !== "SUPER_ADMIN") {
    throw badRequestError("Only a SUPER_ADMIN may have no department");
  }

  const user = await userRepository.updateUser(db, id, { departmentId: input.departmentId });

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_USER_DEPARTMENT_CHANGED",
    resourceType: "User",
    resourceId: user.id,
    metadata: { from: current.departmentId, to: user.departmentId },
  });

  return user;
}

export async function assignUserRole(
  db: UserServiceDb,
  actorId: string,
  actorRole: UserRole,
  id: string,
  input: AssignUserRoleInput,
): Promise<User> {
  const current = await getUser(db, id);
  assertRoleAssignmentAuthorized(actorRole, input.role);

  if (input.role === "SUPER_ADMIN" && current.departmentId) {
    throw badRequestError(
      "A user must be unassigned from their department before becoming SUPER_ADMIN",
    );
  }

  const user = await userRepository.updateUser(db, id, { role: input.role });

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_USER_ROLE_CHANGED",
    resourceType: "User",
    resourceId: user.id,
    metadata: { from: current.role, to: user.role },
  });

  return user;
}
