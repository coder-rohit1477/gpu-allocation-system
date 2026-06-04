const mongoose = require('mongoose');

const gpuResourceSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'GPU name is required'],
      trim:     true,
    },
    model: {
      type:     String,
      required: [true, 'GPU model is required'],
      trim:     true,
    },
    vram: {
      type:     Number,
      required: [true, 'VRAM is required'],
      min:      [1, 'VRAM must be at least 1 GB'],
    },
    cudaCores: {
      type:    Number,
      default: 0,
      min:     [0, 'CUDA cores cannot be negative'],
    },
    condition: {
      type:    String,
      enum:    ['New', 'Used', 'Refurbished'],
      default: 'New',
    },
    availableVRAM: {
      type: Number,
    },
    status: {
      type:    String,
      enum:    ['Available', 'In Use', 'Maintenance', 'Decommissioned', 'Allocated'],
      default: 'Available',
    },
  },
  { timestamps: true }
);

// ─── Initialise availableVRAM on create ──────────────────────────────────────
gpuResourceSchema.pre('save', function (next) {
  if (this.isNew && this.availableVRAM === undefined) {
    this.availableVRAM = this.vram;
  }
  next();
});

module.exports = mongoose.model('GpuResource', gpuResourceSchema);
