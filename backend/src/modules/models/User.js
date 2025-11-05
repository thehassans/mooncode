import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const UserSchema = new mongoose.Schema({
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  country: { type: String, default: '' },
  city: { type: String, default: '' },
  role: { type: String, enum: ['admin','user','agent','manager','investor','driver','customer'], default: 'user', index: true },
  // Agent availability status for assignment visibility and routing
  availability: { type: String, enum: ['available','away','busy','offline'], default: 'available', index: true },
  // For agents/managers/investors created by a user/company (workspace owner)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Manager-specific permission flags (only applicable when role === 'manager')
  managerPermissions: {
    canCreateAgents: { type: Boolean, default: false },
    canManageProducts: { type: Boolean, default: false },
    canCreateOrders: { type: Boolean, default: false },
    canCreateDrivers: { type: Boolean, default: false },
  },
  // Manager-specific country assignment (limits visibility to orders/drivers from this country)
  assignedCountry: { type: String, enum: ['UAE','Saudi Arabia','Oman','Bahrain','India','Kuwait','Qatar',''], default: '' },
  // New: allow assigning MULTIPLE countries (up to 2) – this field takes precedence if non-empty
  assignedCountries: { type: [String], enum: ['UAE','Saudi Arabia','Oman','Bahrain','India','Kuwait','Qatar'], default: [] },
  // Auto welcome message status (set on agent creation best-effort)
  welcomeSent: { type: Boolean, default: false },
  welcomeSentAt: { type: Date },
  welcomeError: { type: String, default: '' },
  // Investor specific profile (only applicable when role === 'investor')
  investorProfile: {
    investmentAmount: { type: Number, default: 0 },
    currency: { type: String, enum: ['AED','SAR','OMR','BHD','INR','KWD','QAR','USD','CNY'], default: 'SAR' },
    assignedProducts: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      country: { type: String, default: '' },
      profitPerUnit: { type: Number, default: 0 },
    }],
  },
  // Agent payout profile (withdrawal method and details)
  payoutProfile: {
    method: { type: String, enum: ['bank','jazzcash','easypaisa','nayapay','sadapay'], default: 'jazzcash' },
    accountName: { type: String, default: '' },
    bankName: { type: String, default: '' },
    iban: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
  },
  // Driver-specific profile
  driverProfile: {
    commissionPerOrder: { type: Number, default: 0 },
    commissionCurrency: { type: String, enum: ['AED','OMR','SAR','BHD','INR','KWD','QAR'], default: 'SAR' },
    commissionRate: { type: Number, default: 8 },
    totalCommission: { type: Number, default: 0 }, // Total commission earned from all delivered orders
    paidCommission: { type: Number, default: 0 }, // Total commission already paid via remittances
  },
  // Workspace/user-level settings
  settings: {
    autoSendInvoice: { type: Boolean, default: true }, // controls auto WhatsApp invoice PDF on order create
  },
  // Custom domain for e-commerce site (e.g., buysial.com)
  customDomain: { type: String, default: '', trim: true },
}, { timestamps: true })

UserSchema.pre('save', async function(next){
  if (!this.isModified('password')) return next()
  try{
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  }catch(err){ next(err) }
})

UserSchema.methods.comparePassword = async function(plain){
  try{ return await bcrypt.compare(plain, this.password) }catch{ return false }
}

export default mongoose.model('User', UserSchema)
