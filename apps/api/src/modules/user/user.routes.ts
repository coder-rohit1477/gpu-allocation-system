import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { requireDepartmentScope } from "../../common/requireDepartmentScope.js";
import { controllerHandler, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  assignUserDepartmentHandler,
  assignUserRoleHandler,
  changeUserStatusHandler,
  createUserHandler,
  getUserHandler,
  listUsersHandler,
  updateUserProfileHandler,
} from "./user.controller.js";
import { findUserById } from "./user.repository.js";

const router: ExpressRouter = Router();

// User records carry PII (email, university ID) — reads are restricted to
// admin-tier roles, unlike the more public Organization/Department/etc. reads.
const USER_READ_ROLES = ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "LAB_ADMIN"] as const;
const USER_WRITE_ROLES = ["SUPER_ADMIN", "DEPARTMENT_ADMIN"] as const;

async function existingUserDepartmentId(userId: string): Promise<string | null> {
  const user = await findUserById(prisma, userId);
  return user?.departmentId ?? null;
}

router.use(authenticate);

router.get("/", requireRole(...USER_READ_ROLES), controllerHandler(listUsersHandler));
router.get("/:id", requireRole(...USER_READ_ROLES), controllerHandler(getUserHandler));

// Create: department-scoped by the *new* user's target department. A missing
// departmentId (e.g. a DEPARTMENT_ADMIN trying to create a SUPER_ADMIN, which
// has none) resolves to an empty-string sentinel that can never match a real
// department id, so it correctly falls through to 403 rather than a
// misleading 404 — DTO-level validation in user.dto.ts also independently
// requires departmentId for every non-SUPER_ADMIN role.
router.post(
  "/",
  requireRole(...USER_WRITE_ROLES),
  requireDepartmentScope(
    prisma,
    (req) => (req.body as { departmentId?: string | null }).departmentId ?? "",
    { bypassRoles: ["SUPER_ADMIN"] },
  ),
  controllerHandler(createUserHandler),
);

router.patch(
  "/:id",
  requireRole(...USER_WRITE_ROLES),
  requireDepartmentScope(prisma, (req) => existingUserDepartmentId(requireParam(req, "id")), {
    bypassRoles: ["SUPER_ADMIN"],
  }),
  controllerHandler(updateUserProfileHandler),
);

router.patch(
  "/:id/status",
  requireRole(...USER_WRITE_ROLES),
  requireDepartmentScope(prisma, (req) => existingUserDepartmentId(requireParam(req, "id")), {
    bypassRoles: ["SUPER_ADMIN"],
  }),
  controllerHandler(changeUserStatusHandler),
);

// Department reassignment crosses department boundaries by definition, so
// it is not delegated to DEPARTMENT_ADMIN — SUPER_ADMIN only.
router.patch(
  "/:id/department",
  requireRole("SUPER_ADMIN"),
  controllerHandler(assignUserDepartmentHandler),
);

// Role assignment: department-scoped like the other mutations, plus an
// additional business rule enforced in user.service.ts (a DEPARTMENT_ADMIN
// may only hand out LAB_ADMIN/FACULTY/STUDENT, never SUPER_ADMIN/peer admin).
router.patch(
  "/:id/role",
  requireRole(...USER_WRITE_ROLES),
  requireDepartmentScope(prisma, (req) => existingUserDepartmentId(requireParam(req, "id")), {
    bypassRoles: ["SUPER_ADMIN"],
  }),
  controllerHandler(assignUserRoleHandler),
);

export default router;
