'use strict';

const mongoose    = require('mongoose');
const GpuResource = require('../../models/gpu-resource/model');
const catchAsync  = require('../../utils/catch-async');
const AppError    = require('../../utils/app-error');

/**
 * POST /api/v1/gpu-resources  (ADMIN only)
 */
exports.createGpuResource = catchAsync(async (req, res, next) => {
  const name      = typeof req.body.name  === 'string' ? req.body.name.trim()  : '';
  const model     = typeof req.body.model === 'string' ? req.body.model.trim() : '';
  const vram      = Number(req.body.vram);
  const cudaCores = Number(req.body.cudaCores) || 0;

  if (!name || !model) {
    return next(new AppError('Please provide name and model.', 400));
  }
  if (!Number.isFinite(vram) || vram <= 0) {
    return next(new AppError('VRAM must be a positive number.', 400));
  }

  const newGpu = await GpuResource.create({
    name,
    model,
    vram,
    cudaCores,
    condition:     req.body.condition || 'New',
    status:        req.body.status    || 'Available',
    availableVRAM: vram,
  });

  res.status(201).json({ status: 'success', data: { gpu: newGpu } });
});

/**
 * GET /api/v1/gpu-resources  (ADMIN only, paginated)
 */
exports.getAllGpuResources = catchAsync(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const skip  = (page - 1) * limit;

  const [gpus, total] = await Promise.all([
    GpuResource.find({}).sort('-createdAt').skip(skip).limit(limit),
    GpuResource.countDocuments(),
  ]);

  res.status(200).json({
    status:  'success',
    results: gpus.length,
    meta:    { page, limit, total, pages: Math.ceil(total / limit) },
    data:    { gpus },
  });
});

/**
 * GET /api/v1/gpu-resources/available  (any authenticated user)
 */
exports.getAvailableGpuResources = catchAsync(async (req, res, next) => {
  const gpus = await GpuResource.find({ status: 'Available' }).sort('-vram');
  res.status(200).json({ status: 'success', results: gpus.length, data: { gpus } });
});

/**
 * PATCH /api/v1/gpu-resources/:id  (ADMIN only)
 */
exports.updateGpuResource = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('Invalid GPU resource ID.', 400));
  }

  const gpu = await GpuResource.findByIdAndUpdate(req.params.id, req.body, {
    new:           true,
    runValidators: true,
  });
  if (!gpu) return next(new AppError('GPU resource not found.', 404));
  res.status(200).json({ status: 'success', data: { gpu } });
});

/**
 * DELETE /api/v1/gpu-resources/:id  (ADMIN only)
 */
exports.deleteGpuResource = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('Invalid GPU resource ID.', 400));
  }

  const gpu = await GpuResource.findByIdAndDelete(req.params.id);
  if (!gpu) return next(new AppError('GPU resource not found.', 404));
  res.status(204).json({ status: 'success', data: null });
});
