require('dotenv').config();

const getRequiredEnv = (key) => {
  const value = process.env[key]?.trim();

  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }

  return value;
};

const parsePort = (value) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : 5001;
};

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:80')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  allowedOrigins,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  mongoUri: getRequiredEnv('MONGODB_URI'),
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parsePort(process.env.PORT),
};
