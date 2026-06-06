'use strict';

const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const config   = require('../../config/env');
const User     = require('../../models/user/model');
const auditLogService = require('../../modules/audit-log/service');
const catchAsync = require('../../utils/catch-async');
const AppError   = require('../../utils/app-error');

// ─── Token helpers ────────────────────────────────────────────────────────────

const signAccessToken = (user) =>
  jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

const signRefreshToken = () => crypto.randomBytes(40).toString('hex');

/**
 * Send both tokens.
 * Access token → JSON body (frontend stores in memory / localStorage).
 * Refresh token → httpOnly cookie (cannot be read by JS — XSS-resistant).
 */
const sendTokens = (res, statusCode, user) => {
  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken();

  // Store the hashed refresh token on the user document (never the raw token)
  // We do a fire-and-forget update — if it fails, the user just needs to re-login.
  const hashed = crypto.createHash('sha256').update(refreshToken).digest('hex');
  User.findByIdAndUpdate(user._id, {
    refreshToken:          hashed,
    refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }).exec().catch((err) => console.error('[auth] Failed to persist refresh token:', err.message));

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure:   config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(statusCode).json({
    status: 'success',
    token:  accessToken,
  });
};

// ─── Public: Signup ───────────────────────────────────────────────────────────
/**
 * POST /api/v1/auth/signup
 *
 * SECURITY: Public signup always creates a STUDENT account.
 * ADMIN and FACULTY accounts must be created by an ADMIN via POST /api/v1/admin/users.
 * Accepting a role field here would allow privilege escalation.
 */
exports.signup = catchAsync(async (req, res, next) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password        : '';

  if (!username || !password) {
    return next(new AppError('Please provide both username and password.', 400));
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return next(new AppError('Username is already taken. Please choose another.', 400));
  }

  // role is intentionally NOT read from req.body — always STUDENT
  const user = await User.create({ username, password, role: 'STUDENT' });
  sendTokens(res, 201, user);
});

// ─── Public: Login ────────────────────────────────────────────────────────────
exports.login = catchAsync(async (req, res, next) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password        : '';

  console.log(`[auth] Login attempt for username: "${username}"`);

  if (!username || !password) {
    return next(new AppError('Please provide both username and password.', 400));
  }

  const user = await User.findOne({ username }).select('+password');
  
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect username or password.', 401));
  }

  await auditLogService.createLog(user._id, 'USER_LOGIN', {
    username: user.username,
    role: user.role,
  });

  sendTokens(res, 200, user);
});

// ─── Public: Refresh ─────────────────────────────────────────────────────────
/**
 * POST /api/v1/auth/refresh
 * Reads the httpOnly cookie, validates the hashed token, issues a new access token.
 */
exports.refresh = catchAsync(async (req, res, next) => {
  const raw = req.cookies?.refreshToken;
  if (!raw) return next(new AppError('No refresh token provided.', 401));

  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  const user   = await User.findOne({
    refreshToken:          hashed,
    refreshTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    return next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
  }

  const accessToken = signAccessToken(user);
  res.status(200).json({ status: 'success', token: accessToken });
});

// ─── Authenticated: Logout ────────────────────────────────────────────────────
exports.logout = catchAsync(async (req, res, next) => {
  // Clear the DB record so the refresh token can never be reused
  if (req.user?._id) {
    await User.findByIdAndUpdate(req.user._id, {
      refreshToken:          null,
      refreshTokenExpiresAt: null,
    }).exec().catch(() => {});

    await auditLogService.createLog(req.user._id, 'USER_LOGOUT', {
      username: req.user.username,
      role: req.user.role,
    });
  }

  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure:   config.nodeEnv === 'production',
    sameSite: 'strict',
    expires:  new Date(0),
  });

  res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
});
