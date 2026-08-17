import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { controllerHandler } from "../../common/http.js";
import { getLaboratoryCalendarHandler } from "./reservation.controller.js";

// Mounted at the same "/api/v1/laboratories" prefix as Phase 4's admin
// laboratory router. No path collision is possible ("/:id/calendar" has
// two segments, the admin router's "/:id" only one) but this still lives
// in modules/reservation/ and is registered independently, so the admin
// module itself is never touched.

const router: ExpressRouter = Router();

const ANY_AUTHENTICATED_ROLE = [
  "SUPER_ADMIN",
  "DEPARTMENT_ADMIN",
  "LAB_ADMIN",
  "FACULTY",
  "STUDENT",
] as const;

router.use(authenticate);

router.get(
  "/:id/calendar",
  requireRole(...ANY_AUTHENTICATED_ROLE),
  controllerHandler(getLaboratoryCalendarHandler),
);

export default router;
