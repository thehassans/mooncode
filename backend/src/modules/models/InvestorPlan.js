import mongoose from 'mongoose'

const PackageSchema = new mongoose.Schema({
  index: { type: Number, required: true }, // 1..3
  name: { type: String, default: '' },
  price: { type: Number, default: 0 },
  profitPercentage: { type: Number, default: 0 },
}, { _id: false })

const InvestorPlanSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, unique: true },
  packages: { type: [PackageSchema], default: [] },
}, { timestamps: true })

export default mongoose.model('InvestorPlan', InvestorPlanSchema)
