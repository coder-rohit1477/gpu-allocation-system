import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { requireDepartmentScope } from "../../common/requireDepartmentScope.js";
import { controllerHandler, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  createLaboratoryHandler,
  deleteLaboratoryHandler,
  getLaboratoryHandler,
  listLaboratoriesHandler,
  updateLaboratoryHandler,
} from "./laboratory.controller.js";
import { findLaboratoryById } from "./laboratory.repository.js";

const router: ExpressRouter = Router();

const ANY_AUTHENTICATED_ROLE = [
  "SUPER_ADMIN",
  "DEPARTMENT_ADMIN",
  "LAB_ADMIN",
  "FACULTY",
  "STUDENT",
] as const;

router.use(authenticate);

router.get("/", requireRole(...ANY_AUTHENTICATED_ROLE), controllerHandler(listLaboratoriesHandler));
router.get("/:id", requireRole(...ANY_AUTHENTICATED_ROLE), controllerHandler(getLaboratoryHandler));

router.post(
  "/",
  requireRole("SUPER_ADMIN", "DEPARTMENT_ADMIN"),
  requireDepartmentScope(
    prisma,
    (req) => (req.body as { departmentId?: string }).departmentId ?? null,
    {
      bypassRoles: ["SUPER_ADMIN"],
    },
  ),
  controllerHandler(createLaboratoryHandler),
);

router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "DEPARTMENT_ADMIN", "LAB_ADMIN"),
  requireDepartmentScope(
    prisma,
    async (req) =>
      (await findLaboratoryById(prisma, requireParam(req, "id")))?.departmentId ?? null,
    { bypassRoles: ["SUPER_ADMIN"] },
  ),
  controllerHandler(updateLaboratoryHandler),
);

router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "DEPARTMENT_ADMIN"),
  requireDepartmentScope(
    prisma,
    async (req) =>
      (await findLaboratoryById(prisma, requireParam(req, "id")))?.departmentId ?? null,
    { bypassRoles: ["SUPER_ADMIN"] },
  ),
  controllerHandler(deleteLaboratoryHandler),
);

export default router;
