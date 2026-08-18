import { z } from "zod";

export const gpuUtilizationQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  labId: z.string().uuid().optional(),
});
export type GpuUtilizationQuery = z.infer<typeof gpuUtilizationQuerySchema>;

export const topCoursesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type TopCoursesQuery = z.infer<typeof topCoursesQuerySchema>;

const reportFormatSchema = z.enum(["json", "csv"]).default("json");

export const dailyReportQuerySchema = z.object({
  date: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(90).default(14),
  format: reportFormatSchema,
});
export type DailyReportQuery = z.infer<typeof dailyReportQuerySchema>;

export const weeklyReportQuerySchema = z.object({
  weekOf: z.coerce.date().optional(),
  weeks: z.coerce.number().int().min(1).max(52).default(8),
  format: reportFormatSchema,
});
export type WeeklyReportQuery = z.infer<typeof weeklyReportQuerySchema>;

export const monthlyReportQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format")
    .optional(),
  months: z.coerce.number().int().min(1).max(24).default(6),
  format: reportFormatSchema,
});
export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;
