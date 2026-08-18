import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Location } from "react-router-dom";
import { Button, Card } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";
import { errorMessage } from "../lib/errors.js";

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated") {
    const from = (location.state as { from?: Location } | null)?.from;
    return <Navigate to={from?.pathname ?? "/dashboard"} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="centered-page">
      <Card className="login-card">
        <h1>GPU Portal</h1>
        <p className="page-header__description">Sign in with your university account.</p>

        <form className="form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="form__field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="form__field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
