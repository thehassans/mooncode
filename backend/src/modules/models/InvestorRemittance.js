import mongoose from 'mongoose'

const InvestorRemittanceSchema = new mongoose.Schema({
  investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'SAR' },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  country: { type: String, default: '' },
  note: { type: String, default: '' },
  status: { type: String, enum: ['pending','approved','sent'], default: 'pending', index: true },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentAt: { type: Date },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.model('InvestorRemittance', InvestorRemittanceSchema)
