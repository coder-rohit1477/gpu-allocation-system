import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { PrismaClient, UserRole } from "@prisma/client";

/**
 * Resolves the department id a request targets — for an existing resource
 * this usually means looking it up (e.g. a laboratory's departmentId); for
 * a create request it usually just reads req.body.departmentId. Return
 * `null` when the target resource doesn't exist (middleware responds 404).
 */
export type DepartmentIdResolver = (req: Request) => Promise<string | null> | string | null;

export interface RequireDepartmentScopeOptions {
  /** Roles that bypass department scoping entirely (e.g. SUPER_ADMIN). */
  bypassRoles?: UserRole[];
}

/**
 * Guards a route so the actor may only act on resources within their own
 * department, unless their role bypasses scoping. Distinct from
 * requireOwnership (Phase 3's auth middleware, not touched here): that
 * checks "this resource belongs to this specific user"; this checks "this
 * resource belongs to this user's department."
 *
 * The access-token JWT only carries {id, role, email} (Phase 3 was not
 * modified to add departmentId), so this middleware re-fetches the actor's
 * current departmentId from the database on every call — also means a
 * department reassignment takes effect immediately, not just after the next
 * login.
 */
export function requireDepartmentScope(
  db: Pick<PrismaClient, "user">,
  resolveTargetDepartmentId: DepartmentIdResolver,
  options: RequireDepartmentScopeOptions = {},
): RequestHandler {
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

    const targetDepartmentId = await resolveTargetDepartmentId(req);
    if (targetDepartmentId === null) {
      res
        .status(404)
        .json({ ok: false, error: { code: "NOT_FOUND", message: "Resource not found" } });
      return;
    }

    const actor = await db.user.findUnique({
      where: { id: req.user.id },
      select: { departmentId: true },
    });

    if (!actor?.departmentId || actor.departmentId !== targetDepartmentId) {
      res.status(403).json({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to manage resources outside your department",
        },
      });
      return;
    }

    next();
  };
}
