import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Skeleton } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";
import { defaultRouteForRole } from "../lib/roles.js";

// Mirrors ProtectedRoute.tsx/AdminProtectedRoute.tsx's shape exactly, but
// for the faculty portal — a new, independent component rather than
// parameterizing either existing one, so neither is touched. FACULTY is
// the only role admitted: every /api/v1/faculty/* route is FACULTY-only
// server-side too (see faculty.routes.ts), so an admin role would only
// ever see 403s here, not useful data.
export function FacultyProtectedRoute({ children }: { children: ReactNode }) {
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

  // A signed-in non-FACULTY user (e.g. SUPER_ADMIN manually opening
  // /faculty/dashboard) is redirected to their own portal rather than
  // stranded here with a "wrong role" message.
  if (user && user.role !== "FACULTY") {
    return <Navigate to={defaultRouteForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
