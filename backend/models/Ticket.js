// File: models/Ticket.js
const mongoose = require('mongoose');

const ExportLogSchema = new mongoose.Schema({
  quantity: { type: Number, required: true },
  condition: { type: String, required: true },
  receiverDepartment: { type: String, required: true },
  receiverName: { type: String },
  receiverConfirmed: { type: Boolean, default: false },
  receiverConfirmedAt: { type: Date },
  executor: { type: String, required: true },
  transportUnit: { type: String },
  photoUrl: { type: String },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  jobCode: { type: String, default: '' },
  jobName: { type: String, default: '' },
  assetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Asset' }],
  note: { type: String },
  timestamp: { type: Date, default: Date.now }
});

const TicketSchema = new mongoose.Schema({
  ticketCode: { type: String, required: true, unique: true },
  sku: { type: String, required: true },
  itemName: { type: String, required: true },
  unit: { type: String, default: 'Cái' },
  
  inbound: {
    sku: String,
    quantity: { type: Number, required: true },
    condition: { type: String, required: true },
    deliveryUnit: { type: String },
    department: { type: String, required: true },
    project: { type: String, required: true },
    keeper: { type: String, required: true },
    zone: { type: String, required: true },
    storageDays: { type: Number },
    photoUrl: { type: String },
    note: { type: String },
    timestamp: { type: Date, default: Date.now }
  },

  outbound: {
    isExported: { type: Boolean, default: false },
    quantity: { type: Number, default: 0 },
    condition: { type: String },
    timestamp: { type: Date }
  },

  exportLogs: [ExportLogSchema],
  totalExportedQuantity: { type: Number, default: 0 },
  status: { type: String, enum: ['Đang lưu kho', 'Đã xuất kho một phần', 'Đã xuất hết'], default: 'Đang lưu kho' }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', TicketSchema);