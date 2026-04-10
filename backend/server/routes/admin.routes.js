const express           = require('express');
const adminController   = require('../controllers/admin.controller');
const auditLogController = require('../controllers/audit-log.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const router            = express.Router();

router.get('/summary',    protect, restrictTo('ADMIN'), adminController.getDashboardSummary);
router.get('/audit-logs', protect, restrictTo('ADMIN'), auditLogController.getAllAuditLogs);

module.exports = router;
