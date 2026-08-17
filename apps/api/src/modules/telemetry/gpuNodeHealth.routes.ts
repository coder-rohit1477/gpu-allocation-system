import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { controllerHandler } from "../../common/http.js";
import { getGpuNodeHealthHandler, listLiveGpuNodesHandler } from "./telemetry.controller.js";

// Mounted at the same "/api/v1/gpu-nodes" prefix as Phase 4's admin gpuNode
// router, but registered first in app.ts: Express tries routers in
// registration order, so "/live" must be matched here before it ever
// reaches the admin router's "/:id" route (which would otherwise swallow
// it as id="live"). This file lives in modules/telemetry/, not
// modules/gpuNode/, so the admin module itself is never touched.

const router: ExpressRouter = Router();

const ANY_AUTHENTICATED_ROLE = [
  "SUPER_ADMIN",
  "DEPARTMENT_ADMIN",
  "LAB_ADMIN",
  "FACULTY",
  "STUDENT",
] as const;

router.use(authenticate);

router.get("/live", requireRole(...ANY_AUTHENTICATED_ROLE), controllerHandler(listLiveGpuNodesHandler));
router.get(
  "/:id/health",
  requireRole(...ANY_AUTHENTICATED_ROLE),
  controllerHandler(getGpuNodeHealthHandler),
);

export default router;
