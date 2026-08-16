import { z } from "zod";
import { paginationQuerySchema } from "../../common/pagination.js";

export const createCourseSchema = z.object({
  courseCode: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((value) => value.toUpperCase()),
  courseName: z.string().trim().min(1).max(200),
  semester: z.string().trim().min(1).max(50),
  facultyId: z.string().uuid(),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

// courseCode is intentionally not updatable — it is the course's natural
// identifier; fixing a typo means deleting and recreating the course.
export const updateCourseSchema = z
  .object({
    courseName: z.string().trim().min(1).max(200).optional(),
    semester: z.string().trim().min(1).max(50).optional(),
    facultyId: z.string().uuid().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const listCoursesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  facultyId: z.string().uuid().optional(),
  semester: z.string().trim().min(1).optional(),
});
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
