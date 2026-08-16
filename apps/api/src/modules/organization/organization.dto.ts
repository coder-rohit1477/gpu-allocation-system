import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((value) => value.toUpperCase()),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = createOrganizationSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const listOrganizationsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
});
export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>;
