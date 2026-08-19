import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProductionNodeEnv = nodeEnv === "production";

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(","),

  auth: {
    accessTokenSecret: required("JWT_ACCESS_SECRET"),
    // Kept as a single numeric source of truth so the JWT `expiresIn` claim
    // and the access-token cookie's `maxAge` can never drift apart.
    accessTokenTtlMinutes: Number(process.env.JWT_ACCESS_TTL_MINUTES ?? 15),
    // Opaque refresh tokens are hashed with HMAC-SHA256 before storage; this
    // secret is the HMAC key, not a JWT-signing key.
    refreshTokenPepper: required("REFRESH_TOKEN_PEPPER"),
    refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
    cookieDomain: process.env.COOKIE_DOMAIN,
    // The `Secure` cookie attribute requires HTTPS — Chromium treats
    // `localhost` as a secure context and sends/stores Secure cookies over
    // plain HTTP there anyway, but Safari does not, so it silently drops
    // the cookie and every authenticated request after login 401s. Defaults
    // to NODE_ENV=production (unchanged behavior for a real TLS-terminated
    // deploy); set COOKIE_SECURE=false to run this same production Docker
    // topology locally over plain HTTP (e.g. against http://localhost with
    // no TLS-terminating proxy in front). Decoupled from `isProduction`
    // itself (below) since that also governs unrelated things like log
    // level, which should stay tied to NODE_ENV regardless of transport.
    // "" counts as unset too, not just undefined — Docker Compose's
    // `${COOKIE_SECURE:-}` interpolation always injects the key with an
    // empty string when the host-side .env doesn't set it, rather than
    // omitting it, so `undefined`-only would silently disable Secure
    // cookies for every real production deploy that never touches this var.
    secureCookies: !process.env.COOKIE_SECURE
      ? isProductionNodeEnv
      : process.env.COOKIE_SECURE === "true",
  },

  telemetry: {
    // Shared-secret header check for node-agent telemetry ingestion
    // (POST /telemetry/heartbeat, /telemetry/metrics). Deliberately not part
    // of `auth` above: this is a separate, additive guard for machine-to-
    // machine calls with no browser session, not a change to user auth.
    ingestToken: required("TELEMETRY_INGEST_TOKEN"),
    onlineThresholdSeconds: Number(process.env.TELEMETRY_ONLINE_THRESHOLD_SECONDS ?? 30),
    degradedThresholdSeconds: Number(process.env.TELEMETRY_DEGRADED_THRESHOLD_SECONDS ?? 90),
  },
};

export const isProduction = isProductionNodeEnv;
