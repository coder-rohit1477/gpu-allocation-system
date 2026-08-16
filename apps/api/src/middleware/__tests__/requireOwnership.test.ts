import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireOwnership } from "../requireOwnership.js";

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

describe("requireOwnership", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireOwnership(() => "owner-1")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when the resolver reports the resource does not exist", async () => {
    const req = { user: { id: "u1", role: "STUDENT", email: "s@muj.manipal.edu" } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireOwnership(() => null)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated user does not own the resource", async () => {
    const req = { user: { id: "u1", role: "STUDENT", email: "s@muj.manipal.edu" } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireOwnership(() => "someone-else")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the authenticated user owns the resource", async () => {
    const req = { user: { id: "u1", role: "STUDENT", email: "s@muj.manipal.edu" } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireOwnership(() => "u1")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next() for a bypass role even when it does not own the resource", async () => {
    const req = { user: { id: "u1", role: "SUPER_ADMIN", email: "a@muj.manipal.edu" } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireOwnership(() => "someone-else", { bypassRoles: ["SUPER_ADMIN"] })(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("supports an async resolver", async () => {
    const req = { user: { id: "u1", role: "STUDENT", email: "s@muj.manipal.edu" } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireOwnership(async () => Promise.resolve("u1"))(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
