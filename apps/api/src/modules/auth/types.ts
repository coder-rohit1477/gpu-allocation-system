import type { UserRole, UserStatus } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
}

/** What `authenticate` attaches to `req.user` after verifying the access token. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
}

/** User shape returned from auth endpoints — no credential/session data included. */
export interface PublicUser {
  id: string;
  universityId: string;
  fullName: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  status: UserStatus;
}
