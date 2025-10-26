import mongoose from 'mongoose'

const RemittanceSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  country: { type: String, default: '' },
  currency: { type: String, enum: ['AED','SAR','OMR','BHD','INR','KWD','QAR',''], default: '' },
  amount: { type: Number, required: true, min: 0 },
  fromDate: { type: Date },
  toDate: { type: Date },
  totalDeliveredOrders: { type: Number, default: 0 },
  method: { type: String, enum: ['hand','transfer'], default: 'hand' },
  paidToName: { type: String, default: '' },
  receiptPath: { type: String, default: '' },
  pdfPath: { type: String, default: '' },
  proofOk: { type: Boolean, default: null },
  status: { type: String, enum: ['pending','manager_accepted','accepted','rejected'], default: 'pending', index: true },
  managerAcceptedAt: { type: Date },
  managerAcceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acceptedAt: { type: Date },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String, default: '' },
}, { timestamps: true })

export default mongoose.model('Remittance', RemittanceSchema)
