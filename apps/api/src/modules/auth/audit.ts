import type { Prisma, PrismaClient } from "@prisma/client";

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

export async function recordAuthAuditEvent(
  prisma: Pick<PrismaClient, "auditLog">,
  input: RecordAuthAuditEventInput,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      resourceType: "User",
      resourceId: input.resourceId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
