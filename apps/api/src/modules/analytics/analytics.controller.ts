import type { Request, Response } from "express";
import { ReservationStatus as ReservationStatusEnum } from "@prisma/client";
import { ok } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import { toCsv } from "./csv.js";
import * as analyticsService from "./analytics.service.js";
import type { Report } from "./analytics.service.js";
import {
  dailyReportQuerySchema,
  gpuUtilizationQuerySchema,
  monthlyReportQuerySchema,
  topCoursesQuerySchema,
  weeklyReportQuerySchema,
} from "./analytics.dto.js";

export async function getUniversityAnalyticsHandler(_req: Request, res: Response): Promise<void> {
  const result = await analyticsService.getUniversityAnalytics(prisma);
  ok(res, result);
}

export async function listDepartmentAnalyticsHandler(_req: Request, res: Response): Promise<void> {
  const result = await analyticsService.listDepartmentAnalytics(prisma);
  ok(res, { items: result });
}

export async function getGpuUtilizationHandler(req: Request, res: Response): Promise<void> {
  const query = gpuUtilizationQuerySchema.parse(req.query);
  const result = await analyticsService.getGpuUtilization(prisma, query);
  ok(res, { items: result });
}

export async function getStudentsAnalyticsHandler(_req: Request, res: Response): Promise<void> {
  const result = await analyticsService.getStudentsAnalytics(prisma);
  ok(res, result);
}

export async function listTopCoursesHandler(req: Request, res: Response): Promise<void> {
  const query = topCoursesQuerySchema.parse(req.query);
  const result = await analyticsService.listTopCourses(prisma, query);
  ok(res, { items: result });
}

const REPORT_STATUS_COLUMNS = Object.values(ReservationStatusEnum);

function reportToCsv(report: Report): string {
  const headers = [
    "periodStart",
    "periodEnd",
    "reservationsCreated",
    "totalComputeHours",
    ...REPORT_STATUS_COLUMNS.map((status) => `status_${status}`),
  ];
  const rows = report.buckets.map((bucket) => [
    bucket.periodStart,
    bucket.periodEnd,
    String(bucket.reservationsCreated),
    String(bucket.totalComputeHours),
    ...REPORT_STATUS_COLUMNS.map((status) => String(bucket.reservationsByStatus[status])),
  ]);
  return toCsv(headers, rows);
}

function sendReport(res: Response, report: Report, filename: string, format: "json" | "csv"): void {
  if (format === "csv") {
    res
      .status(200)
      .type("text/csv")
      .set("Content-Disposition", `attachment; filename="${filename}"`)
      .send(reportToCsv(report));
    return;
  }
  ok(res, report);
}

export async function getDailyReportHandler(req: Request, res: Response): Promise<void> {
  const query = dailyReportQuerySchema.parse(req.query);
  const report = await analyticsService.getDailyReport(prisma, query);
  sendReport(res, report, "daily-report.csv", query.format);
}

export async function getWeeklyReportHandler(req: Request, res: Response): Promise<void> {
  const query = weeklyReportQuerySchema.parse(req.query);
  const report = await analyticsService.getWeeklyReport(prisma, query);
  sendReport(res, report, "weekly-report.csv", query.format);
}

export async function getMonthlyReportHandler(req: Request, res: Response): Promise<void> {
  const query = monthlyReportQuerySchema.parse(req.query);
  const report = await analyticsService.getMonthlyReport(prisma, query);
  sendReport(res, report, "monthly-report.csv", query.format);
}
