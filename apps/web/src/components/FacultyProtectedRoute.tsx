import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Card, Skeleton } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";

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

  if (user && user.role !== "FACULTY") {
    return (
      <div className="centered-page">
        <Card>
          <h1>Faculty Portal</h1>
          <p>
            This portal is built for the <strong>FACULTY</strong> role. You&apos;re signed in as{" "}
            <strong>{user.role}</strong>, which doesn&apos;t have access to these pages.
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
