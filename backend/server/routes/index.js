const express = require('express');

const router = express.Router();

router.use('/auth',          require('./auth/routes'));
router.use('/gpu-resources', require('./gpu-resource/routes'));
router.use('/gpu-requests', require('./gpu-request/routes'));
router.use('/admin', require('./admin/routes'));
router.use('/analytics', require('./analytics/routes'));

module.exports = router;
