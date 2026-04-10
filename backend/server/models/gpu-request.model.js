const mongoose = require('mongoose');

const gpuRequestSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    gpuResourceId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'GpuResource',
      default: null,
    },
    requiredVRAM: {
      type:    Number,
      default: 0,
      min:     [0, 'Required VRAM cannot be negative'],
    },
    purpose: {
      type:     String,
      required: [true, 'Purpose is required'],
      trim:     true,
    },
    startDate: {
      type:     Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type:     Date,
      required: [true, 'End date is required'],
    },
    status: {
      type:    String,
      enum:    ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
      default: 'PENDING',
    },
    facultyId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Validate endDate > startDate ────────────────────────────────────────────
// Note: Primary validation happens in the controller (returns AppError 400).
// This pre-save hook is a safety net. It uses mongoose.Error.ValidatorError so
// globalErrorHandler's handleValidationErrorDB converts it to a 400, not a 500.
gpuRequestSchema.pre('save', function (next) {
  if (this.endDate && this.startDate && this.endDate <= this.startDate) {
    const err = new Error('End date must be after start date');
    err.name  = 'ValidationError';
    err.errors = {
      endDate: {
        message: 'End date must be after start date',
        path: 'endDate',
        value: this.endDate,
      },
    };
    return next(err);
  }
  next();
});

module.exports = mongoose.model('GpuRequest', gpuRequestSchema);
