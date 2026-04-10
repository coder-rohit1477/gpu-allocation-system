const GpuResource = require('../models/gpu-resource.model');
const catchAsync = require('../utils/catch-async');
const AppError = require('../utils/app-error');

/**
 * POST /api/v1/gpu-resources  (ADMIN only)
 */
exports.createGpuResource = catchAsync(async (req, res, next) => {
  const { name, model, vram, cudaCores, condition, status } = req.body;
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedModel = typeof model === 'string' ? model.trim() : '';
  const normalizedVram = Number(vram);
  const normalizedCudaCores = Number(cudaCores);

  if (!normalizedName || !normalizedModel || !vram) {
    return next(new AppError('Please provide name, model, and vram.', 400));
  }
  if (!Number.isFinite(normalizedVram) || normalizedVram <= 0) {
    return next(new AppError('VRAM must be a positive number.', 400));
  }

  const newGpu = await GpuResource.create({
    name: normalizedName,
    model: normalizedModel,
    vram: normalizedVram,
    cudaCores: Number.isFinite(normalizedCudaCores) ? normalizedCudaCores : 0,
    condition: condition || 'New',
    status: status || 'Available',
    availableVRAM: normalizedVram,
  });

  res.status(201).json({ status: 'success', data: { gpu: newGpu } });
});

/**
 * GET /api/v1/gpu-resources  (ADMIN only)
 */
exports.getAllGpuResources = catchAsync(async (req, res, next) => {
  const gpus = await GpuResource.find({});
  res.status(200).json({ status: 'success', results: gpus.length, data: { gpus } });
});

/**
 * GET /api/v1/gpu-resources/available  (any authenticated user)
 */
exports.getAvailableGpuResources = catchAsync(async (req, res, next) => {
  const gpus = await GpuResource.find({ status: 'Available' });
  res.status(200).json({ status: 'success', results: gpus.length, data: { gpus } });
});

/**
 * PATCH /api/v1/gpu-resources/:id  (ADMIN only)
 */
exports.updateGpuResource = catchAsync(async (req, res, next) => {
  const gpu = await GpuResource.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!gpu) return next(new AppError('GPU resource not found.', 404));
  res.status(200).json({ status: 'success', data: { gpu } });
});

/**
 * DELETE /api/v1/gpu-resources/:id  (ADMIN only)
 */
exports.deleteGpuResource = catchAsync(async (req, res, next) => {
  const gpu = await GpuResource.findByIdAndDelete(req.params.id);
  if (!gpu) return next(new AppError('GPU resource not found.', 404));
  res.status(204).json({ status: 'success', data: null });
});
