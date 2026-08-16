import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
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
  },
};

export const isProduction = env.nodeEnv === "production";
