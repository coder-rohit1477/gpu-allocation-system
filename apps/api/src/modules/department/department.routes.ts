import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { requireDepartmentScope } from "../../common/requireDepartmentScope.js";
import { controllerHandler, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  createDepartmentHandler,
  deleteDepartmentHandler,
  getDepartmentHandler,
  listDepartmentsHandler,
  updateDepartmentHandler,
} from "./department.controller.js";
import { findDepartmentById } from "./department.repository.js";

const router: ExpressRouter = Router();

const ANY_AUTHENTICATED_ROLE = [
  "SUPER_ADMIN",
  "DEPARTMENT_ADMIN",
  "LAB_ADMIN",
  "FACULTY",
  "STUDENT",
] as const;

router.use(authenticate);

router.get("/", requireRole(...ANY_AUTHENTICATED_ROLE), controllerHandler(listDepartmentsHandler));
router.get("/:id", requireRole(...ANY_AUTHENTICATED_ROLE), controllerHandler(getDepartmentHandler));

// Creating/deleting a department is an institution-wide structural change.
router.post("/", requireRole("SUPER_ADMIN"), controllerHandler(createDepartmentHandler));
router.delete("/:id", requireRole("SUPER_ADMIN"), controllerHandler(deleteDepartmentHandler));

// Updating a department's own name/code may be delegated to that
// department's own admin, scoped to their department only.
router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "DEPARTMENT_ADMIN"),
  requireDepartmentScope(
    prisma,
    async (req) => {
      const department = await findDepartmentById(prisma, requireParam(req, "id"));
      return department?.id ?? null;
    },
    { bypassRoles: ["SUPER_ADMIN"] },
  ),
  controllerHandler(updateDepartmentHandler),
);

export default router;
