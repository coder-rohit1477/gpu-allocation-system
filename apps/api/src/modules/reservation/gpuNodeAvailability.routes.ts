import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { controllerHandler } from "../../common/http.js";
import { getGpuNodeAvailabilityHandler } from "./reservation.controller.js";

// Mounted at the same "/api/v1/gpu-nodes" prefix as Phase 4's admin
// gpuNode router and Phase 5's gpuNodeHealth router, and registered before
// both in app.ts: "/availability" must be matched here before it can ever
// reach the admin router's GET "/:id" (which would otherwise swallow it as
// id="availability"). Same reasoning as gpuNodeHealth.routes.ts — this file
// lives in modules/reservation/, so neither the admin nor telemetry module
// is touched.

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
  "/availability",
  requireRole(...ANY_AUTHENTICATED_ROLE),
  controllerHandler(getGpuNodeAvailabilityHandler),
);

export default router;
