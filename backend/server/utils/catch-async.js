/**
 * Wraps an async route handler and forwards any rejection to Express's
 * global error handler via next(), eliminating repetitive try-catch blocks.
 */
const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

module.exports = catchAsync;
