import { z } from "zod";
import { LabStatus } from "@prisma/client";
import { paginationQuerySchema } from "../../common/pagination.js";

export const createLaboratorySchema = z.object({
  departmentId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  floor: z.string().trim().min(1).max(20),
  status: z.nativeEnum(LabStatus).optional(),
});
export type CreateLaboratoryInput = z.infer<typeof createLaboratorySchema>;

// departmentId is intentionally not updatable — see department.dto.ts note.
export const updateLaboratorySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    location: z.string().trim().min(1).max(200).optional(),
    floor: z.string().trim().min(1).max(20).optional(),
    status: z.nativeEnum(LabStatus).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateLaboratoryInput = z.infer<typeof updateLaboratorySchema>;

export const listLaboratoriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  departmentId: z.string().uuid().optional(),
  status: z.nativeEnum(LabStatus).optional(),
});
export type ListLaboratoriesQuery = z.infer<typeof listLaboratoriesQuerySchema>;
