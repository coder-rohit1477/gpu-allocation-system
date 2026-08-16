import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireDepartmentScope } from "../requireDepartmentScope.js";

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

function fakeDb(actorDepartmentId: string | null): Pick<PrismaClient, "user"> {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({ departmentId: actorDepartmentId }),
    },
  } as unknown as Pick<PrismaClient, "user">;
}

describe("requireDepartmentScope", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireDepartmentScope(fakeDb(null), () => "dept-1")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when the resolver reports the target resource does not exist", async () => {
    const req = {
      user: { id: "u1", role: "DEPARTMENT_ADMIN", email: "a@muj.manipal.edu" },
    } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireDepartmentScope(fakeDb("dept-1"), () => null)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when the actor's department does not match the target", async () => {
    const req = {
      user: { id: "u1", role: "DEPARTMENT_ADMIN", email: "a@muj.manipal.edu" },
    } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireDepartmentScope(fakeDb("dept-1"), () => "dept-2")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when the actor has no department at all", async () => {
    const req = {
      user: { id: "u1", role: "DEPARTMENT_ADMIN", email: "a@muj.manipal.edu" },
    } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireDepartmentScope(fakeDb(null), () => "dept-1")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the actor's department matches the target", async () => {
    const req = {
      user: { id: "u1", role: "DEPARTMENT_ADMIN", email: "a@muj.manipal.edu" },
    } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireDepartmentScope(fakeDb("dept-1"), () => "dept-1")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next() for a bypass role without even checking the department", async () => {
    const req = { user: { id: "u1", role: "SUPER_ADMIN", email: "a@muj.manipal.edu" } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    const db = fakeDb(null);

    await requireDepartmentScope(db, () => "dept-1", { bypassRoles: ["SUPER_ADMIN"] })(
      req,
      res,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});
