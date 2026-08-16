import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";

/**
 * Resolves the owning user id of the resource a request targets. Return
 * `null` when the resource doesn't exist (the middleware responds 404
 * rather than leaking existence via a 403).
 */
export type OwnerResolver = (req: Request) => Promise<string | null> | string | null;

export interface RequireOwnershipOptions {
  /** Roles that bypass the ownership check entirely (e.g. admins). */
  bypassRoles?: UserRole[];
}

/**
 * Guards a route so only the resource's owner (or a bypass role) may
 * proceed. Generic and route-agnostic — no owned-resource routes exist yet
 * in this phase, but reservation/booking routes in a later phase can drop
 * this in directly by supplying the appropriate `OwnerResolver`.
 */
export function requireOwnership(
  resolveOwnerId: OwnerResolver,
  options: RequireOwnershipOptions = {},
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res
        .status(401)
        .json({ ok: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    if (options.bypassRoles?.includes(req.user.role)) {
      next();
      return;
    }

    const ownerId = await resolveOwnerId(req);

    if (ownerId === null) {
      res
        .status(404)
        .json({ ok: false, error: { code: "NOT_FOUND", message: "Resource not found" } });
      return;
    }

    if (ownerId !== req.user.id) {
      res.status(403).json({
        ok: false,
        error: { code: "FORBIDDEN", message: "You do not have permission to access this resource" },
      });
      return;
    }

    next();
  };
}
