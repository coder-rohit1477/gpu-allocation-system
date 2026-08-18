import { Link } from "react-router-dom";
import { Card } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";
import { defaultRouteForRole } from "../lib/roles.js";

export function NotFoundPage() {
  const { user } = useAuth();

  return (
    <div className="centered-page">
      <Card>
        <h1>Page not found</h1>
        <p>That page doesn&apos;t exist.</p>
        <Link to={user ? defaultRouteForRole(user.role) : "/login"}>Back to dashboard</Link>
      </Card>
    </div>
  );
}
