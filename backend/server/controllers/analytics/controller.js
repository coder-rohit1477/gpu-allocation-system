const GpuRequest = require('../../models/gpu-request/model');
const GpuResource = require('../../models/gpu-resource/model');
const catchAsync = require('../../utils/catch-async');

/**
 * GET /api/v1/analytics/usage
 */
exports.getUsageAnalytics = catchAsync(async (req, res, next) => {
  // Run all queries in parallel
  const [
    totalRequests,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    totalGpus,
    allocatedGpus,
  ] = await Promise.all([
    GpuRequest.countDocuments(),
    GpuRequest.countDocuments({ status: 'PENDING' }),
    GpuRequest.countDocuments({ status: 'APPROVED' }),
    GpuRequest.countDocuments({ status: 'REJECTED' }),
    GpuResource.countDocuments(),
    GpuResource.countDocuments({ status: 'Allocated' }),
  ]);

  const utilizationRate = totalGpus > 0
    ? ((allocatedGpus / totalGpus) * 100).toFixed(2)
    : '0.00';

  res.status(200).json({
    status: 'success',
    data: {
      gpuUtilization: {
        total:           totalGpus,
        allocated:       allocatedGpus,
        available:       totalGpus - allocatedGpus,
        utilizationRate: `${utilizationRate}%`,
      },
      requestDistribution: {
        total:    totalRequests,
        pending:  pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
      },
    },
  });
});
