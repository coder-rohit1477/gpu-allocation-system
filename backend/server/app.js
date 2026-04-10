const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

const config = require('./config/env');
const apiRoutes = require('./routes');
const AppError = require('./utils/app-error');
const globalErrorHandler = require('./middleware/error.middleware');

const app = express();

app.disable('x-powered-by');

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new AppError('This origin is not allowed by CORS.', 403));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(helmet());

app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'fail',
      message: 'Too many requests from this IP, please try again after 15 minutes.',
    },
  })
);

if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(hpp());

app.use('/api/v1', apiRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ status: 'success', message: 'GPU Manager API is running' });
});

app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
