import mongoose from 'mongoose'

const InvestorRequestSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  packageIndex: { type: Number, required: true }, // 1..3
  packageName: { type: String, default: '' },
  packagePrice: { type: Number, default: 0 },
  packageProfitPercentage: { type: Number, default: 0 },
  amount: { type: Number, required: true }, // investment amount requested
  currency: { type: String, enum: ['AED','SAR','OMR','BHD','INR','KWD','QAR','USD','CNY'], default: 'AED' },
  status: { type: String, enum: ['pending','accepted','rejected'], default: 'pending', index: true },
  note: { type: String, default: '' },
  acceptedAt: { type: Date },
  rejectedAt: { type: Date },
}, { timestamps: true })

export default mongoose.model('InvestorRequest', InvestorRequestSchema)
