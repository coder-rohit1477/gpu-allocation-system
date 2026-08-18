import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { controllerHandler } from "../../common/http.js";
import {
  bulkApproveReservationsHandler,
  bulkRejectReservationsHandler,
} from "./faculty.controller.js";

// Mounted at the same "/api/v1/reservations" prefix as Phase 6's
// reservation.routes.ts, the same pattern gpuNodeAvailability.routes.ts and
// laboratoryCalendar.routes.ts already use for a different module reusing an
// existing prefix — kept here in the faculty module (not reservation.routes.ts)
// so the booking engine itself is not touched. No path collision is
// possible: "/bulk-approve" and "/bulk-reject" are single path segments,
// while reservation.routes.ts's approve/reject live under "/:id/approve"
// and "/:id/reject" (two segments).

const router: ExpressRouter = Router();

router.use(authenticate);

router.patch(
  "/bulk-approve",
  requireRole("FACULTY"),
  controllerHandler(bulkApproveReservationsHandler),
);

router.patch(
  "/bulk-reject",
  requireRole("FACULTY"),
  controllerHandler(bulkRejectReservationsHandler),
);

export default router;
