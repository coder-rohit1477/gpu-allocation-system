const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    level: {
      type:    String,
      enum:    ['INFO', 'WARN', 'ERROR'],
      default: 'INFO',
    },
    actorId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    action: {
      type:     String,
      required: true,
      trim:     true,
    },
    details: {
      type:    Object,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
