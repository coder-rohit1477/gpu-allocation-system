import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";

export const createDepartmentSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((value) => value.toUpperCase()),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

// organizationId is intentionally not updatable — moving a department
// between institutions is a structural edge case out of scope here.
export const updateDepartmentSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    code: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export const listDepartmentsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  organizationId: z.string().uuid().optional(),
});
export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;
