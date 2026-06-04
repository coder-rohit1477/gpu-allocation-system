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
    metadata: {
      type:    Object,
      default: {},
    },
    details: {
      type:    Object,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.metadata;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        delete ret.metadata;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
