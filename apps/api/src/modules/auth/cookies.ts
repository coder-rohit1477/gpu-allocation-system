import type { CookieOptions, Response } from "express";
import { env } from "../../config/env.js";
import { accessTokenTtlSeconds, refreshTokenTtlMs } from "./tokens.js";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/** Refresh cookie is scoped to the auth routes only, so it is never sent
 * on ordinary API requests where it isn't needed. */
export const AUTH_COOKIE_PATH = "/api/v1/auth";

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.auth.secureCookies,
    sameSite: "lax",
    domain: env.auth.cookieDomain,
  };
}

export function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...baseCookieOptions(),
    path: "/",
    maxAge: accessTokenTtlSeconds() * 1000,
  });
}

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...baseCookieOptions(),
    path: AUTH_COOKIE_PATH,
    maxAge: refreshTokenTtlMs(),
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseCookieOptions(), path: "/" });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...baseCookieOptions(), path: AUTH_COOKIE_PATH });
}
