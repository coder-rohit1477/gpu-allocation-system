const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/user.model');
const catchAsync = require('../utils/catch-async');
const AppError = require('../utils/app-error');

const ALLOWED_ROLES = new Set(['STUDENT', 'FACULTY', 'ADMIN']);

const signToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

const sendTokenResponse = (res, statusCode, user) => {
  res.status(statusCode).json({
    status: 'success',
    token: signToken(user),
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = typeof req.body.role === 'string' ? req.body.role.trim().toUpperCase() : undefined;

  if (!username || !password) {
    return next(new AppError('Please provide both username and password.', 400));
  }

  if (role && !ALLOWED_ROLES.has(role)) {
    return next(new AppError('Invalid role provided.', 400));
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return next(new AppError('Username is already taken. Please use another one.', 400));
  }

  const user = await User.create({
    username,
    password,
    ...(role ? { role } : {}),
  });

  sendTokenResponse(res, 201, user);
});

exports.login = catchAsync(async (req, res, next) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    return next(new AppError('Please provide both username and password.', 400));
  }

  const user = await User.findOne({ username }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect username or password.', 401));
  }

  sendTokenResponse(res, 200, user);
});
