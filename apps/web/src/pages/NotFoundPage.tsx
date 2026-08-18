import { Link } from "react-router-dom";
import { Card } from "@gpu/ui";

export function NotFoundPage() {
  return (
    <div className="centered-page">
      <Card>
        <h1>Page not found</h1>
        <p>That page doesn&apos;t exist.</p>
        <Link to="/dashboard">Back to dashboard</Link>
      </Card>
    </div>
  );
}
