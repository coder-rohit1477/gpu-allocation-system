import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env.js";
import {
  InvalidAccessTokenError,
  accessTokenTtlSeconds,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
  verifyAccessToken,
} from "../tokens.js";

describe("access tokens", () => {
  const payload = { sub: "user-1", role: "STUDENT" as const, email: "student@muj.manipal.edu" };

  it("round-trips a signed token", () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded).toEqual(payload);
  });

  it("carries the configured TTL as an expiry claim", () => {
    const token = signAccessToken(payload);
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    expect(decoded.exp! - decoded.iat!).toBe(accessTokenTtlSeconds());
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign(payload, "not-the-real-secret", { expiresIn: "15m" });
    expect(() => verifyAccessToken(forged)).toThrow(InvalidAccessTokenError);
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken(payload);
    const tampered = token.slice(0, -2) + (token.at(-2) === "a" ? "b" : "a") + token.at(-1);
    expect(() => verifyAccessToken(tampered)).toThrow(InvalidAccessTokenError);
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign(payload, env.auth.accessTokenSecret, { expiresIn: -1 });
    expect(() => verifyAccessToken(expired)).toThrow(InvalidAccessTokenError);
  });

  it("rejects a token missing required claims", () => {
    const incomplete = jwt.sign({ sub: "user-1" }, env.auth.accessTokenSecret, {
      expiresIn: "15m",
    });
    expect(() => verifyAccessToken(incomplete)).toThrow(InvalidAccessTokenError);
  });
});

describe("refresh tokens", () => {
  it("generates high-entropy, unique opaque tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{128}$/);
  });

  it("hashes deterministically for the same input", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it("hashes different tokens to different values", () => {
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(
      hashRefreshToken(generateRefreshToken()),
    );
  });

  it("never stores anything resembling the raw token", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).not.toContain(token);
  });

  it("computes an expiry roughly refreshTokenTtlDays from now", () => {
    const before = Date.now();
    const expiry = refreshTokenExpiry();
    const expectedMs = env.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
    expect(expiry.getTime() - before).toBeGreaterThan(expectedMs - 1000);
    expect(expiry.getTime() - before).toBeLessThanOrEqual(expectedMs + 1000);
  });
});
