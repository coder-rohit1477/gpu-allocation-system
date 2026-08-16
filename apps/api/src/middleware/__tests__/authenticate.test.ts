import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { signAccessToken } from "../../modules/auth/tokens.js";
import { authenticate } from "../authenticate.js";

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function reqWithCookie(token: string | undefined): Request {
  return { cookies: token === undefined ? {} : { access_token: token } } as unknown as Request;
}

describe("authenticate middleware", () => {
  it("rejects a request with no access-token cookie", () => {
    const req = reqWithCookie(undefined);
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid/malformed token", () => {
    const req = reqWithCookie("not-a-jwt");
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an expired token", () => {
    const token = jwt.sign(
      { sub: "u1", role: "STUDENT", email: "s@muj.manipal.edu" },
      env.auth.accessTokenSecret,
      { expiresIn: -1 },
    );
    const req = reqWithCookie(token);
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches req.user and calls next() for a valid token", () => {
    const token = signAccessToken({ sub: "u1", role: "FACULTY", email: "f@muj.manipal.edu" });
    const req = reqWithCookie(token);
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ id: "u1", role: "FACULTY", email: "f@muj.manipal.edu" });
  });
});
