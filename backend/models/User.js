const mongoose = require('mongoose');

const ROLES = ['admin', 'manager', 'warehouse', 'production'];

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'production', required: true },
  active: { type: Boolean, default: true, index: true },
  tokenVersion: { type: Number, default: 0 },
  bootstrapSlot: { type: String, unique: true, sparse: true, select: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true });


module.exports = mongoose.model('User', UserSchema);
module.exports.ROLES = ROLES;
