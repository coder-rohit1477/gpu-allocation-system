'use strict';

const mongoose    = require('mongoose');
const GpuRequest  = require('../../models/gpu-request/model');
const GpuResource = require('../../models/gpu-resource/model');
const { emitToUser } = require('../../realtime');
const auditLogService = require('../../modules/audit-log/service');
const catchAsync  = require('../../utils/catch-async');
const AppError    = require('../../utils/app-error');

// ─── Pagination helper ────────────────────────────────────────────────────────
const getPaginationParams = (query) => {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(100, parseInt(query.limit, 10) || 20);
  return { page, limit, skip: (page - 1) * limit };
};

const emitRequestStatusUpdate = (request, status) => {
  emitToUser(String(request.userId), `request:${status.toLowerCase()}`, {
    requestId: String(request._id),
    status,
    gpuId: request.gpuResourceId ? String(request.gpuResourceId) : null,
    timestamp: new Date().toISOString(),
  });
};

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

  if (new Date(endDate) <= new Date(startDate)) {
    return next(new AppError('endDate must be after startDate.', 400));
  }

  // Validate ObjectId format if provided — prevents NoSQL injection via malformed ids
  if (gpuResourceId && !mongoose.Types.ObjectId.isValid(gpuResourceId)) {
    return next(new AppError('Invalid gpuResourceId format.', 400));
  }

  const newRequest = await GpuRequest.create({
    userId:        req.user.id,
    gpuResourceId: gpuResourceId || null,
    requiredVRAM:  Number(requiredVRAM) || 0,
    purpose:       String(purpose).trim().slice(0, 500),
    startDate,
    endDate,
  });

  await auditLogService.createLog(req.user.id, 'REQUEST_CREATED', {
    requestId: String(newRequest._id),
    gpuResourceId: gpuResourceId ? String(gpuResourceId) : null,
    purpose: newRequest.purpose,
  });

  res.status(201).json({ status: 'success', data: { request: newRequest } });
});

/**
 * GET /api/v1/gpu-requests/my-requests   (paginated)
 */
exports.getMyRequests = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);

  const [requests, total] = await Promise.all([
    GpuRequest
      .find({ userId: req.user.id })
      .populate('gpuResourceId', 'name model vram')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    GpuRequest.countDocuments({ userId: req.user.id }),
  ]);

  res.status(200).json({
    status:  'success',
    results: requests.length,
    meta:    { page, limit, total, pages: Math.ceil(total / limit) },
    data:    { requests },
  });
});

/* ─────────────────────────────────────────────────────────────
   FACULTY
───────────────────────────────────────────────────────────── */

/**
 * GET /api/v1/gpu-requests/pending   (FACULTY, paginated)
 */
exports.getPendingRequests = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);

  const [requests, total] = await Promise.all([
    GpuRequest
      .find({ status: 'PENDING' })
      .populate('userId',        'username role')
      .populate('gpuResourceId', 'name model')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    GpuRequest.countDocuments({ status: 'PENDING' }),
  ]);

  res.status(200).json({
    status:  'success',
    results: requests.length,
    meta:    { page, limit, total, pages: Math.ceil(total / limit) },
    data:    { requests },
  });
});

/**
 * PATCH /api/v1/gpu-requests/:id/approve   (FACULTY)
 *
 * Updated: Transactions removed to support standalone MongoDB instances.
 * Operations are now performed sequentially.
 */
exports.approveRequest = catchAsync(async (req, res, next) => {
  const { gpuId } = req.body;

  if (!gpuId) return next(new AppError('Please provide a gpuId for approval.', 400));
  if (!mongoose.Types.ObjectId.isValid(gpuId)) {
    return next(new AppError('Invalid gpuId format.', 400));
  }

  const [request, gpu] = await Promise.all([
    GpuRequest.findById(req.params.id),
    GpuResource.findById(gpuId),
  ]);

  if (!request) return next(new AppError('GPU request not found.', 404));
  if (request.status !== 'PENDING') {
    return next(new AppError(`Request is already ${request.status}.`, 400));
  }
  if (!gpu) return next(new AppError('GPU resource not found.', 404));
  const conflictingRequest = await GpuRequest.findOne({
    _id: { $ne: request._id },
    gpuResourceId: gpuId,
    status: 'APPROVED',
    startDate: { $lt: request.endDate },
    endDate: { $gt: request.startDate },
  });
  if (conflictingRequest) {
    return next(new AppError('The selected GPU is already assigned to an overlapping approved request.', 409));
  }
  if (gpu.status !== 'Available') {
    return next(new AppError(`The selected GPU is currently ${gpu.status} and cannot be allocated.`, 400));
  }

  const required = request.requiredVRAM || 0;
  if (required > 0 && gpu.availableVRAM < required) {
    return next(new AppError(
      `GPU has insufficient VRAM. Required: ${required} GB, Available: ${gpu.availableVRAM} GB.`,
      400
    ));
  }

  // ── Sequential mutations ──
  gpu.availableVRAM = Math.max(0, gpu.availableVRAM - required);
  gpu.status        = gpu.availableVRAM <= 0 ? 'Allocated' : 'Available';
  await gpu.save();

  request.status        = 'APPROVED';
  request.facultyId     = req.user.id;
  request.gpuResourceId = gpuId;
  await request.save();

  emitRequestStatusUpdate(request, 'APPROVED');

  await auditLogService.createLog(req.user.id, 'REQUEST_APPROVED', {
    requestId: String(request._id),
    gpuId: String(gpuId),
  });

  await auditLogService.createLog(req.user.id, 'GPU_ALLOCATED', {
    requestId: String(request._id),
    gpuId: String(gpuId),
    allocatedVRAM: required,
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

  request.status    = 'REJECTED';
  request.facultyId = req.user.id;
  await request.save();

  emitRequestStatusUpdate(request, 'REJECTED');

  await auditLogService.createLog(req.user.id, 'REQUEST_REJECTED', {
    requestId: String(req.params.id),
  });

  res.status(200).json({ status: 'success', data: { request } });
});

/**
 * PATCH /api/v1/gpu-requests/:id/complete   (FACULTY / ADMIN)
 *
 * Restores GPU VRAM when a request is marked complete.
 */
exports.completeGpuRequest = catchAsync(async (req, res, next) => {
  const request = await GpuRequest.findById(req.params.id);
  if (!request) return next(new AppError('GPU request not found.', 404));
  if (request.status !== 'APPROVED') {
    return next(new AppError('Only APPROVED requests can be completed.', 400));
  }

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

  await auditLogService.createLog(req.user.id, 'COMPLETE_GPU_REQUEST', {
    requestId: String(request._id),
  });

  res.status(200).json({ status: 'success', data: { request } });
});

/* ─────────────────────────────────────────────────────────────
   ADMIN
───────────────────────────────────────────────────────────── */

/**
 * GET /api/v1/gpu-requests/all   (ADMIN, paginated)
 */
exports.getAllRequests = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPaginationParams(req.query);

  // Optional status filter: ?status=PENDING
  const filter = {};
  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'];
  if (req.query.status && validStatuses.includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const [requests, total] = await Promise.all([
    GpuRequest
      .find(filter)
      .populate('userId',        'username role')
      .populate('gpuResourceId', 'name model')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    GpuRequest.countDocuments(filter),
  ]);

  res.status(200).json({
    status:  'success',
    results: requests.length,
    meta:    { page, limit, total, pages: Math.ceil(total / limit) },
    data:    { requests },
  });
});
