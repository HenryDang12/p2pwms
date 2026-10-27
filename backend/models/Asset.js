const mongoose = require('mongoose');
const ReturnLogSchema = new mongoose.Schema({
  returnedBy: { type: String, default: '' },
  receivedBy: { type: String, default: '' },
  condition: { type: String, enum: ['Tốt', 'Cần kiểm tra', 'Hư hỏng'], required: true },
  note: { type: String, default: '', maxlength: 2000 },
  photoUrl: { type: String, default: '' },
  jobCode: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  executorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });
const AssetSchema = new mongoose.Schema({
  assetCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
  serialNumber: { type: String, default: '', trim: true, maxlength: 160 },
  category: { type: String, default: 'Thiết bị', maxlength: 100 },
  location: { type: String, default: 'Kho P2P', maxlength: 160 },
  condition: { type: String, enum: ['Tốt', 'Cần kiểm tra', 'Hư hỏng'], default: 'Tốt' },
  status: { type: String, enum: ['available', 'assigned', 'maintenance', 'retired'], default: 'available' },
  currentJob: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  sourceTicket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
  notes: { type: String, default: '', maxlength: 2000 },
  returnLogs: { type: [ReturnLogSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
AssetSchema.index({ sku: 1, status: 1 });
module.exports = mongoose.model('Asset', AssetSchema);
