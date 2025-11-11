import mongoose from 'mongoose';

const InvestmentSchema = new mongoose.Schema({
  investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Company owner
  amount: { type: Number, required: true, default: 0 }, // Investment amount
  quantity: { type: Number, required: true, default: 0 }, // Units invested in
  currency: { type: String, enum: ['AED','SAR','OMR','BHD','INR','KWD','QAR','USD','CNY'], default: 'SAR' },
  status: { type: String, enum: ['active', 'withdrawn', 'cancelled'], default: 'active', index: true },
  // Tracking
  unitsSold: { type: Number, default: 0 }, // Units sold from this investment
  totalProfit: { type: Number, default: 0 }, // Total profit earned
  totalRevenue: { type: Number, default: 0 }, // Total revenue from sales
}, { timestamps: true });

// Index for quick lookups
InvestmentSchema.index({ investor: 1, product: 1 });
InvestmentSchema.index({ owner: 1, status: 1 });

export default mongoose.model('Investment', InvestmentSchema);
