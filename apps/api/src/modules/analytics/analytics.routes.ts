import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { controllerHandler } from "../../common/http.js";
import {
  getGpuUtilizationHandler,
  getStudentsAnalyticsHandler,
  getUniversityAnalyticsHandler,
  listDepartmentAnalyticsHandler,
  listTopCoursesHandler,
} from "./analytics.controller.js";

const router: ExpressRouter = Router();

// Admin-tier reporting, same role set Phase 4's GPU inventory admin actions
// use (GPU_NODE_ADMIN_ROLES in gpuNode.routes.ts) — analytics aggregates
// cross department/course/student data, which is a step above the
// "any authenticated role can read" bar the plain org/dept/lab/course list
// endpoints use elsewhere in this codebase.
const ANALYTICS_ROLES = ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "LAB_ADMIN"] as const;

router.use(authenticate);
router.use(requireRole(...ANALYTICS_ROLES));

router.get("/university", controllerHandler(getUniversityAnalyticsHandler));
router.get("/departments", controllerHandler(listDepartmentAnalyticsHandler));
router.get("/gpu-utilization", controllerHandler(getGpuUtilizationHandler));
router.get("/students", controllerHandler(getStudentsAnalyticsHandler));
router.get("/courses", controllerHandler(listTopCoursesHandler));

export default router;
