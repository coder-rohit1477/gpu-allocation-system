import crypto from "node:crypto";
import type { PrismaClient, User } from "@prisma/client";
import { verifyPassword } from "./password.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from "./tokens.js";
import { recordAuthAuditEvent } from "./audit.js";
import type { PublicUser } from "./types.js";

/** Narrow slice of PrismaClient the auth service touches — keeps unit tests
 * free of needing a full PrismaClient mock. */
export type AuthDb = Pick<PrismaClient, "user" | "refreshSession" | "auditLog">;

export type AuthErrorCode =
  "INVALID_CREDENTIALS" | "ACCOUNT_INACTIVE" | "INVALID_REFRESH_TOKEN" | "USER_NOT_FOUND";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface IssuedSession extends IssuedTokens {
  sessionId: string;
}

export interface LoginResult extends IssuedTokens {
  user: PublicUser;
}

export interface RefreshResult extends IssuedTokens {
  user: PublicUser;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    universityId: user.universityId,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    status: user.status,
  };
}

async function issueSession(
  db: AuthDb,
  user: User,
  familyId: string,
  context: RequestContext,
): Promise<IssuedSession> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const rawRefreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = refreshTokenExpiry();

  const session = await db.refreshSession.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash: hashRefreshToken(rawRefreshToken),
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: refreshTokenExpiresAt,
    },
  });

  return {
    sessionId: session.id,
    accessToken,
    refreshToken: rawRefreshToken,
    refreshTokenExpiresAt,
  };
}

/** Hashing a real bcrypt string when the user doesn't exist keeps login
 * timing roughly constant regardless of whether the email is registered. */
const DUMMY_PASSWORD_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO4CV4y6D9wZ6.9UUmVQ0R.0F7B5f8V0G";

export async function login(
  db: AuthDb,
  input: { email: string; password: string },
  context: RequestContext = {},
): Promise<LoginResult> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    include: { credential: true },
  });

  const passwordValid = await verifyPassword(
    input.password,
    user?.credential?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !user.credential || !passwordValid) {
    await recordAuthAuditEvent(db, {
      actorId: user?.id ?? null,
      action: "AUTH_LOGIN_FAILURE",
      resourceId: user?.id ?? input.email,
      metadata: { reason: user ? "bad_password" : "user_not_found" },
    });
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    await recordAuthAuditEvent(db, {
      actorId: user.id,
      action: "AUTH_LOGIN_FAILURE",
      resourceId: user.id,
      metadata: { reason: "account_not_active", status: user.status },
    });
    throw new AuthError("ACCOUNT_INACTIVE", "Account is not active");
  }

  const familyId = crypto.randomUUID();
  const { accessToken, refreshToken, refreshTokenExpiresAt } = await issueSession(
    db,
    user,
    familyId,
    context,
  );

  await recordAuthAuditEvent(db, {
    actorId: user.id,
    action: "AUTH_LOGIN_SUCCESS",
    resourceId: user.id,
    metadata: { familyId },
  });

  return { user: toPublicUser(user), accessToken, refreshToken, refreshTokenExpiresAt };
}

export async function refresh(
  db: AuthDb,
  rawRefreshToken: string,
  context: RequestContext = {},
): Promise<RefreshResult> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const session = await db.refreshSession.findUnique({ where: { tokenHash } });

  if (!session) {
    throw new AuthError("INVALID_REFRESH_TOKEN", "Refresh token is invalid");
  }

  if (session.revokedAt) {
    // The token was already rotated away (or explicitly revoked) yet is being
    // presented again — treat this as a stolen/replayed token and kill the
    // entire rotation family, not just this one session.
    await db.refreshSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAuthAuditEvent(db, {
      actorId: session.userId,
      action: "AUTH_TOKEN_REUSE_DETECTED",
      resourceId: session.userId,
      metadata: { familyId: session.familyId, sessionId: session.id },
    });
    throw new AuthError("INVALID_REFRESH_TOKEN", "Refresh token has already been used");
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new AuthError("INVALID_REFRESH_TOKEN", "Refresh token has expired");
  }

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    throw new AuthError("USER_NOT_FOUND", "User no longer exists");
  }
  if (user.status !== "ACTIVE") {
    throw new AuthError("ACCOUNT_INACTIVE", "Account is not active");
  }

  const { sessionId, accessToken, refreshToken, refreshTokenExpiresAt } = await issueSession(
    db,
    user,
    session.familyId,
    context,
  );

  await db.refreshSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date(), replacedByTokenId: sessionId },
  });

  await recordAuthAuditEvent(db, {
    actorId: user.id,
    action: "AUTH_TOKEN_REFRESH",
    resourceId: user.id,
    metadata: { familyId: session.familyId },
  });

  return { user: toPublicUser(user), accessToken, refreshToken, refreshTokenExpiresAt };
}

export async function logout(db: AuthDb, rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const session = await db.refreshSession.findUnique({ where: { tokenHash } });
  if (!session) return;

  // Deleted, not soft-revoked: a *rotated-away* token must stay in the table
  // (revoked) so a replay can be recognized as reuse and the family killed.
  // A *logged-out* token has no such rotation chain to protect — leaving it
  // behind as "revoked" would make an ordinary stale-tab retry after logout
  // indistinguishable from a stolen-token replay and needlessly nuke the
  // rest of that login's session family.
  await db.refreshSession.delete({ where: { id: session.id } });

  await recordAuthAuditEvent(db, {
    actorId: session.userId,
    action: "AUTH_LOGOUT",
    resourceId: session.userId,
    metadata: { sessionId: session.id },
  });
}

export async function logoutAll(db: AuthDb, userId: string): Promise<void> {
  await db.refreshSession.deleteMany({ where: { userId } });

  await recordAuthAuditEvent(db, {
    actorId: userId,
    action: "AUTH_LOGOUT_ALL",
    resourceId: userId,
  });
}

export async function getProfile(db: AuthDb, userId: string): Promise<PublicUser | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  return user ? toPublicUser(user) : null;
}
