import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { AccessTokenPayload } from "./types.js";

export class InvalidAccessTokenError extends Error {
  constructor(message = "Invalid or expired access token") {
    super(message);
    this.name = "InvalidAccessTokenError";
  }
}

export function accessTokenTtlSeconds(): number {
  return env.auth.accessTokenTtlMinutes * 60;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  // `jti` is a per-issuance nonce, not part of AccessTokenPayload's identity
  // claims — without it, two tokens signed for the same user within the same
  // wall-clock second (e.g. back-to-back refreshes) would be byte-identical,
  // since `iat` only has second-level resolution.
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.auth.accessTokenSecret, {
    expiresIn: accessTokenTtlSeconds(),
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.auth.accessTokenSecret);
  } catch {
    throw new InvalidAccessTokenError();
  }

  if (typeof decoded === "string") {
    throw new InvalidAccessTokenError();
  }

  const { sub, role, email } = decoded;
  if (typeof sub !== "string" || typeof role !== "string" || typeof email !== "string") {
    throw new InvalidAccessTokenError();
  }

  return { sub, role: role as AccessTokenPayload["role"], email };
}

/** A high-entropy opaque token — never a JWT. The raw value is only ever
 * held by the client; only its HMAC hash is persisted (see hashRefreshToken). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHmac("sha256", env.auth.refreshTokenPepper).update(rawToken).digest("hex");
}

export function refreshTokenTtlMs(): number {
  return env.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + refreshTokenTtlMs());
}
