const express        = require('express');
const gpuController  = require('../../controllers/gpu-resource/controller');
const { protect, restrictTo } = require('../../middleware/auth/middleware');
const router         = express.Router();

// GET /api/v1/gpu-resources/available  — all authenticated users
router.get('/available', protect, gpuController.getAvailableGpuResources);

// GET /api/v1/gpu-resources            — ADMIN only (full list)
// POST /api/v1/gpu-resources           — ADMIN only
router
  .route('/')
  .get(protect, restrictTo('ADMIN'), gpuController.getAllGpuResources)
  .post(protect, restrictTo('ADMIN'), gpuController.createGpuResource);

// PATCH/DELETE /api/v1/gpu-resources/:id  — ADMIN only
router
  .route('/:id')
  .patch(protect, restrictTo('ADMIN'), gpuController.updateGpuResource)
  .delete(protect, restrictTo('ADMIN'), gpuController.deleteGpuResource);

module.exports = router;
