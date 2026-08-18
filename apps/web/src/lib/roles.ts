import type { UserRole } from "@gpu/types";

/** Each role's own portal landing page — used for the "/" redirect and the
 * post-login redirect, so a non-STUDENT user is never routed to a portal
 * gated to a different role (see ProtectedRoute/AdminProtectedRoute/
 * FacultyProtectedRoute, each of which shows a plain "not built for your
 * role" message rather than a broken/empty page for anyone else). */
export function defaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "FACULTY":
      return "/faculty/dashboard";
    case "SUPER_ADMIN":
    case "DEPARTMENT_ADMIN":
    case "LAB_ADMIN":
      return "/admin/analytics";
    case "STUDENT":
      return "/dashboard";
  }
}
