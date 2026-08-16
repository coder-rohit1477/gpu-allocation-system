import { z } from "zod";
import { GpuStatus } from "@prisma/client";
import { paginationQuerySchema } from "../../common/pagination.js";

export const createGpuNodeSchema = z.object({
  labId: z.string().uuid(),
  hostname: z.string().trim().min(1).max(255),
  gpuModel: z.string().trim().min(1).max(100),
  gpuCount: z.coerce.number().int().min(1).max(64),
  totalMemoryGB: z.coerce.number().int().min(1).max(4096),
  cpuCores: z.coerce.number().int().min(1).max(1024),
  ramGB: z.coerce.number().int().min(1).max(16384),
  status: z.nativeEnum(GpuStatus).optional(),
});
export type CreateGpuNodeInput = z.infer<typeof createGpuNodeSchema>;

// labId is intentionally not updatable here — physically relocating a node
// to a different lab is an inventory-transfer operation out of this
// phase's scope, not a routine hardware edit.
export const updateGpuNodeSchema = z
  .object({
    hostname: z.string().trim().min(1).max(255).optional(),
    gpuModel: z.string().trim().min(1).max(100).optional(),
    gpuCount: z.coerce.number().int().min(1).max(64).optional(),
    totalMemoryGB: z.coerce.number().int().min(1).max(4096).optional(),
    cpuCores: z.coerce.number().int().min(1).max(1024).optional(),
    ramGB: z.coerce.number().int().min(1).max(16384).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateGpuNodeInput = z.infer<typeof updateGpuNodeSchema>;

export const changeGpuNodeStatusSchema = z.object({
  status: z.nativeEnum(GpuStatus),
});
export type ChangeGpuNodeStatusInput = z.infer<typeof changeGpuNodeStatusSchema>;

export const updateGpuNodeHeartbeatSchema = z.object({
  lastHeartbeat: z.coerce.date().optional(),
});
export type UpdateGpuNodeHeartbeatInput = z.infer<typeof updateGpuNodeHeartbeatSchema>;

export const listGpuNodesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  labId: z.string().uuid().optional(),
  status: z.nativeEnum(GpuStatus).optional(),
});
export type ListGpuNodesQuery = z.infer<typeof listGpuNodesQuerySchema>;
