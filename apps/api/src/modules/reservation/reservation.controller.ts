import type { Request, Response } from "express";
import { ok, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import * as reservationService from "./reservation.service.js";
import {
  createReservationSchema,
  gpuNodeAvailabilityQuerySchema,
  laboratoryCalendarQuerySchema,
  listMyReservationsQuerySchema,
  listPendingReservationsQuerySchema,
  rejectReservationSchema,
} from "./reservation.dto.js";

const CALENDAR_DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function createReservationHandler(req: Request, res: Response): Promise<void> {
  const input = createReservationSchema.parse(req.body);
  const reservation = await reservationService.createReservation(prisma, req.user!.id, input);
  ok(res, reservation, 201);
}

export async function listMyReservationsHandler(req: Request, res: Response): Promise<void> {
  const query = listMyReservationsQuerySchema.parse(req.query);
  const result = await reservationService.listMyReservations(prisma, req.user!.id, query);
  ok(res, result);
}

export async function cancelReservationHandler(req: Request, res: Response): Promise<void> {
  const reservation = await reservationService.cancelReservation(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
  );
  ok(res, reservation);
}

export async function listPendingReservationsHandler(req: Request, res: Response): Promise<void> {
  const query = listPendingReservationsQuerySchema.parse(req.query);
  const result = await reservationService.listPendingReservationsForFaculty(
    prisma,
    req.user!.id,
    query,
  );
  ok(res, result);
}

export async function approveReservationHandler(req: Request, res: Response): Promise<void> {
  const reservation = await reservationService.approveReservation(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
  );
  ok(res, reservation);
}

export async function rejectReservationHandler(req: Request, res: Response): Promise<void> {
  const input = rejectReservationSchema.parse(req.body ?? {});
  const reservation = await reservationService.rejectReservation(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, reservation);
}

export async function getGpuNodeAvailabilityHandler(req: Request, res: Response): Promise<void> {
  const query = gpuNodeAvailabilityQuerySchema.parse(req.query);
  const items = await reservationService.getGpuNodeAvailability(prisma, query);
  ok(res, { items });
}

export async function getLaboratoryCalendarHandler(req: Request, res: Response): Promise<void> {
  const query = laboratoryCalendarQuerySchema.parse(req.query);
  const from = query.from ?? new Date();
  const to = query.to ?? new Date(from.getTime() + CALENDAR_DEFAULT_WINDOW_MS);
  const result = await reservationService.getLaboratoryCalendar(prisma, requireParam(req, "id"), {
    from,
    to,
  });
  ok(res, result);
}
