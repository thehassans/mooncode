import mongoose from 'mongoose'

const ExpenseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['advertisement', 'general'], default: 'general' },
  category: { type: String, default: 'general' },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ['AED','SAR','OMR','BHD','INR','KWD','QAR'], default: 'SAR' },
  country: { type: String }, // For advertisement expenses: KSA, UAE, Oman, Bahrain, India, Kuwait, Qatar
  notes: { type: String },
  incurredAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Manager approval fields
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }, // Default approved for user/admin, pending for manager
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectionReason: { type: String },
}, { timestamps: true })

export default mongoose.model('Expense', ExpenseSchema)
