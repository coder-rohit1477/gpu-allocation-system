import { Navigate } from "react-router-dom";
import { Skeleton } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";
import { defaultRouteForRole } from "../lib/roles.js";

/**
 * Handles "/" — previously hardcoded to redirect into the student portal
 * regardless of role, which meant a signed-in FACULTY or admin-tier user
 * landing on "/" saw ProtectedRoute's "built for STUDENT" message instead
 * of ever reaching their own portal. Each role now lands on its own
 * default page (see lib/roles.ts).
 */
export function RoleHomeRedirect() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <div className="app-shell app-shell--loading" aria-busy="true" aria-label="Loading session">
        <Skeleton height="100%" />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={defaultRouteForRole(user.role)} replace />;
}
