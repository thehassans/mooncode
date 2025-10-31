import mongoose from 'mongoose'

const driverCommissionPayoutSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Period
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  
  // Financial details
  totalOrders: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 }, // Total collected amount
  commissionRate: { type: Number, default: 0 }, // Commission per order
  commissionAmount: { type: Number, required: true }, // Total commission to pay
  currency: { type: String, default: 'SAR' },
  
  // Status workflow
  status: { 
    type: String, 
    enum: ['unpaid', 'pending_approval', 'approved', 'paid', 'rejected', 'cancelled'],
    default: 'unpaid'
  },
  
  // Orders included in this payout
  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  
  // Timestamps for workflow
  initiatedAt: { type: Date },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt: { type: Date },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Payment method and details
  paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'mobile_wallet', 'hand'], default: 'hand' },
  paymentNote: { type: String },
  paymentReference: { type: String },
  
  // PDF receipt path
  receiptPath: { type: String },
  
  // Notes
  managerNote: { type: String },
  driverNote: { type: String },
  rejectionReason: { type: String }
}, { timestamps: true })

// Indexes
driverCommissionPayoutSchema.index({ driver: 1, createdAt: -1 })
driverCommissionPayoutSchema.index({ manager: 1, status: 1 })
driverCommissionPayoutSchema.index({ status: 1, createdAt: -1 })

const DriverCommissionPayout = mongoose.model('DriverCommissionPayout', driverCommissionPayoutSchema)
export default DriverCommissionPayout
