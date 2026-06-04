'use strict';

const GpuResource = require('../../models/gpu-resource/model');
const GpuRequest  = require('../../models/gpu-request/model');
const User        = require('../../models/user/model');
const catchAsync  = require('../../utils/catch-async');
const AppError    = require('../../utils/app-error');

/**
 * GET /api/v1/admin/summary
 */
exports.getDashboardSummary = catchAsync(async (req, res, next) => {
  const [
    totalGpus,
    availableGpus,
    allocatedGpus,
    totalUsers,
    totalRequests,
    pendingRequests,
    approvedRequests,
  ] = await Promise.all([
    GpuResource.countDocuments(),
    GpuResource.countDocuments({ status: 'Available' }),
    GpuResource.countDocuments({ status: 'Allocated' }),
    User.countDocuments(),
    GpuRequest.countDocuments(),
    GpuRequest.countDocuments({ status: 'PENDING' }),
    GpuRequest.countDocuments({ status: 'APPROVED' }),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      totalGpus,
      availableGpus,
      allocatedGpus,
      totalUsers,
      totalRequests,
      pendingRequests,
      approvedRequests,
    },
  });
});

/**
 * POST /api/v1/admin/users   (ADMIN only)
 *
 * The ONLY endpoint that can create FACULTY or ADMIN accounts.
 * Public signup always creates STUDENT — this is the privileged path.
 */
exports.createUser = catchAsync(async (req, res, next) => {
  const ALLOWED_ROLES = new Set(['STUDENT', 'FACULTY', 'ADMIN']);

  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password        : '';
  const role     = typeof req.body.role     === 'string' ? req.body.role.trim().toUpperCase() : '';

  if (!username || !password || !role) {
    return next(new AppError('Please provide username, password, and role.', 400));
  }
  if (!ALLOWED_ROLES.has(role)) {
    return next(new AppError(`Invalid role. Must be one of: ${[...ALLOWED_ROLES].join(', ')}.`, 400));
  }

  const existing = await User.findOne({ username });
  if (existing) {
    return next(new AppError('Username is already taken.', 400));
  }

  const user = await User.create({ username, password, role });

  res.status(201).json({
    status: 'success',
    data: {
      user: {
        id:       user._id,
        username: user.username,
        role:     user.role,
      },
    },
  });
});
