import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { controllerHandler } from "../../common/http.js";
import {
  getDailyReportHandler,
  getMonthlyReportHandler,
  getWeeklyReportHandler,
} from "./analytics.controller.js";

const router: ExpressRouter = Router();

const ANALYTICS_ROLES = ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "LAB_ADMIN"] as const;

router.use(authenticate);
router.use(requireRole(...ANALYTICS_ROLES));

router.get("/daily", controllerHandler(getDailyReportHandler));
router.get("/weekly", controllerHandler(getWeeklyReportHandler));
router.get("/monthly", controllerHandler(getMonthlyReportHandler));

export default router;
