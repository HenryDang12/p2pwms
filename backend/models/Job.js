const mongoose = require('mongoose');
const JobSchema = new mongoose.Schema({
  jobCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  client: { type: String, default: '', maxlength: 160 },
  eventLocation: { type: String, default: '', maxlength: 250 },
  startDate: { type: Date },
  endDate: { type: Date },
  owner: { type: String, default: '', maxlength: 120 },
  notes: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['planning', 'active', 'completed', 'cancelled'], default: 'planning' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
module.exports = mongoose.model('Job', JobSchema);
