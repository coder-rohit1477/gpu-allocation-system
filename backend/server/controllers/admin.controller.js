const GpuResource = require('../models/gpu-resource.model');
const GpuRequest = require('../models/gpu-request.model');
const User = require('../models/user.model');
const catchAsync = require('../utils/catch-async');

/**
 * GET /api/v1/admin/summary
 * Returns a high-level dashboard summary for ADMINs.
 */
exports.getDashboardSummary = catchAsync(async (req, res, next) => {
  // Run all count queries in parallel for performance
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
