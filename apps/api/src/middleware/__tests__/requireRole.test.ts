import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireRole } from "../requireRole.js";

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

describe("requireRole", () => {
  it("rejects unauthenticated requests with 401", () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireRole("SUPER_ADMIN")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a user whose role is not in the allow-list with 403", () => {
    const req = { user: { id: "u1", role: "STUDENT", email: "s@muj.manipal.edu" } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireRole("SUPER_ADMIN", "DEPARTMENT_ADMIN")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() for a user whose role is in the allow-list", () => {
    const req = { user: { id: "u1", role: "FACULTY", email: "f@muj.manipal.edu" } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    requireRole("FACULTY", "LAB_ADMIN")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
