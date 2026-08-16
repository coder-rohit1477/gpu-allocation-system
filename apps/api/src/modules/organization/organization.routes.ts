import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { controllerHandler } from "../../common/http.js";
import {
  createOrganizationHandler,
  getOrganizationHandler,
  listOrganizationsHandler,
  updateOrganizationHandler,
} from "./organization.controller.js";

const router: ExpressRouter = Router();

const ANY_AUTHENTICATED_ROLE = [
  "SUPER_ADMIN",
  "DEPARTMENT_ADMIN",
  "LAB_ADMIN",
  "FACULTY",
  "STUDENT",
] as const;

router.use(authenticate);

// Reads: any authenticated role — organization name/code is not sensitive.
router.get(
  "/",
  requireRole(...ANY_AUTHENTICATED_ROLE),
  controllerHandler(listOrganizationsHandler),
);
router.get(
  "/:id",
  requireRole(...ANY_AUTHENTICATED_ROLE),
  controllerHandler(getOrganizationHandler),
);

// Writes: institution-wide structural changes — SUPER_ADMIN only.
router.post("/", requireRole("SUPER_ADMIN"), controllerHandler(createOrganizationHandler));
router.patch("/:id", requireRole("SUPER_ADMIN"), controllerHandler(updateOrganizationHandler));

export default router;
