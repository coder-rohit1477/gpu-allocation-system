import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";
import { paginationQuerySchema } from "../../common/pagination.js";

export const createUserSchema = z
  .object({
    universityId: z.string().trim().min(1).max(50),
    fullName: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().email(),
    role: z.nativeEnum(UserRole),
    // Institution-wide roles (SUPER_ADMIN) have no department; every other
    // role must belong to one — enforced below via refine.
    departmentId: z.string().uuid().nullable().optional(),
    // Optional: admin sets a known initial password. If omitted, the service
    // generates a random one-time temporary password and returns it once.
    password: z.string().min(8).max(200).optional(),
  })
  .refine(
    (data) => (data.role === "SUPER_ADMIN" ? !data.departmentId : Boolean(data.departmentId)),
    {
      message:
        "departmentId is required for every role except SUPER_ADMIN, and must be omitted for SUPER_ADMIN",
      path: ["departmentId"],
    },
  );
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export const changeUserStatusSchema = z.object({ status: z.nativeEnum(UserStatus) });
export type ChangeUserStatusInput = z.infer<typeof changeUserStatusSchema>;

export const assignUserDepartmentSchema = z.object({ departmentId: z.string().uuid().nullable() });
export type AssignUserDepartmentInput = z.infer<typeof assignUserDepartmentSchema>;

export const assignUserRoleSchema = z.object({ role: z.nativeEnum(UserRole) });
export type AssignUserRoleInput = z.infer<typeof assignUserRoleSchema>;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
  departmentId: z.string().uuid().optional(),
  status: z.nativeEnum(UserStatus).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
