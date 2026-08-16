import type { NextFunction, Request, Response } from "express";
import { ACCESS_TOKEN_COOKIE } from "../modules/auth/cookies.js";
import { InvalidAccessTokenError, verifyAccessToken } from "../modules/auth/tokens.js";

function unauthorized(res: Response, message: string): void {
  res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message } });
}

/**
 * Verifies the access-token cookie and attaches `req.user`. Deliberately
 * stateless (no DB lookup) so authorization stays cheap on every request —
 * the 15-minute token lifetime bounds how stale `req.user.role` can get.
 * Routes that need a guaranteed-fresh profile (e.g. GET /me) should re-fetch
 * from the database explicitly.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined;

  if (!token) {
    unauthorized(res, "Authentication required");
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch (error) {
    if (error instanceof InvalidAccessTokenError) {
      unauthorized(res, error.message);
      return;
    }
    throw error;
  }
}
