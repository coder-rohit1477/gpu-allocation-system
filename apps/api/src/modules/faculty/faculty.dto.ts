import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";

export const listFacultyCoursesQuerySchema = paginationQuerySchema;
export type ListFacultyCoursesQuery = z.infer<typeof listFacultyCoursesQuerySchema>;

export const weeklyScheduleQuerySchema = z.object({
  // Any date within the target week; the service snaps it to that week's
  // Monday. Defaults to the current week when omitted.
  weekOf: z.coerce.date().optional(),
});
export type WeeklyScheduleQuery = z.infer<typeof weeklyScheduleQuerySchema>;

const reservationIdsSchema = z
  .array(z.string().uuid())
  .min(1, "At least one reservationId is required")
  .max(100, "A single bulk operation may include at most 100 reservations");

function withoutDuplicates(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

export const bulkApproveReservationsSchema = z
  .object({ reservationIds: reservationIdsSchema })
  .refine((data) => withoutDuplicates(data.reservationIds), {
    message: "reservationIds must not contain duplicates",
    path: ["reservationIds"],
  });
export type BulkApproveReservationsInput = z.infer<typeof bulkApproveReservationsSchema>;

export const bulkRejectReservationsSchema = z
  .object({
    reservationIds: reservationIdsSchema,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((data) => withoutDuplicates(data.reservationIds), {
    message: "reservationIds must not contain duplicates",
    path: ["reservationIds"],
  });
export type BulkRejectReservationsInput = z.infer<typeof bulkRejectReservationsSchema>;
