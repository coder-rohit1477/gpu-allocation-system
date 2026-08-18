import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import type { UserRole } from "@gpu/types";
import { Card, Skeleton } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";

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

  if (user && !ADMIN_ROLES.includes(user.role)) {
    return (
      <div className="centered-page">
        <Card>
          <h1>Admin Analytics</h1>
          <p>
            This area is built for administrator roles (<strong>SUPER_ADMIN</strong>,{" "}
            <strong>DEPARTMENT_ADMIN</strong>, <strong>LAB_ADMIN</strong>). You&apos;re signed in as{" "}
            <strong>{user.role}</strong>, which doesn&apos;t have access to these pages.
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
