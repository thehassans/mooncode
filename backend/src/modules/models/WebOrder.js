import mongoose from 'mongoose'

const WebOrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, default: '' },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1, min: 1 },
}, { _id: false })

const WebOrderSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  phoneCountryCode: { type: String, default: '' },
  orderCountry: { type: String, default: '' },
  city: { type: String, default: '' },
  area: { type: String, default: '' },
  address: { type: String, default: '' },
  details: { type: String, default: '' },
  items: [WebOrderItemSchema],
  total: { type: Number, default: 0 },
  currency: { type: String, default: 'SAR' },
  status: { type: String, enum: ['new','processing','done','cancelled'], default: 'new' },
}, { timestamps: true })

export default mongoose.model('WebOrder', WebOrderSchema)
