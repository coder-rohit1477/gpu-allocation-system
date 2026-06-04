'use strict';

const auditLogService = require('../../modules/audit-log/service');
const catchAsync      = require('../../utils/catch-async');

/**
 * GET /api/v1/admin/audit-logs?page=1&limit=50   (ADMIN only)
 */
exports.getAllAuditLogs = catchAsync(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);

  const { logs, total } = await auditLogService.getAllLogs({ page, limit });

  res.status(200).json({
    status:  'success',
    results: logs.length,
    meta:    { page, limit, total, pages: Math.ceil(total / limit) },
    data:    { logs },
  });
});
