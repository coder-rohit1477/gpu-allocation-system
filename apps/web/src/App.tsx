import { useEffect, useState } from "react";
import { Button, Card } from "@gpu/ui";
import { GpuPlatformClient } from "@gpu/sdk";
import type { HealthCheckResult } from "@gpu/types";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const client = new GpuPlatformClient({ baseUrl: apiUrl });

export function App() {
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = () => {
    setError(null);
    client
      .getHealth()
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unknown error"));
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 560 }}>
      <h1>GPU Resource Management Platform</h1>
      <p>Phase 1 foundation — monorepo scaffold, no domain features yet.</p>

      <Card
        style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: 8, marginTop: "1rem" }}
      >
        <h2 style={{ marginTop: 0 }}>API health</h2>
        {health && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(health, null, 2)}</pre>}
        {error && <p style={{ color: "crimson" }}>Could not reach API: {error}</p>}
        <Button onClick={checkHealth}>Re-check health</Button>
      </Card>
    </main>
  );
}
