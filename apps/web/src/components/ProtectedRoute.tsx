import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Card, Skeleton } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";

/** Gates the student portal behind a session, and behind the STUDENT role
 * specifically — this portal's pages assume a student's own data (GET
 * /reservations/me, etc.), so any other role is shown a plain explanation
 * rather than a confusing empty/broken dashboard. */
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
    return (
      <div className="centered-page">
        <Card>
          <h1>Student Portal</h1>
          <p>
            This portal is built for the <strong>STUDENT</strong> role. You&apos;re signed in as{" "}
            <strong>{user.role}</strong>, which doesn&apos;t have access to these pages.
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
