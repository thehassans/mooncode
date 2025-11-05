import mongoose from 'mongoose'

const OrderSchema = new mongoose.Schema({
  customerName: { type: String, default: '' },
  customerPhone: { type: String, required: true },
  phoneCountryCode: { type: String, default: '' },
  orderCountry: { type: String, default: '' },
  city: { type: String, default: '' },
  customerArea: { type: String, default: '' },
  customerAddress: { type: String, default: '' },
  locationLat: { type: Number },
  locationLng: { type: Number },
  customerLocation: { type: String, default: '' },
  preferredTiming: { type: String, default: '' },
  // Optional additional phone and contact preference
  additionalPhone: { type: String },
  additionalPhonePref: { type: String, enum: ['whatsapp','calling','both'], default: 'both' },

  details: { type: String, default: '' },

  // Backward-compatible single product fields
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: { type: Number, default: 1, min: 1 },

  // New: multiple items support
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, default: 1, min: 1 },
    }
  ],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByRole: { type: String, enum: ['admin','user','agent','manager'], required: true },

  // Shipment
  shipmentMethod: { type: String, default: 'none' },
  courierName: { type: String },
  trackingNumber: { type: String },
  deliveryBoy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  driverCommission: { type: Number, default: 0 },
  shippingFee: { type: Number, default: 0 },
  codAmount: { type: Number, default: 0 },
  collectedAmount: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },

  status: { type: String, default: 'pending' },
  shipmentStatus: { type: String, default: 'pending' },
  shippedAt: { type: Date },
  pickedUpAt: { type: Date },
  outForDeliveryAt: { type: Date },
  deliveredAt: { type: Date },
  // Inventory adjustment bookkeeping (decrement stock once upon delivery)
  inventoryAdjusted: { type: Boolean, default: false },
  inventoryAdjustedAt: { type: Date },

  // Returns / delivery info
  deliveryNotes: { type: String },
  returnReason: { type: String },

  // Return/Cancel Verification Flow
  returnSubmittedToCompany: { type: Boolean, default: false },
  returnSubmittedAt: { type: Date },
  returnVerified: { type: Boolean, default: false },
  returnVerifiedAt: { type: Date },
  returnVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Settlements
  receivedFromCourier: { type: Number, default: 0 },
  settled: { type: Boolean, default: false },
  settledAt: { type: Date },
  settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Agent commission snapshot (computed when delivered)
  agentCommissionPKR: { type: Number, default: 0 },
  agentCommissionComputedAt: { type: Date },

  invoiceNumber: { type: String, unique: true, sparse: true, index: true },
  total: { type: Number },
  discount: { type: Number, default: 0 },
  
  // Shopify integration fields
  orderSource: { type: String, enum: ['manual','shopify','website','mobile'], default: 'manual' },
  shopifyOrderId: { type: String, default: '', index: true }, // Shopify order ID
  shopifyOrderNumber: { type: String, default: '' }, // Shopify order number (e.g., #1001)
  shopifyOrderName: { type: String, default: '' }, // Shopify order name (e.g., #MS1001)
  shopifyFulfillmentId: { type: String, default: '' }, // Shopify fulfillment ID after shipping
}, { timestamps: true })

export default mongoose.model('Order', OrderSchema)
