import type { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "../../lib/logger.js";

export type AuthAuditAction =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILURE"
  | "AUTH_TOKEN_REFRESH"
  | "AUTH_TOKEN_REUSE_DETECTED"
  | "AUTH_LOGOUT"
  | "AUTH_LOGOUT_ALL";

export interface RecordAuthAuditEventInput {
  /** Null when the actor could not be identified (e.g. login against an unknown email). */
  actorId: string | null;
  action: AuthAuditAction;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort, same as admin/audit.ts's recordAdminAuditEvent: this always
 * follows an already-committed login/refresh/logout, so a transient
 * audit-log failure must never turn a successful auth operation into a
 * client-facing 500 (the caller would keep a valid session/cookie while
 * believing the request failed).
 */
export async function recordAuthAuditEvent(
  prisma: Pick<PrismaClient, "auditLog">,
  input: RecordAuthAuditEventInput,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        resourceType: "User",
        resourceId: input.resourceId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    logger.error({ err: error, ...input }, "failed to record auth audit event");
  }
}
