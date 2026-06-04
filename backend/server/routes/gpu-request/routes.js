const express             = require('express');
const gpuRequestController = require('../../controllers/gpu-request/controller');
const { protect, restrictTo } = require('../../middleware/auth/middleware');
const router              = express.Router();

// STUDENT — create a request
router.post('/', protect, restrictTo('STUDENT'), gpuRequestController.createGpuRequest);

// STUDENT (own requests) / also usable by FACULTY & ADMIN
router.get('/my-requests', protect, gpuRequestController.getMyRequests);

// FACULTY — pending requests queue
router.get('/pending', protect, restrictTo('FACULTY'), gpuRequestController.getPendingRequests);

// ADMIN — all requests
router.get('/all', protect, restrictTo('ADMIN'), gpuRequestController.getAllRequests);

// FACULTY — approve / reject
router.patch('/:id/approve',  protect, restrictTo('FACULTY'),         gpuRequestController.approveRequest);
router.patch('/:id/reject',   protect, restrictTo('FACULTY'),         gpuRequestController.rejectRequest);
router.patch('/:id/complete', protect, restrictTo('FACULTY', 'ADMIN'), gpuRequestController.completeGpuRequest);

module.exports = router;
