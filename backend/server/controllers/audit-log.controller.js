const auditLogService = require('../modules/audit-log/audit-log.service');
const catchAsync = require('../utils/catch-async');

/**
 * GET /api/v1/admin/audit-logs   (ADMIN only)
 */
exports.getAllAuditLogs = catchAsync(async (req, res, next) => {
  const logs = await auditLogService.getAllLogs();
  res.status(200).json({
    status:  'success',
    results: logs.length,
    data:    { logs },
  });
});
