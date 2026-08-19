import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Skeleton } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";
import { defaultRouteForRole } from "../lib/roles.js";

/** Gates the student portal behind a session, and behind the STUDENT role
 * specifically — this portal's pages assume a student's own data (GET
 * /reservations/me, etc.). A signed-in non-STUDENT is redirected straight
 * to their own portal (see lib/roles.ts) rather than stranded on this URL
 * with a "wrong role" message — manually opening a page outside your
 * portal should behave the same as "/" or the post-login redirect. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
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

  if (user && user.role !== "STUDENT") {
    return <Navigate to={defaultRouteForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
