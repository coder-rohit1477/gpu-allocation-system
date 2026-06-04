'use strict';

const express             = require('express');
const adminController     = require('../../controllers/admin/controller');
const auditLogController  = require('../../controllers/audit-log/controller');
const { protect, restrictTo } = require('../../middleware/auth/middleware');

const router = express.Router();

// Dashboard summary
router.get('/summary',    protect, restrictTo('ADMIN'), adminController.getDashboardSummary);

// Audit logs (paginated)
router.get('/audit-logs', protect, restrictTo('ADMIN'), auditLogController.getAllAuditLogs);

// User management — ONLY admins can create FACULTY/ADMIN accounts
router.post('/users',     protect, restrictTo('ADMIN'), adminController.createUser);

module.exports = router;
