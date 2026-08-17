import { z } from "zod";
import { ReservationStatus } from "@prisma/client";
import { paginationQuerySchema } from "../../common/pagination.js";

// Exactly one of gpuNodeId (direct booking of a specific node) or labId
// (Smart GPU Allocator picks the best-fit ONLINE node in that lab) must be
// given — see allocator.service.ts for the selection heuristic.
export const createReservationSchema = z
  .object({
    gpuNodeId: z.string().uuid().optional(),
    labId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    purpose: z.string().trim().min(1).max(500),
    // Only consulted by the smart-allocation (labId) path.
    minGpuCount: z.coerce.number().int().min(1).max(64).optional(),
    minMemoryGB: z.coerce.number().int().min(1).max(4096).optional(),
  })
  .refine((data) => Boolean(data.gpuNodeId) !== Boolean(data.labId), {
    message: "Provide exactly one of gpuNodeId (direct booking) or labId (smart allocation)",
    path: ["gpuNodeId"],
  })
  .refine((data) => data.endTime.getTime() > data.startTime.getTime(), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });
export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const listMyReservationsQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(ReservationStatus).optional(),
});
export type ListMyReservationsQuery = z.infer<typeof listMyReservationsQuerySchema>;

export const listPendingReservationsQuerySchema = paginationQuerySchema;
export type ListPendingReservationsQuery = z.infer<typeof listPendingReservationsQuerySchema>;

export const rejectReservationSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
export type RejectReservationInput = z.infer<typeof rejectReservationSchema>;

export const gpuNodeAvailabilityQuerySchema = z
  .object({
    labId: z.string().uuid().optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    minGpuCount: z.coerce.number().int().min(1).max(64).optional(),
    minMemoryGB: z.coerce.number().int().min(1).max(4096).optional(),
  })
  .refine((data) => Boolean(data.startTime) === Boolean(data.endTime), {
    message: "startTime and endTime must be provided together",
    path: ["endTime"],
  })
  .refine(
    (data) => !data.startTime || !data.endTime || data.endTime.getTime() > data.startTime.getTime(),
    { message: "endTime must be after startTime", path: ["endTime"] },
  );
export type GpuNodeAvailabilityQuery = z.infer<typeof gpuNodeAvailabilityQuerySchema>;

export const laboratoryCalendarQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((data) => !data.from || !data.to || data.to.getTime() > data.from.getTime(), {
    message: "to must be after from",
    path: ["to"],
  });
export type LaboratoryCalendarQuery = z.infer<typeof laboratoryCalendarQuerySchema>;
