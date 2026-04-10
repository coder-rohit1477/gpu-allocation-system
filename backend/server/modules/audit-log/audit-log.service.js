const AuditLog = require('../../models/audit-log.model');

/**
 * Create an audit log entry. Errors are swallowed so audit failures
 * never crash the main request.
 */
exports.createLog = async (actorId, action, details = {}, level = 'INFO') => {
  try {
    const log = await AuditLog.create({ actorId, action, details, level });
    return log;
  } catch (err) {
    console.error('[AuditLog] Failed to create entry:', err.message);
    return null;
  }
};

/**
 * Retrieve all audit logs, newest first, with actor details.
 */
exports.getAllLogs = async () => {
  try {
    return await AuditLog.find({})
      .sort('-createdAt')
      .populate('actorId', 'username role');
  } catch (err) {
    console.error('[AuditLog] Failed to retrieve logs:', err.message);
    return [];
  }
};
