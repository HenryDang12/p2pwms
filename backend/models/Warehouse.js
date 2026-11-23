const mongoose = require('mongoose');

const WarehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true
    },
    rentalInfo: {
      providerName: { type: String, trim: true, default: '' },
      address: { type: String, required: true, trim: true },
      contractNote: { type: String, trim: true, default: '' }
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectReason: {
      type: String,
      trim: true,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Warehouse', WarehouseSchema);