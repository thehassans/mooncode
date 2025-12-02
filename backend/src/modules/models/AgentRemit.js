import mongoose from "mongoose";

const AgentRemitSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    approverRole: { type: String, enum: ["user", "manager"], required: true },
    amount: { type: Number, required: true, min: 0 },
    baseCommissionAmount: { type: Number, min: 0, default: 0 }, // The 12% base portion (deducted from balance)
    currency: { type: String, default: "PKR" },
    commissionRate: { type: Number, min: 0, max: 100, default: 12 },
    totalOrderValueAED: { type: Number, min: 0, default: 0 },
    note: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "sent"],
      default: "pending",
      index: true,
    },
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sentAt: { type: Date },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    receiptPdf: { type: String }, // Path to generated PDF receipt
  },
  { timestamps: true }
);

export default mongoose.model("AgentRemit", AgentRemitSchema);
