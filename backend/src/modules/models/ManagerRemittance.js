import mongoose from 'mongoose'

const managerRemittanceSchema = new mongoose.Schema({
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'SAR' },
  country: { type: String, default: '' },
  method: { type: String, enum: ['hand', 'transfer'], default: 'hand' },
  paidToName: { type: String, default: '' },
  note: { type: String, default: '' },
  receiptPath: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  acceptedAt: { type: Date },
  rejectedAt: { type: Date },
}, { timestamps: true })

export default mongoose.model('ManagerRemittance', managerRemittanceSchema)
