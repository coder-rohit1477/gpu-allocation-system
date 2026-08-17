import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { requireOwnership } from "../../middleware/requireOwnership.js";
import { requireDepartmentScope } from "../../common/requireDepartmentScope.js";
import { controllerHandler, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  approveReservationHandler,
  cancelReservationHandler,
  createReservationHandler,
  listMyReservationsHandler,
  listPendingReservationsHandler,
  rejectReservationHandler,
} from "./reservation.controller.js";
import { findReservationById } from "./reservation.repository.js";

const router: ExpressRouter = Router();

// Students book equipment for themselves; Faculty may also book directly
// (e.g. to run a demo), separately from their approval authority below.
const BOOKING_ROLES = ["STUDENT", "FACULTY"] as const;

async function reservationOwnerId(reservationId: string): Promise<string | null> {
  const reservation = await findReservationById(prisma, reservationId);
  return reservation?.userId ?? null;
}

/**
 * A reservation's "department" for approval-scoping purposes is the
 * department that owns the lab housing its GPU node — mirrors how
 * gpuNode.routes.ts scopes Lab/Department Admin authority, reused here so
 * a FACULTY member can only act on pending reservations for their own
 * department's equipment.
 */
async function reservationDepartmentId(reservationId: string): Promise<string | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { gpuNode: { include: { laboratory: true } } },
  });
  if (!reservation) return null;
  return reservation.gpuNode.laboratory.departmentId;
}

router.use(authenticate);

router.post("/", requireRole(...BOOKING_ROLES), controllerHandler(createReservationHandler));
router.get("/me", requireRole(...BOOKING_ROLES), controllerHandler(listMyReservationsHandler));

router.get("/pending", requireRole("FACULTY"), controllerHandler(listPendingReservationsHandler));

router.patch(
  "/:id/approve",
  requireRole("FACULTY"),
  requireDepartmentScope(prisma, (req) => reservationDepartmentId(requireParam(req, "id"))),
  controllerHandler(approveReservationHandler),
);

router.patch(
  "/:id/reject",
  requireRole("FACULTY"),
  requireDepartmentScope(prisma, (req) => reservationDepartmentId(requireParam(req, "id"))),
  controllerHandler(rejectReservationHandler),
);

router.delete(
  "/:id",
  requireRole(...BOOKING_ROLES),
  requireOwnership((req) => reservationOwnerId(requireParam(req, "id"))),
  controllerHandler(cancelReservationHandler),
);

export default router;
