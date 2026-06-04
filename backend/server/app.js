'use strict';

const express      = require('express');
const mongoose     = require('mongoose');
const swaggerUi    = require('swagger-ui-express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const hpp          = require('hpp');

const config             = require('./config/env');
const apiRoutes          = require('./routes');
const openApiDocument    = require('./docs/openapi');
const AppError           = require('./utils/app-error');
const globalErrorHandler = require('./middleware/error/middleware');

const app = express();

const getMongoStatus = () =>
  (mongoose.connection.readyState === 1 ? 'connected' : 'disconnected');

app.disable('x-powered-by');

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin(origin, callback) {
      console.log('Incoming origin:', origin);
      if (!origin || config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new AppError('This origin is not allowed by CORS.', 403));
    },
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());

// ─── Global rate limit (100 req / 15 min per IP across all /api/ routes) ─────
// The login route has its own tighter limiter applied directly in auth.routes.js
app.use(
  '/api/',
  rateLimit({
    windowMs:       15 * 60 * 1000,
    max:            100,
    standardHeaders: true,
    legacyHeaders:  false,
    message: {
      status:  'fail',
      message: 'Too many requests from this IP, please try again after 15 minutes.',
    },
  })
);

// ─── Logging ──────────────────────────────────────────────────────────────────
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());   // required for httpOnly refresh-token cookie
app.use(hpp());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1', apiRoutes);
app.get(/^\/api-docs$/, (_req, res) => {
  res.redirect(301, '/api-docs/');
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

app.get('/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/ready', (_req, res) => {
  const mongodb = getMongoStatus();
  res.status(mongodb === 'connected' ? 200 : 503).json({
    status: mongodb === 'connected' ? 'ok' : 'degraded',
    mongodb,
  });
});

app.get('/health', (_req, res) => {
  const mongodb = getMongoStatus();
  res.status(200).json({
    status: mongodb === 'connected' ? 'ok' : 'degraded',
    mongodb,
    uptime: Math.floor(process.uptime()),
    environment: config.nodeEnv,
  });
});

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'success', message: 'GPU Manager API is running' });
});

app.all('*', (req, _res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(globalErrorHandler);

module.exports = app;
