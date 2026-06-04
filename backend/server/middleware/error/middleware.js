const AppError = require('../../utils/app-error');

// ─── DB / JWT error transformers ─────────────────────────────────────────────

const handleCastErrorDB = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}.`, 400);

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const value = err.keyValue?.[field];
  return new AppError(`Duplicate value '${value}' for field '${field}'. Please use another value.`, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError(`Invalid input data. ${errors.join('. ')}`, 400);
};

const handleJWTError       = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);
const handleBodyParserError = () => new AppError('Invalid JSON payload.', 400);

// ─── Senders ─────────────────────────────────────────────────────────────────

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status:  err.status,
    message: err.message,
    error:   err,
    stack:   err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status:  err.status,
      message: err.message,
    });
  }
  // Programming / unknown errors — don't leak details
  console.error('ERROR 💥', err);
  res.status(500).json({
    status:  'error',
    message: 'Something went wrong. Please try again later.',
  });
};

// ─── Global error handler ────────────────────────────────────────────────────

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status     = err.status     || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
    error.message = err.message;

    if (error.name  === 'CastError')        error = handleCastErrorDB(error);
    if (error.code  === 11000)              error = handleDuplicateFieldsDB(error);
    if (error.name  === 'ValidationError')  error = handleValidationErrorDB(error);
    if (error.name  === 'JsonWebTokenError')  error = handleJWTError();
    if (error.name  === 'TokenExpiredError')  error = handleJWTExpiredError();
    if (error.type  === 'entity.parse.failed') error = handleBodyParserError();

    sendErrorProd(error, res);
  }
};
