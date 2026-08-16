import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Admin-module audit actions. Kept separate from auth.ts's AuthAuditAction
 * union (Phase 3, not modified here) — different module, different action
 * vocabulary, same underlying append-only AuditLog table.
 */
export type AdminAuditAction =
  | "ADMIN_ORGANIZATION_CREATED"
  | "ADMIN_ORGANIZATION_UPDATED"
  | "ADMIN_DEPARTMENT_CREATED"
  | "ADMIN_DEPARTMENT_UPDATED"
  | "ADMIN_DEPARTMENT_DELETED"
  | "ADMIN_LABORATORY_CREATED"
  | "ADMIN_LABORATORY_UPDATED"
  | "ADMIN_LABORATORY_DELETED"
  | "ADMIN_COURSE_CREATED"
  | "ADMIN_COURSE_UPDATED"
  | "ADMIN_COURSE_DELETED"
  | "ADMIN_GPU_NODE_CREATED"
  | "ADMIN_GPU_NODE_UPDATED"
  | "ADMIN_GPU_NODE_STATUS_CHANGED"
  | "ADMIN_GPU_NODE_HEARTBEAT_UPDATED"
  | "ADMIN_GPU_NODE_DELETED"
  | "ADMIN_USER_CREATED"
  | "ADMIN_USER_PROFILE_UPDATED"
  | "ADMIN_USER_STATUS_CHANGED"
  | "ADMIN_USER_DEPARTMENT_CHANGED"
  | "ADMIN_USER_ROLE_CHANGED";

export interface RecordAdminAuditEventInput {
  actorId: string;
  action: AdminAuditAction;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export async function recordAdminAuditEvent(
  prisma: Pick<PrismaClient, "auditLog">,
  input: RecordAdminAuditEventInput,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
