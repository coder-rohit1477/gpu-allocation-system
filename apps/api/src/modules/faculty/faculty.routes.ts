import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { controllerHandler } from "../../common/http.js";
import {
  getFacultyDashboardHandler,
  getWeeklyLabScheduleHandler,
  listFacultyCoursesHandler,
} from "./faculty.controller.js";

const router: ExpressRouter = Router();

router.use(authenticate);
// Every route in this router is inherently self-scoped (a faculty member's
// own dashboard/courses/department schedule), so FACULTY is the only role
// admitted — mirrors GET /reservations/pending, which is FACULTY-only for
// the same reason rather than bypassable by admin roles.
router.use(requireRole("FACULTY"));

router.get("/dashboard", controllerHandler(getFacultyDashboardHandler));
router.get("/courses", controllerHandler(listFacultyCoursesHandler));
router.get("/labs/schedule", controllerHandler(getWeeklyLabScheduleHandler));

export default router;
