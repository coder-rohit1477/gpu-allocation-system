import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import type { UserRole } from "@gpu/types";
import { Skeleton } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";
import { defaultRouteForRole } from "../lib/roles.js";

// Mirrors ProtectedRoute.tsx's shape exactly, but for the separate admin
// analytics area (Phase 9) rather than the student portal (Phase 8) — a
// new, independent component rather than parameterizing ProtectedRoute, so
// the student portal's gating logic is never touched.
const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "LAB_ADMIN"];

export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="app-shell app-shell--loading" aria-busy="true" aria-label="Loading session">
        <Skeleton height="100%" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // A signed-in non-admin-tier user (e.g. FACULTY manually opening
  // /admin/analytics) is redirected to their own portal rather than
  // stranded here with a "wrong role" message.
  if (user && !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to={defaultRouteForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
