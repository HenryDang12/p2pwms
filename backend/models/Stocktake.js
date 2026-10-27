const mongoose = require('mongoose');
const StocktakeLineSchema = new mongoose.Schema({
  sku: { type: String, required: true, trim: true, uppercase: true },
  itemName: { type: String, required: true, maxlength: 200 },
  systemQuantity: { type: Number, required: true },
  countedQuantity: { type: Number, required: true, min: 0 },
  difference: { type: Number, required: true },
  note: { type: String, default: '', maxlength: 1000 }
}, { _id: false });
const StocktakeSchema = new mongoose.Schema({
  stocktakeCode: { type: String, required: true, unique: true },
  location: { type: String, default: 'Toàn kho', maxlength: 160 },
  note: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['completed'], default: 'completed' },
  lines: { type: [StocktakeLineSchema], default: [] },
  totalLines: { type: Number, default: 0 },
  discrepancyLines: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, default: '' }
}, { timestamps: true });
module.exports = mongoose.model('Stocktake', StocktakeSchema);
