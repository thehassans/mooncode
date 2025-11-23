import mongoose from "mongoose";

const dailyProfitSchema = new mongoose.Schema(
  {
    investor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    investorRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestorRequest",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "AED",
    },
    monthYear: {
      type: String,
      required: true,
      index: true,
      // Format: "YYYY-MM" e.g., "2025-11"
    },
    // Track if this is a manual adjustment or system-generated
    isManual: {
      type: Boolean,
      default: false,
    },
    note: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient monthly queries
dailyProfitSchema.index({ investor: 1, monthYear: 1 });
dailyProfitSchema.index({ investorRequest: 1, date: 1 });

const DailyProfit = mongoose.model("DailyProfit", dailyProfitSchema);

export default DailyProfit;
