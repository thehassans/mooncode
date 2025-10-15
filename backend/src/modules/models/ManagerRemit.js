import mongoose from 'mongoose'

const ManagerRemitSchema = new mongoose.Schema({
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  country: { type: String, default: '' },
  currency: { type: String, enum: ['AED','SAR','OMR','BHD','INR','KWD','QAR',''], default: '' },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['hand','transfer'], default: 'hand' },
  note: { type: String, default: '' },
  receiptPath: { type: String, default: '' },
  proofOk: { type: Boolean, default: null },
  status: { type: String, enum: ['pending','accepted','rejected'], default: 'pending', index: true },
  acceptedAt: { type: Date },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.model('ManagerRemit', ManagerRemitSchema)
