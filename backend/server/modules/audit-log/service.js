'use strict';

const AuditLog = require('../../models/audit-log/model');

/**
 * Create an audit log entry.
 * Errors are swallowed so audit failures never crash the main request.
 */
exports.createLog = async (actorId, action, metadata = {}, level = 'INFO') => {
  try {
    return await AuditLog.create({
      actorId,
      action,
      metadata,
      details: metadata,
      level,
    });
  } catch (err) {
    console.error('[AuditLog] Failed to create entry:', err.message);
    return null;
  }
};

/**
 * Retrieve audit logs — newest first, paginated.
 * @param {{ page: number, limit: number }} options
 * @returns {{ logs: AuditLog[], total: number }}
 */
exports.getAllLogs = async ({ page = 1, limit = 50 } = {}) => {
  try {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find({})
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'username role'),
      AuditLog.countDocuments(),
    ]);
    return { logs, total };
  } catch (err) {
    console.error('[AuditLog] Failed to retrieve logs:', err.message);
    return { logs: [], total: 0 };
  }
};
