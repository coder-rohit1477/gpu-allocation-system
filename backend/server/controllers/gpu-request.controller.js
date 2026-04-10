const GpuRequest = require('../models/gpu-request.model');
const GpuResource = require('../models/gpu-resource.model');
const auditLogService = require('../modules/audit-log/audit-log.service');
const catchAsync = require('../utils/catch-async');
const AppError = require('../utils/app-error');

/* ─────────────────────────────────────────────────────────────
   STUDENT
───────────────────────────────────────────────────────────── */

/**
 * POST /api/v1/gpu-requests   (STUDENT)
 */
exports.createGpuRequest = catchAsync(async (req, res, next) => {
  const { gpuResourceId, requiredVRAM, purpose, startDate, endDate } = req.body;

  if (!purpose || !startDate || !endDate) {
    return next(new AppError('Please provide purpose, startDate, and endDate.', 400));
  }

  // Validate dates in controller so we get proper AppError HTTP status (400)
  // instead of relying on the Mongoose pre-save hook which throws a raw Error
  if (new Date(endDate) <= new Date(startDate)) {
    return next(new AppError('endDate must be after startDate.', 400));
  }

  const newRequest = await GpuRequest.create({
    userId:        req.user.id,
    gpuResourceId: gpuResourceId || null,
    requiredVRAM:  Number(requiredVRAM) || 0,
    purpose,
    startDate,
    endDate,
  });

  await auditLogService.createLog(req.user.id, 'CREATE_GPU_REQUEST', {
    requestId: newRequest._id,
    gpuResourceId,
    purpose,
  });

  res.status(201).json({ status: 'success', data: { request: newRequest } });
});

/**
 * GET /api/v1/gpu-requests/my-requests
 */
exports.getMyRequests = catchAsync(async (req, res, next) => {
  const requests = await GpuRequest
    .find({ userId: req.user.id })
    .populate('gpuResourceId', 'name model vram')
    .sort('-createdAt');

  res.status(200).json({ status: 'success', results: requests.length, data: { requests } });
});

/* ─────────────────────────────────────────────────────────────
   FACULTY
───────────────────────────────────────────────────────────── */

/**
 * GET /api/v1/gpu-requests/pending   (FACULTY)
 */
exports.getPendingRequests = catchAsync(async (req, res, next) => {
  const requests = await GpuRequest
    .find({ status: 'PENDING' })
    .populate('userId',        'username role')
    .populate('gpuResourceId', 'name model')
    .sort('-createdAt');

  res.status(200).json({ status: 'success', results: requests.length, data: { requests } });
});

/**
 * PATCH /api/v1/gpu-requests/:id/approve   (FACULTY)
 */
exports.approveRequest = catchAsync(async (req, res, next) => {
  const { gpuId } = req.body;
  if (!gpuId) return next(new AppError('Please provide a gpuId for approval.', 400));

  const request = await GpuRequest.findById(req.params.id);
  if (!request) return next(new AppError('GPU request not found.', 404));
  if (request.status !== 'PENDING') {
    return next(new AppError(`Request is already ${request.status}.`, 400));
  }

  const gpu = await GpuResource.findById(gpuId);
  if (!gpu) return next(new AppError('GPU resource not found.', 404));
  if (gpu.status !== 'Available') {
    return next(new AppError(`The selected GPU is currently ${gpu.status} and cannot be allocated.`, 400));
  }
  if (request.requiredVRAM && gpu.availableVRAM < request.requiredVRAM) {
    return next(new AppError(`GPU has insufficient VRAM. Required: ${request.requiredVRAM} GB, Available: ${gpu.availableVRAM} GB.`, 400));
  }

  // Allocate GPU
  gpu.availableVRAM = Math.max(0, gpu.availableVRAM - (request.requiredVRAM || 0));
  gpu.status        = gpu.availableVRAM <= 0 ? 'Allocated' : 'Available';
  await gpu.save();

  // Update request
  request.status        = 'APPROVED';
  request.facultyId     = req.user.id;
  request.gpuResourceId = gpuId;
  await request.save();

  await auditLogService.createLog(req.user.id, 'APPROVE_GPU_REQUEST', {
    requestId: request._id, gpuId,
  });

  res.status(200).json({ status: 'success', data: { request } });
});

/**
 * PATCH /api/v1/gpu-requests/:id/reject   (FACULTY)
 */
exports.rejectRequest = catchAsync(async (req, res, next) => {
  const request = await GpuRequest.findById(req.params.id);
  if (!request) return next(new AppError('GPU request not found.', 404));
  if (request.status !== 'PENDING') {
    return next(new AppError(`Request is already ${request.status}.`, 400));
  }

  request.status = 'REJECTED';
  request.facultyId = req.user.id;
  await request.save();

  await auditLogService.createLog(req.user.id, 'REJECT_GPU_REQUEST', { requestId: req.params.id });

  res.status(200).json({ status: 'success', data: { request } });
});

/**
 * PATCH /api/v1/gpu-requests/:id/complete   (FACULTY / ADMIN)
 */
exports.completeGpuRequest = catchAsync(async (req, res, next) => {
  const request = await GpuRequest.findById(req.params.id);
  if (!request) return next(new AppError('GPU request not found.', 404));
  if (request.status !== 'APPROVED') {
    return next(new AppError('Only APPROVED requests can be completed.', 400));
  }

  // Release GPU if one was assigned
  if (request.gpuResourceId) {
    const gpu = await GpuResource.findById(request.gpuResourceId);
    if (gpu) {
      gpu.availableVRAM = gpu.vram;   // restore full VRAM
      gpu.status        = 'Available';
      await gpu.save();
    }
  }

  request.status    = 'COMPLETED';
  request.facultyId = req.user.id;
  await request.save();

  await auditLogService.createLog(req.user.id, 'COMPLETE_GPU_REQUEST', { requestId: request._id });

  res.status(200).json({ status: 'success', data: { request } });
});

/* ─────────────────────────────────────────────────────────────
   ADMIN
───────────────────────────────────────────────────────────── */

/**
 * GET /api/v1/gpu-requests/all   (ADMIN)
 */
exports.getAllRequests = catchAsync(async (req, res, next) => {
  const requests = await GpuRequest
    .find({})
    .populate('userId',        'username role')
    .populate('gpuResourceId', 'name model')
    .sort('-createdAt');

  res.status(200).json({ status: 'success', results: requests.length, data: { requests } });
});
