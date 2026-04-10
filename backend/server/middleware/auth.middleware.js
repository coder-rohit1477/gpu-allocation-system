const jwt      = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/user.model');
const catchAsync = require('../utils/catch-async');
const AppError = require('../utils/app-error');

/**
 * protect – verifies JWT and attaches req.user
 */
const protect = catchAsync(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to get access.', 401));
  }

  const decoded = jwt.verify(token, config.jwtSecret);

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  req.user = currentUser;
  next();
});

/**
 * restrictTo – role-based access control
 * Usage: restrictTo('ADMIN', 'FACULTY')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = { protect, restrictTo };
