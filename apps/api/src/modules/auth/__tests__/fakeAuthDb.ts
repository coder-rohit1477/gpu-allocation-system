import crypto from "node:crypto";
import type { UserRole, UserStatus } from "@prisma/client";
import type { AuthDb } from "../auth.service.js";

/**
 * A minimal in-memory stand-in for the slice of PrismaClient the auth
 * service uses. This lets auth.service.ts be exercised end-to-end
 * (including refresh-token rotation and reuse detection) without a real
 * database — genuinely a unit test, not an integration test.
 */

export interface FakeUserRow {
  id: string;
  universityId: string;
  fullName: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  status: UserStatus;
  credential: { passwordHash: string } | null;
}

interface FakeRefreshSessionRow {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt: Date;
}

export interface FakeAuditLogRow {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: unknown;
}

export function createFakeAuthDb(seedUsers: FakeUserRow[] = []) {
  const users = new Map(seedUsers.map((u) => [u.id, u]));
  const sessions = new Map<string, FakeRefreshSessionRow>();
  const auditLogs: FakeAuditLogRow[] = [];

  const db = {
    user: {
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return users.get(where.id) ?? null;
        if (where.email) {
          return [...users.values()].find((u) => u.email === where.email) ?? null;
        }
        return null;
      },
    },
    refreshSession: {
      create: async ({
        data,
      }: {
        data: Omit<FakeRefreshSessionRow, "id" | "createdAt" | "revokedAt" | "replacedByTokenId">;
      }) => {
        const row: FakeRefreshSessionRow = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          revokedAt: null,
          replacedByTokenId: null,
          ...data,
          userAgent: data.userAgent ?? null,
          ipAddress: data.ipAddress ?? null,
        };
        sessions.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id?: string; tokenHash?: string } }) => {
        if (where.id) return sessions.get(where.id) ?? null;
        if (where.tokenHash) {
          return [...sessions.values()].find((s) => s.tokenHash === where.tokenHash) ?? null;
        }
        return null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeRefreshSessionRow>;
      }) => {
        const row = sessions.get(where.id);
        if (!row) throw new Error("session not found");
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { familyId?: string; userId?: string; revokedAt?: null };
        data: Partial<FakeRefreshSessionRow>;
      }) => {
        let count = 0;
        for (const row of sessions.values()) {
          const matchesFamily = where.familyId === undefined || row.familyId === where.familyId;
          const matchesUser = where.userId === undefined || row.userId === where.userId;
          const matchesRevoked = where.revokedAt === undefined || row.revokedAt === where.revokedAt;
          if (matchesFamily && matchesUser && matchesRevoked) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const row = sessions.get(where.id);
        if (!row) throw new Error("session not found");
        sessions.delete(where.id);
        return row;
      },
      deleteMany: async ({ where }: { where: { userId?: string } }) => {
        let count = 0;
        for (const [id, row] of sessions) {
          if (where.userId === undefined || row.userId === where.userId) {
            sessions.delete(id);
            count++;
          }
        }
        return { count };
      },
    },
    auditLog: {
      create: async ({ data }: { data: FakeAuditLogRow }) => {
        auditLogs.push(data);
        return { id: crypto.randomUUID(), createdAt: new Date(), ...data };
      },
    },
  };

  return {
    db: db as unknown as AuthDb,
    users,
    sessions,
    auditLogs,
  };
}
