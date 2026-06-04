const express              = require('express');
const analyticsController  = require('../../controllers/analytics/controller');
const { protect, restrictTo } = require('../../middleware/auth/middleware');
const router               = express.Router();

router.get('/usage', protect, restrictTo('ADMIN'), analyticsController.getUsageAnalytics);

module.exports = router;
