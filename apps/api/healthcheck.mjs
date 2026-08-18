// Used as this image's Docker HEALTHCHECK — see apps/api/Dockerfile. Plain
// Node script rather than curl/wget so the runtime image doesn't need
// either installed. Node 22's built-in fetch is enough.
const port = process.env.PORT ?? "4000";

try {
  const res = await fetch(`http://127.0.0.1:${port}/health`);
  process.exit(res.ok ? 0 : 1);
} catch {
  process.exit(1);
}
