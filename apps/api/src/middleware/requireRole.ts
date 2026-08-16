import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";

/**
 * Guards a route to a fixed set of roles. Must run after `authenticate`,
 * which is what populates `req.user`.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res
        .status(401)
        .json({ ok: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        ok: false,
        error: { code: "FORBIDDEN", message: "You do not have permission to perform this action" },
      });
      return;
    }

    next();
  };
}
