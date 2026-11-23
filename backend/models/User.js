// File: models/User.js
const mongoose = require('mongoose');

const ROLES = ['admin', 'cs', 'fop', 'warehouse_keeper'];
const WAREHOUSE_ACTIONS = ['import', 'export', 'pick'];

const WarehousePermissionSchema = new mongoose.Schema(
  {
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true
    },
    actions: {
      type: [String],
      enum: WAREHOUSE_ACTIONS,
      default: []
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    grantedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'warehouse_keeper', required: true },
    active: { type: Boolean, default: true, index: true },
    tokenVersion: { type: Number, default: 0 },
    bootstrapSlot: { type: String, unique: true, sparse: true, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastLoginAt: { type: Date, default: null },

    // Phân quyền chi tiết theo từng bãi kho
    warehousePermissions: {
      type: [WarehousePermissionSchema],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
module.exports.ROLES = ROLES;
module.exports.WAREHOUSE_ACTIONS = WAREHOUSE_ACTIONS;