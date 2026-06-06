require('dotenv').config();

// ─── Validate all required env vars at startup ────────────────────────────────
// Fail fast with a clear message rather than mysterious runtime errors.
const REQUIRED = ['JWT_SECRET', 'MONGODB_URI'];
const missing  = REQUIRED.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error(`[config] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[config] Copy backend/.env.example to backend/.env and fill in values.');
  process.exit(1);
}

const parsePort = (value) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5001;
};

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:80')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

console.log('Allowed origins:', allowedOrigins);

const rawUri = (process.env.MONGODB_URI || '').trim();
let mongoUri = rawUri;

// If URI is an Atlas or standard URI without a database name path, append pbl_gpu_manager
// e.g., mongodb+srv://user:pass@cluster.mongodb.net/  -> append pbl_gpu_manager
// This handles cases where the user forgot to add the DB name to the connection string.
if (mongoUri && !mongoUri.split('?')[0].split('/').pop()) {
  const [base, query] = mongoUri.split('?');
  mongoUri = `${base}${base.endsWith('/') ? '' : '/'}pbl_gpu_manager${query ? '?' + query : ''}`;
  console.log('[config] Appending default database name "pbl_gpu_manager" to URI');
}

module.exports = {
  allowedOrigins,
  jwtSecret:            process.env.JWT_SECRET.trim(),
  jwtExpiresIn:         process.env.JWT_EXPIRES_IN         || '15m',
  refreshTokenExpiresIn:process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  mongoUri,
  nodeEnv:              process.env.NODE_ENV               || 'development',
  port:                 parsePort(process.env.PORT),
};
