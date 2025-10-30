import mongoose from 'mongoose'

const DriverCommissionPayoutSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  country: { type: String, default: '', index: true },
  currency: { type: String, enum: ['AED','SAR','OMR','BHD','INR','KWD','QAR','PKR',''], default: '' },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['hand','transfer','bank'], default: 'hand' },
  note: { type: String, default: '' },
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending', index: true },
  pdfPath: { type: String, default: '' }, // Commission PDF generated when created
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String, default: '' },
  // Order details for the commission
  totalDeliveredOrders: { type: Number, default: 0 },
  commissionPerOrder: { type: Number, default: 0 },
  extraCommission: { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('DriverCommissionPayout', DriverCommissionPayoutSchema)
