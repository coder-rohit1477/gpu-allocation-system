import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AuthError, getProfile, login, logout, logoutAll, refresh } from "./auth.service.js";
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "./cookies.js";
import type { PublicUser } from "./types.js";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required"),
});

function requestContext(req: Request): { userAgent?: string; ipAddress?: string } {
  return {
    userAgent: req.get("user-agent"),
    ipAddress: req.ip,
  };
}

function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ ok: true, data });
}

function authErrorStatus(code: AuthError["code"]): number {
  switch (code) {
    case "INVALID_CREDENTIALS":
    case "INVALID_REFRESH_TOKEN":
      return 401;
    case "ACCOUNT_INACTIVE":
      return 403;
    case "USER_NOT_FOUND":
      return 404;
  }
}

function fail(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ ok: false, error: { code, message } });
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, 400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid request body");
    return;
  }

  try {
    const result = await login(prisma, parsed.data, requestContext(req));
    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);
    ok<{ user: PublicUser }>(res, { user: result.user });
  } catch (error) {
    if (error instanceof AuthError) {
      fail(res, authErrorStatus(error.code), error.code, error.message);
      return;
    }
    throw error;
  }
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;

  if (!rawRefreshToken) {
    fail(res, 401, "UNAUTHORIZED", "Refresh token is required");
    return;
  }

  try {
    const result = await refresh(prisma, rawRefreshToken, requestContext(req));
    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);
    ok<{ user: PublicUser }>(res, { user: result.user });
  } catch (error) {
    if (error instanceof AuthError) {
      clearAuthCookies(res);
      fail(res, authErrorStatus(error.code), error.code, error.message);
      return;
    }
    throw error;
  }
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
  await logout(prisma, rawRefreshToken);
  clearAuthCookies(res);
  ok(res, { loggedOut: true });
}

export async function logoutAllHandler(req: Request, res: Response): Promise<void> {
  // Mounted behind `authenticate`, so req.user is guaranteed to be set.
  await logoutAll(prisma, req.user!.id);
  clearAuthCookies(res);
  ok(res, { loggedOutAll: true });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  // Re-fetch from the database rather than trusting only the JWT claims, so
  // a role/status change takes effect immediately for this endpoint.
  const profile = await getProfile(prisma, req.user!.id);

  if (!profile) {
    clearAuthCookies(res);
    fail(res, 404, "USER_NOT_FOUND", "User no longer exists");
    return;
  }

  ok<{ user: PublicUser }>(res, { user: profile });
}
