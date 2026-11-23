const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['warehouse_approval', 'warehouse_action', 'system'],
      default: 'system'
    },
    actionType: {
      type: String,
      enum: ['import', 'export', 'pick', 'approve', 'reject', 'register', ''],
      default: ''
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    recipientRole: {
      type: String,
      enum: ['admin', 'cs', 'fop', 'warehouse_keeper', 'all', ''],
      default: ''
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      default: null
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null
    },
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', NotificationSchema);