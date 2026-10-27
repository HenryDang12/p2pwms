const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorEmail: { type: String, default: '' },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, default: 'system' },
  resourceId: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' }
}, { timestamps: true });

AuditLogSchema.index({ createdAt: -1 });
module.exports = mongoose.model('AuditLog', AuditLogSchema);
