import { Router } from "express";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import InvestorPlan from "../models/InvestorPlan.js";
import InvestorRequest from "../models/InvestorRequest.js";
import { auth, allowRoles } from "../middleware/auth.js";
import { getIO } from "../config/socket.js";

const router = Router();

// Get all products (catalog view only - no investment)
router.get("/products", auth, allowRoles("investor"), async (req, res) => {
  try {
    const investor = await User.findById(req.user.id).select("createdBy");
    if (!investor || !investor.createdBy) {
      return res.status(404).json({ message: "Investor workspace not found" });
    }

    const ownerId = investor.createdBy;

    // Get all products from the owner
    const products = await Product.find({ createdBy: ownerId })
      .select("name price baseCurrency image images description")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ products });
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: "Failed to load products" });
  }
});

// Get investor plans (3 packages) for this investor's workspace
router.get("/plans", auth, allowRoles("investor"), async (req, res) => {
  try {
    const investor = await User.findById(req.user.id)
      .select("createdBy")
      .lean();
    const ownerId = investor?.createdBy;

    console.log("[GET /investor/plans] Investor ID:", req.user.id);
    console.log("[GET /investor/plans] Owner ID (createdBy):", ownerId);

    if (!ownerId) {
      console.log("[GET /investor/plans] No owner ID, returning defaults");
      return res.json({
        packages: [
          {
            index: 1,
            name: "Products Package 1",
            price: 0,
            profitPercentage: 0,
            image: "",
          },
          {
            index: 2,
            name: "Products Package 2",
            price: 0,
            profitPercentage: 0,
            image: "",
          },
          {
            index: 3,
            name: "Products Package 3",
            price: 0,
            profitPercentage: 0,
            image: "",
          },
        ],
      });
    }

    const doc = await InvestorPlan.findOne({ owner: ownerId }).lean();
    console.log("[GET /investor/plans] InvestorPlan doc found:", !!doc);
    console.log(
      "[GET /investor/plans] Packages in doc:",
      doc?.packages?.length || 0
    );

    const defaults = [
      {
        index: 1,
        name: "Products Package 1",
        price: 0,
        profitPercentage: 0,
        image: "",
      },
      {
        index: 2,
        name: "Products Package 2",
        price: 0,
        profitPercentage: 0,
        image: "",
      },
      {
        index: 3,
        name: "Products Package 3",
        price: 0,
        profitPercentage: 0,
        image: "",
      },
    ];
    if (!doc) return res.json({ packages: defaults });
    const map = new Map((doc.packages || []).map((p) => [p.index, p]));
    const merged = defaults.map((d) => ({ ...d, ...(map.get(d.index) || {}) }));
    console.log(
      "[GET /investor/plans] Merged packages:",
      JSON.stringify(merged)
    );
    return res.json({ packages: merged });
  } catch (err) {
    console.error("Error fetching investor plans:", err);
    return res.status(500).json({ message: "Failed to load plans" });
  }
});

// Get investor's orders (orders that contributed profit to this investor)
router.get("/my-orders", auth, allowRoles("investor"), async (req, res) => {
  try {
    // Find all orders where this investor received profit
    const orders = await Order.find({
      "investorProfit.investor": req.user.id,
    })
      .select(
        "invoiceNumber customerName total deliveredAt createdAt investorProfit"
      )
      .sort({ deliveredAt: -1 })
      .lean();

    res.json({ orders });
  } catch (err) {
    console.error("Error fetching investor orders:", err);
    res.status(500).json({ message: "Failed to load orders" });
  }
});

// Get investor's daily profit history
router.get("/daily-profits", auth, allowRoles("investor"), async (req, res) => {
  try {
    const { monthYear } = req.query || {};
    const { getInvestorDailyProfits, getMonthlyProfitSummary } = await import(
      "../services/dailyProfitService.js"
    );

    const dailyProfits = await getInvestorDailyProfits(req.user.id, monthYear);
    const summary = await getMonthlyProfitSummary(req.user.id, monthYear);

    res.json({ dailyProfits, summary });
  } catch (err) {
    console.error("Error fetching daily profits:", err);
    res.status(500).json({ message: "Failed to load daily profits" });
  }
});

export default router;

// Create an investment request for a package
router.post("/requests", auth, allowRoles("investor"), async (req, res) => {
  try {
    const investor = await User.findById(req.user.id)
      .select("createdBy firstName lastName")
      .lean();
    const ownerId = investor?.createdBy;
    if (!ownerId)
      return res.status(400).json({ message: "Workspace not found" });

    const {
      packageIndex,
      amount,
      currency = "AED",
      note = "",
    } = req.body || {};
    const idx = Number(packageIndex);
    if (![1, 2, 3].includes(idx))
      return res.status(400).json({ message: "Invalid package" });
    const plans = await InvestorPlan.findOne({ owner: ownerId }).lean();
    const pkg = (plans?.packages || []).find((p) => p.index === idx) || {
      index: idx,
      name: `Products Package ${idx}`,
      price: 0,
      profitPercentage: 0,
    };
    const doc = await InvestorRequest.create({
      owner: ownerId,
      investor: req.user.id,
      packageIndex: idx,
      packageName: pkg.name || `Products Package ${idx}`,
      packagePrice: Number(pkg.price || 0),
      packageProfitPercentage: Number(pkg.profitPercentage || 0),
      amount: Math.max(0, Number(amount || 0)),
      currency: String(currency || "AED").toUpperCase(),
      note: String(note || ""),
    });
    try {
      const io = getIO();
      io.to(`workspace:${ownerId}`).emit("investor.request.created", {
        id: String(doc._id),
      });
    } catch {}
    return res.status(201).json({ ok: true, request: doc });
  } catch (err) {
    console.error("Create investor request failed", err);
    return res.status(500).json({ message: "Failed to create request" });
  }
});

// List my requests (investor)
router.get("/requests", auth, allowRoles("investor"), async (req, res) => {
  try {
    const list = await InvestorRequest.find({ investor: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ requests: list });
  } catch (err) {
    res.status(500).json({ message: "Failed to load requests" });
  }
});
