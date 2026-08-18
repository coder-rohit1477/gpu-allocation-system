import type { Request, Response } from "express";
import { ok } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import * as facultyService from "./faculty.service.js";
import {
  bulkApproveReservationsSchema,
  bulkRejectReservationsSchema,
  listFacultyCoursesQuerySchema,
  weeklyScheduleQuerySchema,
} from "./faculty.dto.js";

export async function getFacultyDashboardHandler(req: Request, res: Response): Promise<void> {
  const dashboard = await facultyService.getFacultyDashboard(prisma, req.user!.id);
  ok(res, dashboard);
}

export async function listFacultyCoursesHandler(req: Request, res: Response): Promise<void> {
  const query = listFacultyCoursesQuerySchema.parse(req.query);
  const result = await facultyService.listFacultyCourses(prisma, req.user!.id, query);
  ok(res, result);
}

export async function getWeeklyLabScheduleHandler(req: Request, res: Response): Promise<void> {
  const query = weeklyScheduleQuerySchema.parse(req.query);
  const result = await facultyService.getWeeklyLabSchedule(prisma, req.user!.id, query);
  ok(res, result);
}

export async function bulkApproveReservationsHandler(req: Request, res: Response): Promise<void> {
  const input = bulkApproveReservationsSchema.parse(req.body);
  const reservations = await facultyService.bulkApproveReservations(prisma, req.user!.id, input);
  ok(res, { approved: reservations });
}

export async function bulkRejectReservationsHandler(req: Request, res: Response): Promise<void> {
  const input = bulkRejectReservationsSchema.parse(req.body);
  const reservations = await facultyService.bulkRejectReservations(prisma, req.user!.id, input);
  ok(res, { rejected: reservations });
}
