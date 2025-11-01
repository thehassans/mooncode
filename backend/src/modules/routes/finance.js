import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { auth, allowRoles } from "../middleware/auth.js";
import Expense from "../models/Expense.js";
import Order from "../models/Order.js";
import Remittance from "../models/Remittance.js";
import ManagerRemittance from "../models/ManagerRemittance.js";
import AgentRemit from "../models/AgentRemit.js";
import InvestorRemittance from "../models/InvestorRemittance.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { getIO } from "../config/socket.js";
import Setting from "../models/Setting.js";
import { generatePayoutReceiptPDF } from "../utils/payoutReceipt.js";
import { generateSettlementPDF, generateAcceptedSettlementPDF } from "../../utils/generateSettlementPDF.js";
import { generateCommissionPayoutPDF } from "../../utils/generateCommissionPayoutPDF.js";
import { generateAgentCommissionReceiptPDF } from "../../utils/generateAgentCommissionReceiptPDF.js";
import { generateAgentMonthlyReportPDF } from "../../utils/generateAgentMonthlyReportPDF.js";
import { generateDriverMonthlyReportPDF } from "../../utils/generateDriverMonthlyReportPDF.js";

const router = express.Router();

// Centralized currency config helpers
function defaultCurrencyConfig() {
  return {
    sarPerUnit: {
      SAR: 1,
      AED: 1.02,
      OMR: 9.78,
      BHD: 9.94,
      INR: 0.046,
      KWD: 12.2,
      QAR: 1.03,
      USD: 3.75,
      CNY: 0.52,
    },
    pkrPerUnit: {
      AED: 76,
      OMR: 726,
      SAR: 72,
      BHD: 830,
      KWD: 880,
      QAR: 79,
      INR: 3.3,
      USD: 278,
      CNY: 39,
    },
    enabled: ["AED", "OMR", "SAR", "BHD", "INR", "KWD", "QAR", "USD", "CNY"],
    updatedAt: new Date(),
  };
}
async function getCurrencyConfig() {
  try {
    const doc = await Setting.findOne({ key: "currency" }).lean();
    const val = (doc && doc.value) || {};
    const base = defaultCurrencyConfig();
    return {
      ...base,
      ...val,
      sarPerUnit: { ...base.sarPerUnit, ...(val?.sarPerUnit || {}) },
      pkrPerUnit: { ...base.pkrPerUnit, ...(val?.pkrPerUnit || {}) },
    };
  } catch {
    return defaultCurrencyConfig();
  }
}

// Multer config for receipt uploads (reuse uploads/ folder)
try {
  fs.mkdirSync("uploads", { recursive: true });
} catch {}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${Date.now()}${ext}`);
  },
});

// Reject remittance (manager)
router.post(
  "/remittances/:id/reject",
  auth,
  allowRoles("user", "manager"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const r = await Remittance.findById(id);
      if (!r) return res.status(404).json({ message: "Remittance not found" });
      // Scope: manager assigned OR owner of workspace
      if (
        req.user.role === "manager" &&
        String(r.manager) !== String(req.user.id)
      )
        return res.status(403).json({ message: "Not allowed" });
      if (req.user.role === "user" && String(r.owner) !== String(req.user.id))
        return res.status(403).json({ message: "Not allowed" });
      if (r.status !== "pending")
        return res.status(400).json({ message: "Already processed" });
      r.status = "rejected";
      r.acceptedAt = new Date();
      r.acceptedBy = req.user.id;
      await r.save();
      try {
        const io = getIO();
        io.to(`user:${String(r.driver)}`).emit("remittance.rejected", {
          id: String(r._id),
        });
      } catch {}
      return res.json({ message: "Remittance rejected", remittance: r });
    } catch (err) {
      return res.status(500).json({ message: "Failed to reject remittance" });
    }
  }
);

// Set proof verification (manager or owner)
router.post(
  "/remittances/:id/proof",
  auth,
  allowRoles("user", "manager"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { ok } = req.body || {};
      const r = await Remittance.findById(id);
      if (!r) return res.status(404).json({ message: "Remittance not found" });
      // Scope: manager assigned OR owner of workspace
      if (
        req.user.role === "manager" &&
        String(r.manager) !== String(req.user.id)
      )
        return res.status(403).json({ message: "Not allowed" });
      if (req.user.role === "user" && String(r.owner) !== String(req.user.id))
        return res.status(403).json({ message: "Not allowed" });
      r.proofOk =
        ok === true || ok === "true"
          ? true
          : ok === false || ok === "false"
          ? false
          : null;
      await r.save();
      return res.json({ ok: true, remittance: r });
    } catch (err) {
      return res.status(500).json({ message: "Failed to set proof status" });
    }
  }
);
const upload = multer({ storage });

// Create expense (admin, user, agent, manager)
router.post(
  "/expenses",
  auth,
  allowRoles("admin", "user", "agent", "manager"),
  async (req, res) => {
    const { title, type, category, amount, currency, country, notes, incurredAt } =
      req.body || {};
    if (!title || amount == null)
      return res.status(400).json({ message: "Missing title or amount" });
    
    // Validate advertisement expenses have a country
    if (type === 'advertisement' && !country) {
      return res.status(400).json({ message: "Advertisement expenses must specify a country" });
    }
    
    // Manager expenses need approval, others are auto-approved
    const status = req.user.role === 'manager' ? 'pending' : 'approved';
    
    const doc = new Expense({
      title,
      type: type || 'general',
      category,
      amount: Math.max(0, Number(amount || 0)),
      currency: currency || "SAR",
      country: type === 'advertisement' ? country : undefined,
      notes,
      incurredAt: incurredAt ? new Date(incurredAt) : new Date(),
      createdBy: req.user.id,
      status,
    });
    await doc.save();
    
    // Populate createdBy for response
    await doc.populate('createdBy', 'firstName lastName email role');
    
    return res.status(201).json({ message: "Expense created", expense: doc });
  }
);

// --- Agent Remittances (Agent -> Approver: user or manager) ---
// Create agent remit request (agent -> owner user)
router.post(
  "/agent-remittances",
  auth,
  allowRoles("agent"),
  async (req, res) => {
    try {
      const { amount, note } = req.body || {};
      if (amount == null)
        return res.status(400).json({ message: "amount is required" });
      const me = await User.findById(req.user.id).select("createdBy");
      const ownerId = me?.createdBy;
      if (!ownerId)
        return res.status(400).json({ message: "No workspace owner" });
      const approverId = ownerId;
      const role = "user";
      // Validate amount against available wallet (delivered commissions at 12% minus sent payouts)
      const cfg = await getCurrencyConfig();
      const fx = cfg.pkrPerUnit || {};
      const orders = await Order.find({
        createdBy: req.user.id,
        shipmentStatus: "delivered",
      }).populate("productId", "price baseCurrency quantity");
      let deliveredCommissionPKR = 0;
      for (const o of orders) {
        if (o?.agentCommissionPKR && Number(o.agentCommissionPKR) > 0) {
          deliveredCommissionPKR += Number(o.agentCommissionPKR);
          continue;
        }
        const totalVal =
          o.total != null
            ? Number(o.total)
            : Number(o?.productId?.price || 0) *
              Math.max(1, Number(o?.quantity || 1));
        const cur = [
          "AED",
          "OMR",
          "SAR",
          "BHD",
          "KWD",
          "QAR",
          "INR",
          "USD",
          "CNY",
        ].includes(String(o?.productId?.baseCurrency))
          ? o.productId.baseCurrency
          : "SAR";
        const rate = fx[cur] || 0;
        deliveredCommissionPKR += totalVal * 0.12 * rate;
      }
      // Sum of already sent payouts
      const sentRows = await AgentRemit.aggregate([
        {
          $match: {
            agent: new (
              await import("mongoose")
            ).default.Types.ObjectId(req.user.id),
            status: "sent",
          },
        },
        {
          $group: {
            _id: "$currency",
            total: { $sum: { $ifNull: ["$amount", 0] } },
          },
        },
      ]);
      const totalSentPKR = sentRows.reduce(
        (s, r) => s + (r?._id === "PKR" ? Number(r.total || 0) : 0),
        0
      );
      const available = Math.max(
        0,
        Math.round(deliveredCommissionPKR) - totalSentPKR
      );
      const amt = Math.max(0, Number(amount || 0));
      if (amt < 10000) {
        return res
          .status(400)
          .json({ message: "Minimum withdraw amount is PKR 10000" });
      }
      if (amt > available) {
        return res
          .status(400)
          .json({
            message: `Amount exceeds available wallet. Available: PKR ${available}`,
          });
      }
      const doc = new AgentRemit({
        agent: req.user.id,
        owner: ownerId,
        approver: approverId,
        approverRole: role,
        amount: amt,
        currency: "PKR",
        note: note || "",
        status: "pending",
      });
      await doc.save();
      try {
        const io = getIO();
        io.to(`user:${String(approverId)}`).emit("agentRemit.created", {
          id: String(doc._id),
        });
      } catch {}
      return res.status(201).json({ message: "Request submitted", remit: doc });
    } catch (err) {
      return res.status(500).json({ message: "Failed to submit request" });
    }
  }
);

// List agent remittances
router.get(
  "/agent-remittances",
  auth,
  allowRoles("agent", "manager", "user"),
  async (req, res) => {
    try {
      let match = {};
      if (req.user.role === "agent") match.agent = req.user.id;
      if (req.user.role === "manager")
        match = { approver: req.user.id, approverRole: "manager" };
      if (req.user.role === "user")
        match = { approver: req.user.id, approverRole: "user" };
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const skip = (page - 1) * limit;
      const total = await AgentRemit.countDocuments(match);
      const items = await AgentRemit.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("agent", "firstName lastName email phone payoutProfile");
      const hasMore = skip + items.length < total;
      return res.json({ remittances: items, page, limit, total, hasMore });
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Failed to load agent remittances" });
    }
  }
);

// Approve agent remittance (user or manager)
router.post(
  "/agent-remittances/:id/approve",
  auth,
  allowRoles("user", "manager"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const r = await AgentRemit.findById(id);
      if (!r) return res.status(404).json({ message: "Request not found" });
      if (String(r.approver) !== String(req.user.id))
        return res.status(403).json({ message: "Not allowed" });
      if (r.status !== "pending")
        return res.status(400).json({ message: "Already processed" });
      r.status = "approved";
      r.approvedAt = new Date();
      r.approvedBy = req.user.id;
      await r.save();
      try {
        const io = getIO();
        io.to(`user:${String(r.agent)}`).emit("agentRemit.approved", {
          id: String(r._id),
        });
      } catch {}
      return res.json({ message: "Approved", remit: r });
    } catch (err) {
      return res.status(500).json({ message: "Failed to approve" });
    }
  }
);

// Mark agent remittance as sent (owner user). Allows sending directly from pending with custom amount.
router.post(
  "/agent-remittances/:id/send",
  auth,
  allowRoles("user"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const r = await AgentRemit.findById(id);
      if (!r) return res.status(404).json({ message: "Request not found" });
      if (String(r.approver) !== String(req.user.id))
        return res.status(403).json({ message: "Not allowed" });
      const bodyAmt = Number(req.body?.amount ?? r.amount);
      const amt = Math.max(0, bodyAmt);
      if (amt < 10000)
        return res
          .status(400)
          .json({ message: "Minimum amount to send is PKR 10000" });
      // Recompute available for the agent
      const cfg = await getCurrencyConfig();
      const fx = cfg.pkrPerUnit || {};
      const orders = await Order.find({
        createdBy: r.agent,
        shipmentStatus: "delivered",
      }).populate("productId", "price baseCurrency quantity");
      let deliveredCommissionPKR = 0;
      for (const o of orders) {
        const totalVal =
          o.total != null
            ? Number(o.total)
            : Number(o?.productId?.price || 0) *
              Math.max(1, Number(o?.quantity || 1));
        const cur = [
          "AED",
          "OMR",
          "SAR",
          "BHD",
          "KWD",
          "QAR",
          "INR",
          "USD",
          "CNY",
        ].includes(String(o?.productId?.baseCurrency))
          ? o.productId.baseCurrency
          : "SAR";
        const rate = fx[cur] || 0;
        deliveredCommissionPKR += totalVal * 0.12 * rate;
      }
      const sentRows = await AgentRemit.aggregate([
        {
          $match: {
            agent: new (
              await import("mongoose")
            ).default.Types.ObjectId(r.agent),
            status: "sent",
          },
        },
        {
          $group: {
            _id: "$currency",
            total: { $sum: { $ifNull: ["$amount", 0] } },
          },
        },
      ]);
      const totalSentPKR = sentRows.reduce(
        (s, rr) => s + (rr?._id === "PKR" ? Number(rr.total || 0) : 0),
        0
      );
      const available = Math.max(
        0,
        Math.round(deliveredCommissionPKR) - totalSentPKR
      );
      if (amt > available)
        return res
          .status(400)
          .json({
            message: `Amount exceeds available wallet. Available: PKR ${available}`,
          });
      // Update remit to sent with specified amount
      r.amount = amt;
      r.status = "sent";
      r.sentAt = new Date();
      r.sentBy = req.user.id;
      await r.save();
      // Generate and send PDF receipt via WhatsApp
      try {
        const agent = await User.findById(r.agent).select(
          "firstName lastName phone"
        );
        const pdfPath = await generatePayoutReceiptPDF(agent, amt);
        // Lazy WA import (same pattern as users route)
        const getWA = async () => {
          const enabled = process.env.ENABLE_WA !== "false";
          if (!enabled) return { sendDocument: async () => ({ ok: true }) };
          try {
            const mod = await import("../services/whatsapp.js");
            return mod?.default || mod;
          } catch {
            return { sendDocument: async () => ({ ok: true }) };
          }
        };
        const wa = await getWA();
        const digits = String(agent?.phone || "").replace(/\D/g, "");
        if (digits) {
          await wa.sendDocument(
            `${digits}@s.whatsapp.net`,
            pdfPath,
            "receipt.pdf",
            "Payout Receipt"
          );
        }
      } catch (e) {
        try {
          console.warn("payout receipt send failed", e?.message || e);
        } catch {}
      }
      try {
        const io = getIO();
        io.to(`user:${String(r.agent)}`).emit("agentRemit.sent", {
          id: String(r._id),
        });
      } catch {}
      return res.json({ message: "Sent", remit: r });
    } catch (err) {
      return res.status(500).json({ message: "Failed to mark as sent" });
    }
  }
);

// Agent wallet summary (sum of sent remittances by currency)
router.get(
  "/agent-remittances/wallet",
  auth,
  allowRoles("agent"),
  async (req, res) => {
    try {
      const rows = await AgentRemit.aggregate([
        {
          $match: {
            agent: new (
              await import("mongoose")
            ).default.Types.ObjectId(req.user.id),
            status: "sent",
          },
        },
        {
          $group: {
            _id: "$currency",
            total: { $sum: { $ifNull: ["$amount", 0] } },
          },
        },
      ]);
      const byCurrency = {};
      for (const r of rows) {
        byCurrency[r._id || ""] = r.total;
      }
      return res.json({ byCurrency });
    } catch (err) {
      return res.status(500).json({ message: "Failed to load wallet" });
    }
  }
);

// List expenses (admin => all; user => own+agents+managers; agent => own; manager => own)
router.get(
  "/expenses",
  auth,
  allowRoles("admin", "user", "agent", "manager"),
  async (req, res) => {
    const User = (await import("../models/User.js")).default;
    let match = {};
    if (req.user.role === "admin") {
      match = {};
    } else if (req.user.role === "user") {
      // User sees: own expenses + agents' expenses + managers' expenses
      const agents = await User.find(
        { role: "agent", createdBy: req.user.id },
        { _id: 1 }
      ).lean();
      const managers = await User.find(
        { role: "manager", createdBy: req.user.id },
        { _id: 1 }
      ).lean();
      const ids = [...agents.map((a) => a._id.toString()), ...managers.map((m) => m._id.toString())];
      match = { createdBy: { $in: [req.user.id, ...ids] } };
    } else if (req.user.role === "manager") {
      // Manager sees only their own expenses
      match = { createdBy: req.user.id };
    } else {
      // Agent sees own
      match = { createdBy: req.user.id };
    }
    const items = await Expense.find(match)
      .sort({ incurredAt: -1 })
      .populate('createdBy', 'firstName lastName email role')
      .populate('approvedBy', 'firstName lastName email')
      .lean();
    const total = items.reduce((a, b) => a + Number(b.amount || 0), 0);
    res.json({ expenses: items, total });
  }
);

// Approve expense (user only - for manager expenses)
router.post(
  "/expenses/:id/approve",
  auth,
  allowRoles("user"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const expense = await Expense.findById(id).populate('createdBy', 'firstName lastName role createdBy');
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      // Verify the expense creator is a manager created by this user
      if (expense.createdBy?.role !== 'manager' || String(expense.createdBy?.createdBy) !== String(req.user.id)) {
        return res.status(403).json({ message: "You can only approve expenses from your managers" });
      }
      
      if (expense.status !== 'pending') {
        return res.status(400).json({ message: "Expense is not pending approval" });
      }
      
      expense.status = 'approved';
      expense.approvedBy = req.user.id;
      expense.approvedAt = new Date();
      await expense.save();
      
      await expense.populate('approvedBy', 'firstName lastName email');
      
      res.json({ message: "Expense approved successfully", expense });
    } catch (err) {
      res.status(500).json({ message: "Failed to approve expense", error: err?.message });
    }
  }
);

// Reject expense (user only - for manager expenses)
router.post(
  "/expenses/:id/reject",
  auth,
  allowRoles("user"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const expense = await Expense.findById(id).populate('createdBy', 'firstName lastName role createdBy');
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      // Verify the expense creator is a manager created by this user
      if (expense.createdBy?.role !== 'manager' || String(expense.createdBy?.createdBy) !== String(req.user.id)) {
        return res.status(403).json({ message: "You can only reject expenses from your managers" });
      }
      
      if (expense.status !== 'pending') {
        return res.status(400).json({ message: "Expense is not pending approval" });
      }
      
      expense.status = 'rejected';
      expense.approvedBy = req.user.id;
      expense.approvedAt = new Date();
      expense.rejectionReason = reason || '';
      await expense.save();
      
      await expense.populate('approvedBy', 'firstName lastName email');
      
      res.json({ message: "Expense rejected", expense });
    } catch (err) {
      res.status(500).json({ message: "Failed to reject expense", error: err?.message });
    }
  }
);

// Transactions: derive from orders and expenses
router.get(
  "/transactions",
  auth,
  allowRoles("admin", "user"),
  async (req, res) => {
    // Optional: ?start=ISO&end=ISO
    const start = req.query.start ? new Date(req.query.start) : null;
    const end = req.query.end ? new Date(req.query.end) : null;

    // scope orders
    let matchOrders = {};
    if (start || end) {
      matchOrders.createdAt = {};
      if (start) matchOrders.createdAt.$gte = start;
      if (end) matchOrders.createdAt.$lte = end;
    }
    if (req.user.role === "user") {
      const User = (await import("../models/User.js")).default;
      const agents = await User.find(
        { role: "agent", createdBy: req.user.id },
        { _id: 1 }
      ).lean();
      const ids = agents.map((a) => a._id);
      matchOrders.createdBy = { $in: [req.user.id, ...ids] };
    }
    const orders = await Order.find(matchOrders).lean();

    // scope expenses
    let matchExp = {};
    if (start || end) {
      matchExp.incurredAt = {};
      if (start) matchExp.incurredAt.$gte = start;
      if (end) matchExp.incurredAt.$lte = end;
    }
    if (req.user.role === "user") {
      const User = (await import("../models/User.js")).default;
      const agents = await User.find(
        { role: "agent", createdBy: req.user.id },
        { _id: 1 }
      ).lean();
      const ids = agents.map((a) => a._id);
      matchExp.createdBy = { $in: [req.user.id, ...ids] };
    }
    const expenses = await Expense.find(matchExp).lean();

    // Build transactions
    const tx = [];
    for (const o of orders) {
      // credit: money received from courier on settlement OR collected cash on delivery
      if (o.settled && o.receivedFromCourier > 0) {
        tx.push({
          date: o.settledAt || o.updatedAt || o.createdAt,
          type: "credit",
          source: "settlement",
          ref: `ORD-${o._id}`,
          amount: Number(o.receivedFromCourier || 0),
          currency: "SAR",
          notes: "Courier settlement",
        });
      } else if (
        (o.collectedAmount || 0) > 0 &&
        String(o.shipmentStatus || "").toLowerCase() === "delivered"
      ) {
        tx.push({
          date: o.deliveredAt || o.updatedAt || o.createdAt,
          type: "credit",
          source: "delivery",
          ref: `ORD-${o._id}`,
          amount: Number(o.collectedAmount || 0),
          currency: "SAR",
          notes: "COD collected",
        });
      }
      // debits: shipping fee
      if ((o.shippingFee || 0) > 0) {
        tx.push({
          date: o.updatedAt || o.createdAt,
          type: "debit",
          source: "shipping",
          ref: `ORD-${o._id}`,
          amount: Number(o.shippingFee || 0),
          currency: "SAR",
          notes: "Shipping cost",
        });
      }
    }
    for (const e of expenses) {
      tx.push({
        date: e.incurredAt || e.createdAt,
        type: "debit",
        source: "expense",
        ref: `EXP-${e._id}`,
        amount: Number(e.amount || 0),
        currency: e.currency || "SAR",
        notes: e.title,
      });
    }

    tx.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totals = tx.reduce(
      (acc, t) => {
        if (t.type === "credit") acc.credits += t.amount;
        else acc.debits += t.amount;
        acc.net = acc.credits - acc.debits;
        return acc;
      },
      { credits: 0, debits: 0, net: 0 }
    );

    res.json({ transactions: tx, totals });
  }
);

// --- Remittances (Driver -> Manager) ---
// Helper: currency by country
function currencyFromCountry(country) {
  const map = {
    KSA: "SAR",
    "Saudi Arabia": "SAR",
    SA: "SAR",
    UAE: "AED",
    AE: "AED",
    Oman: "OMR",
    OM: "OMR",
    Bahrain: "BHD",
    BH: "BHD",
    India: "INR",
    IN: "INR",
    Kuwait: "KWD",
    KW: "KWD",
    Qatar: "QAR",
    QA: "QAR",
  };
  const key = String(country || "").trim();
  return map[key] || "";
}

// List remittances in scope (Driver -> Manager)
router.get(
  "/remittances",
  auth,
  allowRoles("admin", "user", "manager", "driver"),
  async (req, res) => {
    try {
      let match = {};
      if (req.user.role === "admin") {
        // no extra scoping
      } else if (req.user.role === "user") {
        match.owner = req.user.id;
      } else if (req.user.role === "manager") {
        // Option: when workspace=1, include all remittances in the manager's workspace (owner scope)
        const wantWorkspace = String(req.query.workspace || "").toLowerCase();
        if (
          wantWorkspace === "1" ||
          wantWorkspace === "true" ||
          wantWorkspace === "yes"
        ) {
          try {
            const me = await User.findById(req.user.id)
              .select("createdBy")
              .lean();
            const ownerId = String(me?.createdBy || "");
            if (ownerId) {
              match.owner = ownerId;
            } else {
              match.manager = req.user.id;
            }
          } catch {
            match.manager = req.user.id;
          }
        } else {
          match.manager = req.user.id;
        }
      } else if (req.user.role === "driver") {
        match.driver = req.user.id;
      }
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const skip = (page - 1) * limit;
      const total = await Remittance.countDocuments(match);
      const items = await Remittance.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("driver", "firstName lastName email country")
        .populate("manager", "firstName lastName email country role");
      const hasMore = skip + items.length < total;
      return res.json({ remittances: items, page, limit, total, hasMore });
    } catch (err) {
      return res.status(500).json({ message: "Failed to list remittances" });
    }
  }
);

// Create remittance (driver)
router.post(
  "/remittances",
  auth,
  allowRoles("driver"),
  upload.any(),
  async (req, res) => {
    try {
      const {
        managerId = "",
        amount,
        fromDate,
        toDate,
        note = "",
        method = "hand",
        paidToName = "",
      } = req.body || {};
      if (amount == null)
        return res.status(400).json({ message: "amount is required" });
      const me = await User.findById(req.user.id).select("createdBy country");
      const ownerId = String(me?.createdBy || "");
      if (!ownerId)
        return res.status(400).json({ message: "No workspace owner" });
      // Determine approver: manager if provided and valid, else owner
      let managerRef = ownerId;
      let mgrDoc = null;
      if (managerId) {
        const mgr = await User.findById(managerId);
        if (!mgr || mgr.role !== "manager")
          return res.status(400).json({ message: "Manager not found" });
        if (String(mgr.createdBy) !== ownerId) {
          return res
            .status(403)
            .json({ message: "Manager not in your workspace" });
        }
        managerRef = String(mgr._id);
        mgrDoc = mgr;
      }
      // Do not allow submitting a new remittance while another one is pending
      const existingPending = await Remittance.findOne({
        driver: req.user.id,
        status: "pending",
      }).select("_id amount createdAt");
      if (existingPending) {
        return res.status(400).json({
          message:
            "You already have a pending remittance awaiting approval. Please wait until it is accepted or rejected.",
          pending: {
            id: String(existingPending._id),
            amount: Number(existingPending.amount || 0),
            createdAt: existingPending.createdAt,
          },
        });
      }
      // Validate available pending amount: COLLECTED amounts - accepted remittances
      // Get ALL delivered orders to calculate total collected (not filtered by date)
      const allDeliveredOrders = await Order.find({
        deliveryBoy: req.user.id,
        shipmentStatus: "delivered"
      })
        .select("total collectedAmount productId quantity items grandTotal subTotal")
        .populate("productId", "name price")
        .populate("items.productId", "name price");
      const totalCollectedAmount = allDeliveredOrders.reduce((sum, o) => {
        let val = 0;
        if (o?.collectedAmount != null && Number(o.collectedAmount) > 0) {
          val = Number(o.collectedAmount) || 0;
        } else if (o?.total != null) {
          val = Number(o.total) || 0;
        } else if (Array.isArray(o?.items) && o.items.length) {
          val = o.items.reduce(
            (s, it) =>
              s +
              Number(it?.productId?.price || 0) *
                Math.max(1, Number(it?.quantity || 1)),
            0
          );
        } else {
          const unit = Number(o?.productId?.price || 0);
          const qty = Math.max(1, Number(o?.quantity || 1));
          val = unit * qty;
        }
        return sum + val;
      }, 0);
      const M = (await import("mongoose")).default;
      const remitRows = await Remittance.aggregate([
        {
          $match: {
            driver: new M.Types.ObjectId(req.user.id),
            status: "accepted",
          },
        },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
      ]);
      const deliveredToCompany =
        remitRows && remitRows[0] ? Number(remitRows[0].total || 0) : 0;
      const pendingToCompany = Math.max(
        0,
        totalCollectedAmount - deliveredToCompany
      );
      const amt = Math.max(0, Number(amount || 0));
      if (!Number.isFinite(amt) || amt <= 0)
        return res.status(400).json({ message: "Invalid amount" });
      if (amt > pendingToCompany)
        return res
          .status(400)
          .json({
            message: `Amount exceeds pending. Pending: ${pendingToCompany.toFixed(
              2
            )}`,
          });
      // Optional country match
      if (
        mgrDoc &&
        me?.country &&
        mgrDoc?.country &&
        String(me.country) !== String(mgrDoc.country)
      ) {
        return res
          .status(400)
          .json({ message: "Manager country must match your country" });
      }
      // Compute delivered orders count in range for this driver
      const matchOrders = {
        deliveryBoy: req.user.id,
        shipmentStatus: "delivered",
      };
      if (fromDate || toDate) {
        matchOrders.deliveredAt = {};
        if (fromDate) matchOrders.deliveredAt.$gte = new Date(fromDate);
        if (toDate) matchOrders.deliveredAt.$lte = new Date(toDate);
      }
      const totalDeliveredOrders = await Order.countDocuments(matchOrders);
      // Extract receipt file (any image)
      const files = Array.isArray(req.files) ? req.files : [];
      const receiptFile =
        files.find((f) =>
          ["receipt", "proof", "screenshot", "file", "image"].includes(
            String(f.fieldname || "").toLowerCase()
          )
        ) || files[0];
      const receiptPath = receiptFile ? `/uploads/${receiptFile.filename}` : "";
      if (String(method || "").toLowerCase() === "transfer" && !receiptPath) {
        return res
          .status(400)
          .json({ message: "Proof image is required for transfer method" });
      }

      const doc = new Remittance({
        driver: req.user.id,
        manager: managerRef,
        owner: ownerId,
        country: me?.country || "",
        currency: currencyFromCountry(me?.country || ""),
        amount: Math.max(0, Number(amount || 0)),
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        totalDeliveredOrders,
        note: note || "",
        method:
          String(method || "hand").toLowerCase() === "transfer"
            ? "transfer"
            : "hand",
        paidToName: String(paidToName || "").trim(),
        receiptPath,
        status: "pending",
      });
      await doc.save();
      
      // Generate PDF settlement summary with comprehensive data
      try {
        const driver = await User.findById(req.user.id).select('firstName lastName phone commission paidCommission driverProfile');
        const manager = await User.findById(managerRef).select('firstName lastName');
        
        // Get orders for PDF - only pending orders (after last remittance)
        const acceptedRemittances = await Remittance.find({
          driver: req.user.id,
          status: 'accepted'
        }).select('createdAt');
        
        const lastAcceptedDate = acceptedRemittances.length > 0 
          ? new Date(Math.max(...acceptedRemittances.map(r => new Date(r.createdAt))))
          : new Date(0);
        
        const deliveredOrders = await Order.find({
          deliveryBoy: req.user.id,
          shipmentStatus: "delivered",
          deliveredAt: { $gt: lastAcceptedDate }  // Only orders after last remittance
        })
          .select("invoiceNumber customerName shipmentStatus deliveredAt total collectedAmount productId quantity items grandTotal subTotal driverCommission")
          .populate("productId", "name price")
          .populate("items.productId", "name price");
        
        // Get order statistics for the driver
        // Count ALL orders ever assigned to this driver (not just currently assigned)
        const assignedCount = await Order.countDocuments({ deliveryBoy: req.user.id });
        const cancelledCount = await Order.countDocuments({ 
          deliveryBoy: req.user.id, 
          $or: [{ shipmentStatus: 'cancelled' }, { shipmentStatus: 'returned' }] 
        });
        
        // Calculate commission based on per-order commission
        const commissionPerOrder = Number(driver?.driverProfile?.commissionPerOrder || 0);
        const commissionCurrency = driver?.driverProfile?.commissionCurrency || doc.currency || 'SAR';
        
        // Total commission = sum of each order's driverCommission (use driver's rate as fallback)
        const totalCommission = deliveredOrders.reduce((sum, o) => {
          const orderCommission = Number(o.driverCommission) || 0;
          // If order has no commission set, use driver's default rate
          return sum + (orderCommission > 0 ? orderCommission : commissionPerOrder)
        }, 0);
        
        // Get total paid commission from accepted remittances
        const paidRemittances = await Remittance.find({
          driver: req.user.id,
          status: 'accepted'
        });
        const paidCommission = paidRemittances.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        
        // Pending commission = total earned - already paid
        const pendingCommission = Math.max(0, totalCommission - paidCommission);
        
        const pdfPath = await generateSettlementPDF({
          driverName: `${driver?.firstName || ''} ${driver?.lastName || ''}`.trim() || 'N/A',
          driverPhone: driver?.phone || '',
          driverCommissionRate: commissionPerOrder,
          managerName: `${manager?.firstName || ''} ${manager?.lastName || ''}`.trim() || 'N/A',
          totalDeliveredOrders,
          assignedOrders: assignedCount,
          cancelledOrders: cancelledCount,
          collectedAmount: totalCollectedAmount,
          deliveredToCompany,
          pendingDeliveryToCompany: pendingToCompany,
          amount: doc.amount,
          totalCommission,
          paidCommission,
          pendingCommission,
          currency: doc.currency,
          method: doc.method,
          receiptPath: doc.receiptPath,
          fromDate: doc.fromDate,
          toDate: doc.toDate,
          note: doc.note,
          orders: deliveredOrders.map(o => ({
            invoiceNumber: o.invoiceNumber || String(o._id).slice(-6),
            customerName: o.customerName || 'N/A',
            status: o.shipmentStatus || 'delivered',
            deliveredAt: o.deliveredAt,
            items: (o.items || []).map(item => ({
              name: item.productId?.name || 'Unknown Product',
              quantity: item.quantity || 1,
              price: item.productId?.price || 0
            })),
            subTotal: o.subTotal || o.total || o.collectedAmount || 0,
            commission: Number(o.driverCommission) > 0 ? Number(o.driverCommission) : commissionPerOrder
          }))
        });
        
        doc.pdfPath = pdfPath;
        await doc.save();
      } catch (pdfErr) {
        console.error('Failed to generate settlement PDF:', pdfErr);
        // Don't fail the entire operation if PDF generation fails
      }
      
      try {
        const io = getIO();
        io.to(`user:${String(managerRef)}`).emit("remittance.created", {
          id: String(doc._id),
        });
      } catch {}
      return res
        .status(201)
        .json({ message: "Remittance submitted", remittance: doc });
    } catch (err) {
      return res.status(500).json({ message: "Failed to submit remittance" });
    }
  }
);

// Accept remittance (manager or user/owner)
router.post(
  "/remittances/:id/accept",
  auth,
  allowRoles("user", "manager"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const r = await Remittance.findById(id);
      if (!r) return res.status(404).json({ message: "Remittance not found" });
      
      // Scope: manager assigned OR owner of workspace
      if (
        req.user.role === "manager" &&
        String(r.manager) !== String(req.user.id)
      )
        return res.status(403).json({ message: "Not allowed" });
      if (req.user.role === "user" && String(r.owner) !== String(req.user.id))
        return res.status(403).json({ message: "Not allowed" });
      
      // Two-step approval process
      if (req.user.role === "manager") {
        // Manager acceptance - first step
        if (r.status !== "pending")
          return res.status(400).json({ message: "Already processed" });
        r.status = "manager_accepted";
        r.managerAcceptedAt = new Date();
        r.managerAcceptedBy = req.user.id;
        await r.save();
        
        // Notify owner that manager accepted
        try {
          const io = getIO();
          io.to(`user:${String(r.owner)}`).emit("remittance.manager_accepted", {
            id: String(r._id),
          });
        } catch {}
        
        return res.json({ message: "Remittance accepted by manager", remittance: r });
      } else {
        // User/owner acceptance - final step
        if (r.status !== "pending" && r.status !== "manager_accepted")
          return res.status(400).json({ message: "Already processed or rejected" });
        r.status = "accepted";
        r.acceptedAt = new Date();
        r.acceptedBy = req.user.id;
        
        // Generate accepted PDF with ACCEPTED stamp for driver
        try {
          const driver = await User.findById(r.driver).select('firstName lastName phone commission paidCommission driverProfile');
          const manager = await User.findById(r.manager).select('firstName lastName');
          const acceptedByUser = await User.findById(req.user.id).select('firstName lastName');
          
          // Get order statistics for the driver
          const assignedCount = await Order.countDocuments({ deliveryBoy: r.driver });
          const cancelledCount = await Order.countDocuments({ 
            deliveryBoy: r.driver, 
            $or: [{ shipmentStatus: 'cancelled' }, { shipmentStatus: 'returned' }] 
          });
          
          // Calculate commission from delivered orders
          const commissionPerOrder = Number(driver?.driverProfile?.commissionPerOrder || 0);
          
          // Get financial data from original remittance (orders delivered up to this remittance)
          const deliveredOrders = await Order.find({
            deliveryBoy: r.driver,
            shipmentStatus: 'delivered',
            deliveredAt: { $lte: new Date(r.createdAt) }  // Orders delivered up to remittance date
          })
            .select("invoiceNumber customerName shipmentStatus deliveredAt total collectedAmount productId quantity items grandTotal subTotal driverCommission")
            .populate("productId", "name price")
            .populate("items.productId", "name price");
          
          // Calculate total commission from actual orders (use driver's rate as fallback)
          const totalCommission = deliveredOrders.reduce((sum, o) => {
            const orderCommission = Number(o.driverCommission) || 0;
            return sum + (orderCommission > 0 ? orderCommission : commissionPerOrder)
          }, 0);
          
          const paidRemittances = await Remittance.find({
            driver: r.driver,
            status: 'accepted'
          });
          const paidCommission = paidRemittances.reduce((sum, rem) => sum + (Number(rem.amount) || 0), 0);
          const pendingCommission = Math.max(0, totalCommission - paidCommission);
          const totalCollectedAmount = deliveredOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
          const deliveredToCompany = paidCommission;
          const pendingToCompany = Math.max(0, totalCollectedAmount - deliveredToCompany);
          
          // Generate minimal commission payout PDF
          const acceptedPdfPath = await generateCommissionPayoutPDF({
            driverName: `${driver?.firstName || ''} ${driver?.lastName || ''}`.trim() || 'N/A',
            driverPhone: driver?.phone || '',
            totalDeliveredOrders: deliveredOrders.length,
            totalCommissionPaid: r.amount,
            currency: r.currency,
            orders: deliveredOrders.map(o => ({
              orderId: o.invoiceNumber || String(o._id).slice(-6),
              deliveryDate: o.deliveredAt,
              commission: Number(o.driverCommission) > 0 ? Number(o.driverCommission) : commissionPerOrder
            }))
          });
          
          r.acceptedPdfPath = acceptedPdfPath;
        } catch (pdfErr) {
          console.error('Failed to generate accepted settlement PDF:', pdfErr);
          // Don't fail the entire operation if PDF generation fails
        }
        
        await r.save();
        
        // Update driver's paid commission
        try {
          const driver = await User.findById(r.driver);
          if (driver && driver.role === 'driver') {
            const acceptedRemittances = await Remittance.find({
              driver: r.driver,
              status: 'accepted'
            }).select('amount');
            const totalPaid = acceptedRemittances.reduce((sum, rem) => sum + (Number(rem.amount) || 0), 0);
            if (!driver.driverProfile) driver.driverProfile = {};
            driver.driverProfile.paidCommission = totalPaid;
            driver.markModified('driverProfile');
            await driver.save();
          }
        } catch (updateErr) {
          console.error('Failed to update driver paidCommission:', updateErr);
        }
        
        // Notify driver with accepted PDF
        try {
          const io = getIO();
          io.to(`user:${String(r.driver)}`).emit("remittance.accepted", {
            id: String(r._id),
            acceptedPdfPath: r.acceptedPdfPath
          });
        } catch {}
        
        return res.json({ message: "Remittance accepted", remittance: r });
      }
    } catch (err) {
      return res.status(500).json({ message: "Failed to accept remittance" });
    }
  }
);

// Download settlement PDF for remittance
router.get(
  "/remittances/:id/download-settlement",
  auth,
  allowRoles("user", "manager", "driver"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const r = await Remittance.findById(id).populate("driver manager");
      if (!r) return res.status(404).json({ message: "Remittance not found" });

      // Authorization: driver, manager assigned, or owner
      const isDriver = req.user.role === "driver" && String(r.driver?._id || r.driver) === String(req.user.id);
      const isManager = req.user.role === "manager" && String(r.manager?._id || r.manager) === String(req.user.id);
      const isOwner = req.user.role === "user" && String(r.owner) === String(req.user.id);
      
      if (!isDriver && !isManager && !isOwner) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Use acceptedPdfPath if accepted, otherwise use pdfPath
      const pdfPath = r.acceptedPdfPath || r.pdfPath;
      if (!pdfPath) {
        return res.status(404).json({ message: "Settlement PDF not available" });
      }

      const fullPath = path.join(process.cwd(), pdfPath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ message: "PDF file not found" });
      }

      // Send PDF file
      const fileName = `Settlement_${r.driver?.firstName || 'Driver'}_${new Date(r.createdAt).toLocaleDateString().replace(/\//g, '-')}.pdf`;
      res.download(fullPath, fileName, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
      });

    } catch (err) {
      console.error("Download settlement PDF error:", err);
      return res.status(500).json({ message: "Failed to download settlement" });
    }
  }
);

// Summary for driver: total delivered and collected in period
router.get(
  "/remittances/summary",
  auth,
  allowRoles("driver"),
  async (req, res) => {
    try {
      const { fromDate = "", toDate = "" } = req.query || {};
      const M = (await import("mongoose")).default;
      const match = {
        deliveryBoy: new M.Types.ObjectId(req.user.id),
        shipmentStatus: "delivered",
      };
      if (fromDate || toDate) {
        match.deliveredAt = {};
        if (fromDate) match.deliveredAt.$gte = new Date(fromDate);
        if (toDate) match.deliveredAt.$lte = new Date(toDate);
      }
      const deliveredOrders2 = await Order.find(match)
        .select("collectedAmount total productId quantity items")
        .populate("productId", "price")
        .populate("items.productId", "price");
      const totalDeliveredOrders = deliveredOrders2.length;
      const totalDeliveredValue = deliveredOrders2.reduce((sum, o) => {
        let val = 0;
        if (o?.collectedAmount != null && Number(o.collectedAmount) > 0) {
          val = Number(o.collectedAmount) || 0;
        } else if (o?.total != null) {
          val = Number(o.total) || 0;
        } else if (Array.isArray(o?.items) && o.items.length) {
          val = o.items.reduce(
            (s, it) =>
              s +
              Number(it?.productId?.price || 0) *
                Math.max(1, Number(it?.quantity || 1)),
            0
          );
        } else {
          const unit = Number(o?.productId?.price || 0);
          const qty = Math.max(1, Number(o?.quantity || 1));
          val = unit * qty;
        }
        return sum + val;
      }, 0);
      const me = await User.findById(req.user.id).select("country");
      const currency = currencyFromCountry(me?.country || "");
      const out = {
        totalDeliveredOrders,
        totalCollectedAmount: totalDeliveredValue,
      };
      // Sum of remittances already accepted (delivered to company)
      const remitRows = await Remittance.aggregate([
        {
          $match: {
            driver: new M.Types.ObjectId(req.user.id),
            status: "accepted",
          },
        },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
      ]);
      const deliveredToCompany =
        remitRows && remitRows[0] ? Number(remitRows[0].total || 0) : 0;
      const pendingToCompany = Math.max(
        0,
        Number(out.totalCollectedAmount || 0) - deliveredToCompany
      );
      // Cancelled count
      const totalCancelledOrders = await Order.countDocuments({
        deliveryBoy: new M.Types.ObjectId(req.user.id),
        shipmentStatus: "cancelled",
      });
      return res.json({
        ...out,
        currency,
        deliveredToCompany,
        pendingToCompany,
        totalCancelledOrders,
      });
    } catch (err) {
      return res.status(500).json({ message: "Failed to load summary" });
    }
  }
);

// Commission summary per agent for owner (admin/user)
router.get(
  "/agents/commission",
  auth,
  allowRoles("admin", "user"),
  async (req, res) => {
    try {
      // Find agents under this owner (or all if admin)
      let agentCond = { role: "agent" };
      if (req.user.role !== "admin") agentCond.createdBy = req.user.id;
      const agents = await User.find(
        agentCond,
        "firstName lastName phone _id payoutProfile"
      ).lean();
      const cfg = await getCurrencyConfig();
      const fx = cfg.pkrPerUnit || {};
      // Use same hardcoded rates as order delivery for consistency
      const FX_PKR = {
        AED: 76,
        OMR: 726,
        SAR: 72,
        BHD: 830,
        KWD: 880,
        QAR: 79,
        INR: 3.3,
      };
      const out = [];
      for (const a of agents) {
        const orders = await Order.find({ createdBy: a._id }).populate(
          "productId",
          "price baseCurrency quantity"
        );
        let deliveredCommissionPKR = 0;
        let upcomingCommissionPKR = 0;
        let ordersSubmitted = 0;
        let totalOrderValueAED = 0;
        const aedRate = FX_PKR["AED"] || 76;
        for (const o of orders) {
          const isDelivered =
            String(o?.shipmentStatus || "").toLowerCase() === "delivered";
          const isCancelled = ["cancelled", "returned"].includes(
            String(o?.shipmentStatus || "").toLowerCase()
          );
          if (isCancelled) continue;
          ordersSubmitted++;
          // Calculate order value in AED
          const totalVal =
            o.total != null
              ? Number(o.total)
              : Number(o?.productId?.price || 0) *
                Math.max(1, Number(o?.quantity || 1));
          const cur = [
            "AED",
            "OMR",
            "SAR",
            "BHD",
            "KWD",
            "QAR",
            "INR",
            "USD",
            "CNY",
          ].includes(String(o?.productId?.baseCurrency))
            ? o.productId.baseCurrency
            : "SAR";
          const curRate = FX_PKR[cur] || FX_PKR["SAR"] || 72;
          // Convert to PKR then to AED
          const valInPKR = totalVal * curRate;
          const valInAED = aedRate > 0 ? valInPKR / aedRate : 0;
          totalOrderValueAED += valInAED;
          let pkr = 0;
          // For delivered orders, always use stored commission if available
          if (
            isDelivered &&
            o?.agentCommissionPKR &&
            Number(o.agentCommissionPKR) > 0
          ) {
            pkr = Number(o.agentCommissionPKR);
          } else {
            // For non-delivered or orders without stored commission, calculate with same hardcoded rates
            pkr = Math.round(totalVal * 0.12 * curRate);
          }
          if (isDelivered) deliveredCommissionPKR += pkr;
          else upcomingCommissionPKR += pkr;
        }
        deliveredCommissionPKR = Math.round(deliveredCommissionPKR);
        upcomingCommissionPKR = Math.round(upcomingCommissionPKR);
        totalOrderValueAED = Math.round(totalOrderValueAED);
        // Sent (withdrawn)
        const sentRows = await AgentRemit.aggregate([
          {
            $match: {
              agent: new (
                await import("mongoose")
              ).default.Types.ObjectId(a._id),
              status: "sent",
            },
          },
          {
            $group: {
              _id: "$currency",
              total: { $sum: { $ifNull: ["$amount", 0] } },
            },
          },
        ]);
        const withdrawnPKR = sentRows.reduce(
          (s, r) => s + (r?._id === "PKR" ? Number(r.total || 0) : 0),
          0
        );
        // Pending requests amount
        const pendRows = await AgentRemit.aggregate([
          {
            $match: {
              agent: new (
                await import("mongoose")
              ).default.Types.ObjectId(a._id),
              status: "pending",
            },
          },
          {
            $group: {
              _id: "$currency",
              total: { $sum: { $ifNull: ["$amount", 0] } },
            },
          },
        ]);
        const pendingPKR = pendRows.reduce(
          (s, r) => s + (r?._id === "PKR" ? Number(r.total || 0) : 0),
          0
        );
        out.push({
          id: String(a._id),
          name: `${a.firstName || ""} ${a.lastName || ""}`.trim(),
          phone: a.phone || "",
          payoutProfile: a.payoutProfile || {},
          ordersSubmitted,
          totalOrderValueAED,
          deliveredCommissionPKR,
          upcomingCommissionPKR,
          withdrawnPKR,
          pendingPKR,
        });
      }
      return res.json({ agents: out });
    } catch (err) {
      return res.status(500).json({ message: "Failed to compute commission" });
    }
  }
);

// Pay commission to agent (admin/user)
router.post(
  "/agents/:id/pay-commission",
  auth,
  allowRoles("admin", "user"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body || {};
      const amt = Number(amount);
      if (Number.isNaN(amt) || amt <= 0)
        return res.status(400).json({ message: "Invalid amount" });

      const agent = await User.findOne({ _id: id, role: "agent" });
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      if (
        req.user.role !== "admin" &&
        String(agent.createdBy) !== String(req.user.id)
      ) {
        return res.status(403).json({ message: "Not allowed" });
      }

      // Fetch agent's orders for PDF
      let orders = [];
      let totalSubmitted = 0;
      let totalDelivered = 0;
      try {
        const agentOrders = await Order.find({ agent: id })
          .populate('productId', 'price baseCurrency')
          .lean();
        
        orders = agentOrders
          .filter(o => String(o.shipmentStatus || '').toLowerCase() === 'delivered')
          .map(o => {
            const price = o.total || o.productId?.price || 0;
            const currency = o.items?.[0]?.productId?.baseCurrency || o.productId?.baseCurrency || 'AED';
            return {
              orderId: o.invoiceId || `INV-${o._id.toString().slice(-8)}`,
              date: o.updatedAt || o.createdAt,
              amount: price,
              currency: currency
            };
          });
        
        totalSubmitted = agentOrders.length;
        totalDelivered = orders.length;
      } catch (err) {
        console.error('Error fetching agent orders:', err);
      }

      // Currency conversion (PKR to AED at ~76 PKR = 1 AED)
      const pkrToAed = 0.0132; // Approximate rate
      const amountAED = amt * pkrToAed;

      // Generate PDF receipt
      let pdfPath = null;
      try {
        pdfPath = await generateAgentCommissionReceiptPDF({
          agentName: `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'Agent',
          agentPhone: agent.phone || '',
          totalSubmitted,
          totalDelivered,
          amountAED,
          amountPKR: amt,
          orders
        });
      } catch (err) {
        console.error('Error generating commission receipt PDF:', err);
      }

      // Send PDF via WhatsApp
      if (pdfPath && agent.phone) {
        try {
          const getWA = async () => {
            const enabled = process.env.ENABLE_WA !== 'false';
            if (!enabled) return { sendDocument: async () => ({ ok: true }), sendText: async () => ({ ok: true }) };
            try {
              const mod = await import('../services/whatsapp.js');
              return mod?.default || mod;
            } catch {
              return { sendDocument: async () => ({ ok: true }), sendText: async () => ({ ok: true }) };
            }
          };
          const wa = await getWA();
          const digits = String(agent.phone || '').replace(/\D/g, '');
          if (digits) {
            const jid = `${digits}@s.whatsapp.net`;
            const fullPath = path.join(process.cwd(), pdfPath);
            
            // Send document
            await wa.sendDocument(jid, fullPath, `Commission_Receipt_${Date.now()}.pdf`, 
              `🎉 *Commission Payment Received!*\n\n` +
              `Amount: PKR ${amt.toLocaleString()}\n` +
              `Thank you for your excellent work!\n\n` +
              `BuySial Commerce`
            );
            
            // Clean up file after sending
            setTimeout(() => {
              try {
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
              } catch {}
            }, 5000);
          }
        } catch (err) {
          console.error('Error sending commission receipt via WhatsApp:', err);
        }
      }

      // Create an agent remittance record marking commission payment
      const remit = new AgentRemit({
        agent: id,
        owner: agent.createdBy || req.user.id,
        approver: req.user.id,
        approverRole: req.user.role === "user" ? "user" : "manager",
        amount: amt,
        currency: "PKR",
        note: "Commission payment",
        status: "sent",
        sentAt: new Date(),
        sentBy: req.user.id,
      });
      await remit.save();

      // Notify agent
      try {
        const io = getIO();
        io.to(`user:${id}`).emit("commission.paid", { amount: amt });
      } catch {}

      return res.json({ ok: true, message: "Commission paid successfully" });
    } catch (err) {
      console.error("Pay agent commission error:", err);
      return res.status(500).json({ message: "Failed to pay commission" });
    }
  }
);

// Download commission receipt PDF for agent
router.get(
  "/agent-remittances/:id/download-receipt",
  auth,
  allowRoles("agent", "admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find the remittance
      const remit = await AgentRemit.findById(id).populate('agent', 'firstName lastName phone');
      if (!remit) {
        return res.status(404).json({ message: "Remittance not found" });
      }

      // Check permission - agent can only see their own
      if (req.user.role === 'agent' && String(remit.agent._id) !== String(req.user.id)) {
        return res.status(403).json({ message: "Not allowed" });
      }

      // Only allow download for sent commissions
      if (remit.status !== 'sent') {
        return res.status(400).json({ message: "Receipt only available for sent commissions" });
      }

      const agent = remit.agent;

      // Fetch agent's orders for PDF
      let orders = [];
      let totalSubmitted = 0;
      let totalDelivered = 0;
      try {
        const agentOrders = await Order.find({ agent: agent._id })
          .populate('productId', 'price baseCurrency')
          .lean();
        
        orders = agentOrders
          .filter(o => String(o.shipmentStatus || '').toLowerCase() === 'delivered')
          .map(o => {
            const price = o.total || o.productId?.price || 0;
            const currency = o.items?.[0]?.productId?.baseCurrency || o.productId?.baseCurrency || 'AED';
            return {
              orderId: o.invoiceId || `INV-${o._id.toString().slice(-8)}`,
              date: o.updatedAt || o.createdAt,
              amount: price,
              currency: currency
            };
          });
        
        totalSubmitted = agentOrders.length;
        totalDelivered = orders.length;
      } catch (err) {
        console.error('Error fetching agent orders:', err);
      }

      // Currency conversion
      const pkrToAed = 0.0132;
      const amountAED = remit.amount * pkrToAed;

      // Generate PDF
      const pdfPath = await generateAgentCommissionReceiptPDF({
        agentName: `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'Agent',
        agentPhone: agent.phone || '',
        totalSubmitted,
        totalDelivered,
        amountAED,
        amountPKR: remit.amount,
        orders
      });

      const fullPath = path.join(process.cwd(), pdfPath);
      
      // Send PDF file
      res.download(fullPath, `Commission_Receipt_${new Date(remit.sentAt).toLocaleDateString()}.pdf`, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Clean up file after sending
        setTimeout(() => {
          try {
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          } catch {}
        }, 5000);
      });

    } catch (err) {
      console.error("Download commission receipt error:", err);
      return res.status(500).json({ message: "Failed to download receipt" });
    }
  }
);

// Send a manual payout receipt PDF to an agent (owner). Does not alter balances.
router.post(
  "/agents/:id/send-manual-receipt",
  auth,
  allowRoles("user", "admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, note } = req.body || {};
      const agent = await User.findById(id).select(
        "firstName lastName phone createdBy"
      );
      if (!agent || agent.role !== "agent")
        return res.status(404).json({ message: "Agent not found" });
      if (
        req.user.role !== "admin" &&
        String(agent.createdBy) !== String(req.user.id)
      ) {
        return res.status(403).json({ message: "Not allowed" });
      }
      const amt = Math.max(0, Number(amount || 0));
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      // Generate PDF
      const pdfPath = await generatePayoutReceiptPDF(agent, amt);
      // Send via WhatsApp
      try {
        const getWA = async () => {
          const enabled = process.env.ENABLE_WA !== "false";
          if (!enabled)
            return {
              sendDocument: async () => ({ ok: true }),
              sendText: async () => ({ ok: true }),
            };
          try {
            const mod = await import("../services/whatsapp.js");
            return mod?.default || mod;
          } catch {
            return {
              sendDocument: async () => ({ ok: true }),
              sendText: async () => ({ ok: true }),
            };
          }
        };
        const wa = await getWA();
        const digits = String(agent?.phone || "").replace(/\D/g, "");
        if (digits) {
          const jid = `${digits}@s.whatsapp.net`;
          if ((note || "").trim()) {
            try {
              await wa.sendText(
                jid,
                `Manual payout receipt\nAmount: PKR ${amt.toLocaleString()}\n${note}`
              );
            } catch {}
          }
          await wa.sendDocument(
            jid,
            pdfPath,
            "receipt.pdf",
            "Manual Payout Receipt"
          );
        }
      } catch (e) {
        try {
          console.warn("manual receipt send failed", e?.message || e);
        } catch {}
      }
      return res.json({ ok: true, message: "Manual receipt sent" });
    } catch (err) {
      return res.status(500).json({ message: "Failed to send manual receipt" });
    }
  }
);

// === MONTHLY REPORT ENDPOINTS ===

// Driver Monthly Report PDF
router.get(
  "/drivers/monthly-report",
  auth,
  allowRoles("driver"),
  async (req, res) => {
    try {
      const { month } = req.query; // Expected format: YYYY-MM
      
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "Invalid month format. Use YYYY-MM" });
      }

      const driver = await User.findById(req.user.id)
        .select("firstName lastName phone driverProfile")
        .lean();
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      // Parse month range
      const startDate = new Date(month + '-01T00:00:00.000Z');
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      // Get orders for this month
      const orders = await Order.find({
        deliveryBoy: req.user.id,
        createdAt: { $gte: startDate, $lt: endDate }
      })
      .populate('productId', 'name')
      .populate('items.productId', 'name')
      .lean();

      // Calculate statistics
      const ordersAssigned = orders.length;
      const ordersDelivered = orders.filter(o => o.shipmentStatus === 'delivered').length;
      const ordersCancelled = orders.filter(o => o.shipmentStatus === 'cancelled').length;
      const ordersReturned = orders.filter(o => o.shipmentStatus === 'returned').length;

      // Get remittances for cancelled and returned orders - CASH ACCOUNTABILITY
      const cancelledOrders = orders.filter(o => o.shipmentStatus === 'cancelled');
      const returnedOrders = orders.filter(o => o.shipmentStatus === 'returned');

      let cancelledSubmittedAmount = 0;
      let cancelledAcceptedAmount = 0;
      let cancelledSubmittedCount = 0;
      let cancelledAcceptedCount = 0;
      let returnedSubmittedAmount = 0;
      let returnedAcceptedAmount = 0;
      let returnedSubmittedCount = 0;
      let returnedAcceptedCount = 0;

      // Process cancelled and returned orders with details
      const cancelledOrderDetails = [];
      const returnedOrderDetails = [];

      for (const order of cancelledOrders) {
        // Get product name from items array or single productId
        let productName = 'N/A';
        if (order.items && order.items.length > 0 && order.items[0].productId?.name) {
          productName = order.items[0].productId.name;
          if (order.items.length > 1) {
            productName += ` +${order.items.length - 1} more`;
          }
        } else if (order.productId?.name) {
          productName = order.productId.name;
        }

        const orderDetail = {
          invoiceNumber: order.invoiceNumber || 'N/A',
          productName: productName,
          submitted: order.returnSubmittedToCompany || false,
          verified: order.returnVerified || false,
          amount: Number(order.collectedAmount || order.codAmount || 0)
        };
        cancelledOrderDetails.push(orderDetail);
        
        if (order.returnSubmittedToCompany) {
          cancelledSubmittedAmount += orderDetail.amount;
          cancelledSubmittedCount++;
          if (order.returnVerified) {
            cancelledAcceptedAmount += orderDetail.amount;
            cancelledAcceptedCount++;
          }
        }
      }

      for (const order of returnedOrders) {
        // Get product name from items array or single productId
        let productName = 'N/A';
        if (order.items && order.items.length > 0 && order.items[0].productId?.name) {
          productName = order.items[0].productId.name;
          if (order.items.length > 1) {
            productName += ` +${order.items.length - 1} more`;
          }
        } else if (order.productId?.name) {
          productName = order.productId.name;
        }

        const orderDetail = {
          invoiceNumber: order.invoiceNumber || 'N/A',
          productName: productName,
          submitted: order.returnSubmittedToCompany || false,
          verified: order.returnVerified || false,
          amount: Number(order.collectedAmount || order.codAmount || 0)
        };
        returnedOrderDetails.push(orderDetail);
        
        if (order.returnSubmittedToCompany) {
          returnedSubmittedAmount += orderDetail.amount;
          returnedSubmittedCount++;
          if (order.returnVerified) {
            returnedAcceptedAmount += orderDetail.amount;
            returnedAcceptedCount++;
          }
        }
      }

      // Calculate commission
      const commissionPerOrder = Number(driver.driverProfile?.commissionPerOrder || driver.commissionPerOrder || 0);
      const totalCommission = Number(driver.driverProfile?.totalCommission || 0);
      const currency = String(driver.driverProfile?.commissionCurrency || 'SAR').toUpperCase();

      // Get delivered order details
      const deliveredOrders = orders
        .filter(o => o.shipmentStatus === 'delivered')
        .map(o => ({
          invoiceNumber: o.invoiceNumber || 'N/A',
          customerName: o.customerName || 'N/A',
          deliveredAt: o.deliveredAt || o.updatedAt,
          commission: commissionPerOrder
        }));

      // Generate PDF
      const pdfData = {
        driverName: `${driver.firstName || ''} ${driver.lastName || ''}`.trim(),
        driverPhone: driver.phone,
        month: month,
        ordersAssigned,
        ordersDelivered,
        ordersCancelled,
        ordersReturned,
        cancelledSubmittedAmount,
        cancelledAcceptedAmount,
        cancelledSubmittedCount,
        cancelledAcceptedCount,
        cancelledOrderDetails,
        returnedSubmittedAmount,
        returnedAcceptedAmount,
        returnedSubmittedCount,
        returnedAcceptedCount,
        returnedOrderDetails,
        totalCommission,
        currency,
        deliveredOrders
      };

      const pdfPath = await generateDriverMonthlyReportPDF(pdfData);
      const fullPath = path.join(process.cwd(), pdfPath);

      if (!fs.existsSync(fullPath)) {
        return res.status(500).json({ message: "PDF generation failed" });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="driver-monthly-report-${month}.pdf"`);
      
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);

      // Clean up file after sending
      fileStream.on('end', () => {
        try {
          fs.unlinkSync(fullPath);
        } catch {}
      });

    } catch (err) {
      console.error("Driver monthly report error:", err);
      return res.status(500).json({ message: "Failed to generate monthly report" });
    }
  }
);

// Agent Monthly Report PDF
router.get(
  "/agents/monthly-report",
  auth,
  allowRoles("agent"),
  async (req, res) => {
    try {
      const { month } = req.query; // Expected format: YYYY-MM
      
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "Invalid month format. Use YYYY-MM" });
      }

      const agent = await User.findById(req.user.id)
        .select("firstName lastName email phone")
        .lean();
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Parse month range
      const startDate = new Date(month + '-01T00:00:00.000Z');
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      // Get orders for this month (agents create orders, so use createdBy)
      const orders = await Order.find({
        createdBy: req.user.id,
        createdByRole: 'agent',
        createdAt: { $gte: startDate, $lt: endDate }
      }).lean();

      // Calculate statistics
      const ordersSubmitted = orders.length;
      const ordersDelivered = orders.filter(o => o.shipmentStatus === 'delivered').length;
      const ordersCancelled = orders.filter(o => o.shipmentStatus === 'cancelled').length;
      const ordersReturned = orders.filter(o => o.shipmentStatus === 'returned').length;

      // Calculate commission (12% of delivered orders)
      const commissionPct = 0.12;
      let totalCommission = 0;

      // Get currency config
      const currencyCfg = await getCurrencyConfig();
      
      // Helper to convert to AED
      const toAED = (amount, code) => {
        const c = String(code || 'SAR').toUpperCase();
        const rate = currencyCfg.sarPerUnit[c];
        if (!rate) return amount;
        return (amount / rate) * currencyCfg.sarPerUnit.AED;
      };

      // Helper to convert AED to PKR
      const aedToPKR = (aed) => {
        return aed * (currencyCfg.pkrPerUnit.AED || 76);
      };

      for (const order of orders) {
        if (order.shipmentStatus === 'delivered') {
          const total = Number(order.total || 0);
          const currency = order.orderCurrency || 'SAR';
          const aed = toAED(total, currency);
          const pkr = aedToPKR(aed);
          totalCommission += pkr * commissionPct;
        }
      }

      // Get delivered order details with commission
      const deliveredOrders = orders
        .filter(o => o.shipmentStatus === 'delivered')
        .map(o => {
          const total = Number(o.total || 0);
          const currency = o.orderCurrency || 'SAR';
          const aed = toAED(total, currency);
          const pkr = aedToPKR(aed);
          const commission = pkr * commissionPct;
          
          return {
            invoiceNumber: o.invoiceNumber || 'N/A',
            customerName: o.customerName || 'N/A',
            deliveredAt: o.deliveredAt || o.updatedAt,
            commission
          };
        });

      // Generate PDF
      const pdfData = {
        agentName: `${agent.firstName || ''} ${agent.lastName || ''}`.trim(),
        agentEmail: agent.email,
        agentPhone: agent.phone,
        month: month,
        ordersSubmitted,
        ordersDelivered,
        ordersCancelled,
        ordersReturned,
        totalCommission: Math.round(totalCommission),
        currency: 'PKR',
        deliveredOrders
      };

      const pdfPath = await generateAgentMonthlyReportPDF(pdfData);
      const fullPath = path.join(process.cwd(), pdfPath);

      if (!fs.existsSync(fullPath)) {
        return res.status(500).json({ message: "PDF generation failed" });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="agent-monthly-report-${month}.pdf"`);
      
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);

      // Clean up file after sending
      fileStream.on('end', () => {
        try {
          fs.unlinkSync(fullPath);
        } catch {}
      });

    } catch (err) {
      console.error("Agent monthly report error:", err);
      return res.status(500).json({ message: "Failed to generate monthly report" });
    }
  }
);

export default router;

// --- Compatibility alias endpoints expected by frontend ---
// GET /api/finance/drivers/summary — owner/manager overview per driver
router.get(
  "/drivers/summary",
  auth,
  allowRoles("admin", "user", "manager"),
  async (req, res) => {
    try {
      // Scope drivers by workspace (owner) and, for managers, by assigned countries
      let driverCond = { role: "driver" };
      if (req.user.role === "user") driverCond.createdBy = req.user.id;
      if (req.user.role === "manager") {
        // Load manager record to get assigned countries
        const me = await User.findById(req.user.id)
          .select("createdBy assignedCountry assignedCountries")
          .lean();
        driverCond.createdBy = me?.createdBy || req.user.id;
        const assigned =
          Array.isArray(me?.assignedCountries) && me.assignedCountries.length
            ? me.assignedCountries
            : me?.assignedCountry
            ? [me.assignedCountry]
            : [];
        if (assigned.length) {
          const expand = (c) =>
            c === "KSA" || c === "Saudi Arabia"
              ? ["KSA", "Saudi Arabia"]
              : c === "UAE" || c === "United Arab Emirates"
              ? ["UAE", "United Arab Emirates"]
              : [c];
          const set = new Set();
          for (const c of assigned) {
            for (const x of expand(c)) set.add(x);
          }
          driverCond.country = { $in: Array.from(set) };
        }
      }
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const skip = (page - 1) * limit;
      const total = await User.countDocuments(driverCond);
      const drivers = await User.find(
        driverCond,
        "firstName lastName phone _id country driverProfile"
      )
        .skip(skip)
        .limit(limit)
        .lean();


      // Date filtering support - two formats:
      // 1. from/to ISO dates (dashboard month filter)
      // 2. month/year numbers (legacy)
      let dateFilter = {};
      if (req.query.from || req.query.to) {
        dateFilter.createdAt = {};
        if (req.query.from) dateFilter.createdAt.$gte = new Date(req.query.from);
        if (req.query.to) dateFilter.createdAt.$lte = new Date(req.query.to);
      } else if (req.query.month && req.query.year) {
        const monthNum = parseInt(req.query.month);
        const yearNum = parseInt(req.query.year);
        if (monthNum >= 1 && monthNum <= 12 && yearNum > 2000) {
          const startDate = new Date(yearNum, monthNum - 1, 1);
          const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
          dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
        }
      }
      // Aggregate basic stats from orders and remittances per driver in their local currency
      const out = [];
      const M = (await import("mongoose")).default;
      for (const d of drivers) {
        const currency = currencyFromCountry(d?.country || "") || "SAR";
        const matchBase = { deliveryBoy: d._id, ...dateFilter };
        const assigned = await Order.countDocuments(matchBase);
        const canceled = await Order.countDocuments({
          ...matchBase,
          shipmentStatus: "cancelled",
        });
        const deliveredCount = await Order.countDocuments({
          ...matchBase,
          shipmentStatus: "delivered",
        });
        // Delivered total value (not collectedAmount)
        const deliveredOrders3 = await Order.find({
          ...matchBase,
          shipmentStatus: "delivered",
        })
          .select("collectedAmount total productId quantity items")
          .populate("productId", "price")
          .populate("items.productId", "price");
        const collected = deliveredOrders3.reduce((sum, o) => {
          let val = 0;
          if (o?.collectedAmount != null && Number(o.collectedAmount) > 0) {
            val = Number(o.collectedAmount) || 0;
          } else if (o?.total != null) {
            val = Number(o.total) || 0;
          } else if (Array.isArray(o?.items) && o.items.length) {
            val = o.items.reduce(
              (s, it) =>
                s +
                Number(it?.productId?.price || 0) *
                  Math.max(1, Number(it?.quantity || 1)),
              0
            );
          } else {
            const unit = Number(o?.productId?.price || 0);
            const qty = Math.max(1, Number(o?.quantity || 1));
            val = unit * qty;
          }
          return sum + val;
        }, 0);
        // Delivered to company comes from accepted remittances
        const remitRows = await Remittance.aggregate([
          {
            $match: { driver: new M.Types.ObjectId(d._id), status: "accepted" },
          },
          {
            $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } },
          },
        ]);
        const deliveredToCompany =
          remitRows && remitRows[0] ? Number(remitRows[0].total || 0) : 0;
        const pendingToCompany = Math.max(0, collected - deliveredToCompany);

        // Driver commission calculation
        const commissionPerOrder = Number(
          d.driverProfile?.commissionPerOrder ?? 0
        );
        
        // Get actual commissions from all delivered orders
        const deliveredOrdersWithCommission = await Order.find({ deliveryBoy: d._id, shipmentStatus: 'delivered', ...dateFilter }).select('driverCommission').lean();
        
        // Calculate total actual commission from orders
        // If order has driverCommission set, use it; otherwise use default rate
        const actualTotalCommission = deliveredOrdersWithCommission.reduce((sum, o) => {
          const orderComm = Number(o.driverCommission) || 0
          // Use order's commission if set, otherwise use driver's default rate
          return sum + (orderComm > 0 ? orderComm : commissionPerOrder)
        }, 0);
        
        // Base commission (default rate × delivered count)
        const baseCommission = deliveredCount * commissionPerOrder;
        
        // Extra commission (difference between actual and base)
        const extraCommission = Math.max(0, actualTotalCommission - baseCommission);
        
        // Total commission is the actual commission from orders
        const driverCommission = Math.round(actualTotalCommission);

        // Use paidCommission from driver profile (updated when remittances are accepted)
        const withdrawnCommission = Math.round(
          Number(d.driverProfile?.paidCommission ?? 0)
        );

        // Pending commission: earned commission minus withdrawn
        const pendingCommission = Math.max(
          0,
          driverCommission - withdrawnCommission
        );

        out.push({
          id: String(d._id),
          name: `${d.firstName || ""} ${d.lastName || ""}`.trim(),
          phone: d.phone || "",
          country: d.country || "",
          currency,
          commissionRate: Number(d.driverProfile?.commissionRate ?? 8),
          commissionPerOrder: Number(d.driverProfile?.commissionPerOrder ?? 0),
          commissionCurrency: d.driverProfile?.commissionCurrency || currency,
          assigned,
          canceled,
          deliveredCount,
          collected: Math.round(collected),
          deliveredToCompany: Math.round(deliveredToCompany),
          pendingToCompany: Math.round(pendingToCompany),
          baseCommission: Math.round(baseCommission),
          extraCommission: Math.round(extraCommission),
          driverCommission: Math.round(driverCommission),
          withdrawnCommission: Math.round(withdrawnCommission),
          pendingCommission: Math.round(pendingCommission),
        });
      }
      const hasMore = skip + drivers.length < total;
      return res.json({ drivers: out, page, limit, total, hasMore });
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Failed to compute drivers summary" });
    }
  }
);

// Pay commission to driver (admin/user/manager)
router.post(
  "/drivers/:id/pay-commission",
  auth,
  allowRoles("admin", "user", "manager"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body || {};
      const amt = Number(amount);
      if (Number.isNaN(amt) || amt <= 0)
        return res.status(400).json({ message: "Invalid amount" });

      const driver = await User.findOne({ _id: id, role: "driver" });
      if (!driver) return res.status(404).json({ message: "Driver not found" });
      if (
        req.user.role !== "admin" &&
        String(driver.createdBy) !== String(req.user.id)
      ) {
        return res.status(403).json({ message: "Not allowed" });
      }

      // Manager payments go to pending, owner payments are accepted directly
      const isManager = req.user.role === "manager";
      const status = isManager ? "pending" : "accepted";
      
      // Create a remittance record marking commission payment to driver
      const remit = new Remittance({
        driver: id,
        owner: req.user.role === "user" ? req.user.id : driver.createdBy,
        manager: isManager ? req.user.id : driver.createdBy,
        amount: amt,
        driverCommission: amt,
        method: "transfer",
        note: "Commission payment",
        status: status,
        paidToId: id,
        paidAt: status === "accepted" ? new Date() : null,
      });
      await remit.save();

      // Update driver's paidCommission only if accepted (owner payment)
      if (status === "accepted") {
        if (!driver.driverProfile) driver.driverProfile = {};
        const currentPaid = Number(driver.driverProfile.paidCommission || 0);
        driver.driverProfile.paidCommission = currentPaid + amt;
        driver.markModified('driverProfile');
        await driver.save();
        
        // Notify driver
        try {
          const io = getIO();
          io.to(`user:${id}`).emit("commission.paid", { amount: amt });
          // Also emit to owner workspace
          const ownerId = String(driver.createdBy || req.user.id);
          io.to(`workspace:${ownerId}`).emit("driver.commission.paid", { 
            driverId: String(id),
            amount: amt,
            totalPaid: driver.driverProfile.paidCommission
          });
        } catch {}
      } else {
        // Notify owner about pending manager payment
        try {
          const io = getIO();
          const ownerId = String(driver.createdBy);
          io.to(`workspace:${ownerId}`).emit("driver.commission.pending", { 
            driverId: String(id),
            managerId: String(req.user.id),
            amount: amt
          });
        } catch {}
      }

      return res.json({ 
        ok: true, 
        message: isManager ? "Commission payment sent for approval" : "Commission paid successfully" 
      });
    } catch (err) {
      console.error("Pay commission error:", err);
      return res.status(500).json({ message: "Failed to pay commission" });
    }
  }
);

// Get commission payment history for a driver
router.get(
  "/drivers/:id/commission-history",
  auth,
  allowRoles("admin", "user", "manager"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const driver = await User.findOne({ _id: id, role: "driver" });
      if (!driver) return res.status(404).json({ message: "Driver not found" });
      
      // Check authorization
      if (
        req.user.role !== "admin" &&
        String(driver.createdBy) !== String(req.user.id)
      ) {
        return res.status(403).json({ message: "Not allowed" });
      }

      // Get all commission payment remittances for this driver
      const remittances = await Remittance.find({
        driver: id,
        note: "Commission payment"
      })
      .sort({ createdAt: -1 })
      .populate("manager", "firstName lastName email")
      .lean();

      // Get driver's country for currency
      const country = driver.driverProfile?.country || "Saudi Arabia";
      const currency = country.toLowerCase().includes("uae") ? "AED" : 
                      country.toLowerCase().includes("oman") ? "OMR" :
                      country.toLowerCase().includes("bahrain") ? "BHD" : "SAR";

      const history = remittances.map(r => ({
        _id: r._id,
        amount: r.amount || r.driverCommission || 0,
        currency: r.currency || currency,
        status: r.status,
        date: r.paidAt || r.acceptedAt || r.createdAt,
        createdAt: r.createdAt,
        manager: r.manager,
        method: r.method,
        note: r.note
      }));

      return res.json({ history });
    } catch (err) {
      console.error("Commission history error:", err);
      return res.status(500).json({ message: "Failed to load commission history" });
    }
  }
);

// Generate commission PDF for current driver
router.get(
  "/drivers/me/commission-pdf",
  auth,
  allowRoles("driver"),
  async (req, res) => {
    try {
      const driverId = req.user.id;
      const driver = await User.findById(driverId);
      if (!driver || driver.role !== 'driver') {
        return res.status(404).json({ message: 'Driver not found' });
      }

      // Get delivered orders
      const deliveredOrders = await Order.find({
        deliveryBoy: driverId,
        shipmentStatus: 'delivered'
      })
        .select('invoiceNumber deliveredAt driverCommission')
        .sort({ deliveredAt: -1 })
        .lean();

      // Calculate commission data
      const defaultRate = Number(driver.driverProfile?.commissionPerOrder || 0);
      const totalCommission = Number(driver.driverProfile?.totalCommission || 0);
      const paidCommission = Number(driver.driverProfile?.paidCommission || 0);
      const pendingCommission = Math.max(0, totalCommission - paidCommission);
      const currency = driver.driverProfile?.commissionCurrency || 'SAR';

      // Prepare PDF data
      const pdfData = {
        driverName: `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Driver',
        driverPhone: driver.phone || '',
        totalDeliveredOrders: deliveredOrders.length,
        totalCommissionPaid: paidCommission > 0 ? paidCommission : totalCommission,
        currency: currency,
        orders: deliveredOrders.map(order => ({
          orderId: order.invoiceNumber || String(order._id).slice(-6),
          deliveryDate: order.deliveredAt,
          commission: Number(order.driverCommission) > 0 ? Number(order.driverCommission) : defaultRate
        }))
      };

      // Generate PDF
      const { generateCommissionPayoutPDF } = await import('../../utils/generateCommissionPayoutPDF.js');
      const pdfPath = await generateCommissionPayoutPDF(pdfData);
      
      // Send PDF file
      const fs = await import('fs');
      const path = await import('path');
      const fullPath = path.join(process.cwd(), pdfPath);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="commission-statement.pdf"`);
      
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);
      
      // Clean up file after sending
      fileStream.on('end', () => {
        try {
          fs.unlinkSync(fullPath);
        } catch (err) {
          console.error('Failed to delete temp PDF:', err);
        }
      });

    } catch (err) {
      console.error('Generate driver PDF error:', err);
      return res.status(500).json({ message: 'Failed to generate commission PDF' });
    }
  }
);

// GET /api/finance/driver-remittances — alias to remittances list within scope
router.get(
  "/driver-remittances",
  auth,
  allowRoles("admin", "user", "manager", "driver"),
  async (req, res) => {
    try {
      let match = {};
      if (req.user.role === "user") match.owner = req.user.id;
      if (req.user.role === "manager") match.manager = req.user.id;
      if (req.user.role === "driver") match.driver = req.user.id;
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const skip = (page - 1) * limit;
      const total = await Remittance.countDocuments(match);
      const items = await Remittance.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("driver", "firstName lastName phone country payoutProfile")
        .populate("manager", "firstName lastName email");
      const hasMore = skip + items.length < total;
      return res.json({ remittances: items, page, limit, total, hasMore });
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Failed to load driver remittances" });
    }
  }
);

// POST /api/finance/driver-remittances/:id/send — mark as accepted and (optionally) adjust amount
router.post(
  "/driver-remittances/:id/send",
  auth,
  allowRoles("admin", "user", "manager"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const r = await Remittance.findById(id);
      if (!r) return res.status(404).json({ message: "Remittance not found" });
      // Owner or manager in scope
      if (req.user.role === "user" && String(r.owner) !== String(req.user.id))
        return res.status(403).json({ message: "Not allowed" });
      if (
        req.user.role === "manager" &&
        String(r.manager) !== String(req.user.id)
      )
        return res.status(403).json({ message: "Not allowed" });
      const bodyAmt = Number(req.body?.amount ?? r.amount);
      const amt = Math.max(0, bodyAmt);
      r.amount = amt;
      r.status = "accepted";
      r.acceptedAt = new Date();
      r.acceptedBy = req.user.id;
      await r.save();
      return res.json({ ok: true, remit: r });
    } catch (err) {
      return res.status(500).json({ message: "Failed to send to driver" });
    }
  }
);

// Company payout profile (visible to drivers). Global setting for now.
router.get(
  "/company/payout-profile",
  auth,
  allowRoles("admin", "user", "manager", "driver"),
  async (req, res) => {
    try {
      const doc = await Setting.findOne({ key: "companyPayout" }).lean();
      const value = (doc && doc.value) || null;
      return res.json({ profile: value });
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Failed to load company profile" });
    }
  }
);

router.post(
  "/company/payout-profile",
  auth,
  allowRoles("admin", "user"),
  async (req, res) => {
    try {
      const {
        method = "bank",
        accountName = "",
        bankName = "",
        iban = "",
        accountNumber = "",
        phoneNumber = "",
      } = req.body || {};
      let doc = await Setting.findOne({ key: "companyPayout" });
      if (!doc) doc = new Setting({ key: "companyPayout", value: {} });
      doc.value = {
        method,
        accountName,
        bankName,
        iban,
        accountNumber,
        phoneNumber,
      };
      await doc.save();
      return res.json({ ok: true });
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Failed to save company profile" });
    }
  }
);

// ====== MANAGER → COMPANY REMITTANCES ======

// Create manager→company remittance
router.post(
  "/manager-remittances",
  auth,
  allowRoles("manager"),
  upload.any(),
  async (req, res) => {
    try {
      const {
        amount,
        note = "",
        method = "hand",
        country: reqCountry,
      } = req.body || {};
      if (amount == null)
        return res.status(400).json({ message: "amount is required" });
      const amt = Number(amount);
      if (Number.isNaN(amt) || amt <= 0)
        return res.status(400).json({ message: "Invalid amount" });

      const me = await User.findById(req.user.id)
        .select("country assignedCountry assignedCountries createdBy")
        .lean();
      if (!me) return res.status(404).json({ message: "Manager not found" });
      const ownerId = String(me.createdBy || "");
      if (!ownerId)
        return res.status(400).json({ message: "Manager has no owner" });

      // Use country from request if provided, otherwise use manager's assigned country
      let country = reqCountry ? String(reqCountry).trim() : "";
      if (!country) {
        // Try assignedCountries array first, then assignedCountry, then country
        if (Array.isArray(me.assignedCountries) && me.assignedCountries.length > 0) {
          country = String(me.assignedCountries[0]).trim();
        } else if (me.assignedCountry) {
          country = String(me.assignedCountry).trim();
        } else if (me.country) {
          country = String(me.country).trim();
        }
      }
      const currency = currencyFromCountry(country);

      let receiptPath = "";
      if (method === "transfer" && req.files && req.files.length > 0) {
        const file = req.files[0];
        receiptPath = `/uploads/${file.filename}`;
      }

      const doc = new ManagerRemittance({
        manager: req.user.id,
        owner: ownerId,
        country,
        currency,
        amount: amt,
        method,
        receiptPath,
        note,
        status: "pending",
      });
      await doc.save();

      try {
        const io = getIO();
        io.to(`user:${ownerId}`).emit("manager-remittance.created", {
          id: String(doc._id),
        });
      } catch {}
      return res
        .status(201)
        .json({ message: "Manager remittance created", remittance: doc });
    } catch (err) {
      console.error("Create manager remittance error:", err);
      return res
        .status(500)
        .json({ message: "Failed to create manager remittance" });
    }
  }
);

// List manager→company remittances
router.get(
  "/manager-remittances",
  auth,
  allowRoles("admin", "user", "manager"),
  async (req, res) => {
    try {
      let match = {};
      if (req.user.role === "admin") {
        // no extra scoping
      } else if (req.user.role === "user") {
        match.owner = req.user.id;
      } else if (req.user.role === "manager") {
        match.manager = req.user.id;
      }
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
      const skip = (page - 1) * limit;
      const total = await ManagerRemittance.countDocuments(match);
      const items = await ManagerRemittance.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("manager", "firstName lastName email country")
        .populate("owner", "firstName lastName email");
      const hasMore = skip + items.length < total;
      return res.json({ remittances: items, page, limit, total, hasMore });
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Failed to list manager remittances" });
    }
  }
);

// Accept manager→company remittance (owner)
router.post(
  "/manager-remittances/:id/accept",
  auth,
  allowRoles("user"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const r = await ManagerRemittance.findById(id);
      if (!r)
        return res
          .status(404)
          .json({ message: "Manager remittance not found" });
      if (String(r.owner) !== String(req.user.id))
        return res.status(403).json({ message: "Not allowed" });
      if (r.status !== "pending")
        return res.status(400).json({ message: "Already processed" });

      r.status = "accepted";
      r.acceptedAt = new Date();
      r.acceptedBy = req.user.id;
      await r.save();

      try {
        const io = getIO();
        io.to(`user:${String(r.manager)}`).emit("manager-remittance.accepted", {
          id: String(r._id),
        });
      } catch {}
      return res.json({
        message: "Manager remittance accepted",
        remittance: r,
      });
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Failed to accept manager remittance" });
    }
  }
);

// Reject manager→company remittance (owner)
router.post(
  "/manager-remittances/:id/reject",
  auth,
  allowRoles("user"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const r = await ManagerRemittance.findById(id);
      if (!r)
        return res
          .status(404)
          .json({ message: "Manager remittance not found" });
      if (String(r.owner) !== String(req.user.id))
        return res.status(403).json({ message: "Not allowed" });
      if (r.status !== "pending")
        return res.status(400).json({ message: "Already processed" });

      r.status = "rejected";
      r.acceptedAt = new Date();
      r.acceptedBy = req.user.id;
      await r.save();

      try {
        const io = getIO();
        io.to(`user:${String(r.manager)}`).emit("manager-remittance.rejected", {
          id: String(r._id),
        });
      } catch {}
      return res.json({
        message: "Manager remittance rejected",
        remittance: r,
      });
    } catch (err) {
      return res
        .status(500)
        .json({ message: "Failed to reject manager remittance" });
    }
  }
);

// Manager remittance summary
router.get(
  "/manager-remittances/summary",
  auth,
  allowRoles("manager"),
  async (req, res) => {
    try {
      const { country } = req.query;
      const match = { manager: req.user.id };
      if (country) match.country = country;
      const all = await ManagerRemittance.find(match).lean();
      let totalSent = 0,
        totalAccepted = 0,
        totalPending = 0;
      for (const r of all) {
        if (r.status === "accepted") totalAccepted += Number(r.amount || 0);
        else if (r.status === "pending") totalPending += Number(r.amount || 0);
        totalSent += Number(r.amount || 0);
      }
      // Use the country from query param for currency, fallback to manager's country
      const currencyCountry = country || "";
      const me = await User.findById(req.user.id).select("country").lean();
      const currency = currencyFromCountry(
        currencyCountry || String(me?.country || "")
      );
      return res.json({ totalSent, totalAccepted, totalPending, currency });
    } catch (err) {
      console.error("Manager remittance summary error:", err);
      return res
        .status(500)
        .json({
          message: "Failed to get manager remittance summary",
          error: err.message,
        });
    }
  }
);

// ====== INVESTOR REMITTANCES ======

// Create investor remittance (investor requests payment)
router.post("/investor-remittances", auth, allowRoles("investor"), async (req, res) => {
  try {
    const { amount, note = "", productId = "", country = "" } = req.body || {};
    if (amount == null) return res.status(400).json({ message: "amount is required" });
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) return res.status(400).json({ message: "Invalid amount" });

    const me = await User.findById(req.user.id).select("createdBy investorProfile").lean();
    if (!me) return res.status(404).json({ message: "Investor not found" });
    const ownerId = String(me.createdBy || "");
    if (!ownerId) return res.status(400).json({ message: "Investor has no owner" });

    const currency = me.investorProfile?.currency || "SAR";

    const doc = new InvestorRemittance({
      investor: req.user.id,
      owner: ownerId,
      amount: amt,
      currency,
      product: productId || null,
      country: country || "",
      note,
      status: "pending",
    });
    await doc.save();

    try {
      const io = getIO();
      io.to(`user:${ownerId}`).emit("investor-remittance.created", { id: String(doc._id) });
    } catch {}
    return res.status(201).json({ message: "Payment request created", remittance: doc });
  } catch (err) {
    console.error("Create investor remittance error:", err);
    return res.status(500).json({ message: "Failed to create payment request" });
  }
});

// List investor remittances (for user/owner)
router.get("/investor-remittances", auth, allowRoles("admin", "user", "investor"), async (req, res) => {
  try {
    let match = {};
    if (req.user.role === "investor") {
      match.investor = req.user.id;
    } else {
      match.owner = req.user.id;
    }
    const remittances = await InvestorRemittance.find(match)
      .populate("investor", "firstName lastName email investorProfile")
      .populate("product", "name image price")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ remittances });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load investor remittances" });
  }
});

// Approve investor remittance
router.post("/investor-remittances/:id/approve", auth, allowRoles("user"), async (req, res) => {
  try {
    const r = await InvestorRemittance.findById(req.params.id);
    if (!r) return res.status(404).json({ message: "Remittance not found" });
    if (String(r.owner) !== String(req.user.id)) return res.status(403).json({ message: "Forbidden" });
    if (r.status !== "pending") return res.status(400).json({ message: "Already processed" });

    r.status = "approved";
    r.approvedAt = new Date();
    r.approvedBy = req.user.id;
    await r.save();

    try {
      const io = getIO();
      io.to(`user:${String(r.investor)}`).emit("investor-remittance.approved", { id: String(r._id) });
    } catch {}
    return res.json({ message: "Remittance approved", remittance: r });
  } catch (err) {
    return res.status(500).json({ message: "Failed to approve remittance" });
  }
});

// Mark as sent
router.post("/investor-remittances/:id/send", auth, allowRoles("user"), async (req, res) => {
  try {
    const r = await InvestorRemittance.findById(req.params.id);
    if (!r) return res.status(404).json({ message: "Remittance not found" });
    if (String(r.owner) !== String(req.user.id)) return res.status(403).json({ message: "Forbidden" });
    if (r.status !== "approved") return res.status(400).json({ message: "Must be approved first" });

    r.status = "sent";
    r.sentAt = new Date();
    r.sentBy = req.user.id;
    await r.save();

    try {
      const io = getIO();
      io.to(`user:${String(r.investor)}`).emit("investor-remittance.sent", { id: String(r._id) });
    } catch {}
    return res.json({ message: "Remittance marked as sent", remittance: r });
  } catch (err) {
    return res.status(500).json({ message: "Failed to send remittance" });
  }
});

// Investor dashboard stats
router.get("/investor/dashboard", auth, allowRoles("investor"), async (req, res) => {
  try {
    const me = await User.findById(req.user.id)
      .select("investorProfile createdBy")
      .populate("investorProfile.assignedProducts.product", "name image description price")
      .lean();
    
    if (!me) return res.status(404).json({ message: "Investor not found" });

    const assignedProducts = me.investorProfile?.assignedProducts || [];
    const totalInvestment = me.investorProfile?.investmentAmount || 0;
    const currency = me.investorProfile?.currency || "SAR";

    // Get sales data for each product
    const productStats = [];
    for (const ap of assignedProducts) {
      if (!ap.product) continue;
      
      const productId = ap.product._id;
      const country = ap.country || "";
      const profitPerUnit = ap.profitPerUnit || 0;

      // Get orders for this product in this country
      const match = {
        productId: productId,
        shipmentStatus: { $in: ["delivered", "in_transit", "picked_up", "pending"] }
      };
      if (country) match.orderCountry = country;

      const orders = await Order.find(match).select("quantity shipmentStatus total").lean();
      
      let totalUnits = 0;
      let deliveredUnits = 0;
      let totalRevenue = 0;
      let totalProfit = 0;

      for (const order of orders) {
        const qty = Number(order.quantity || 1);
        totalUnits += qty;
        if (order.shipmentStatus === "delivered") {
          deliveredUnits += qty;
          totalProfit += qty * profitPerUnit;
        }
        totalRevenue += Number(order.total || 0);
      }

      // Get product stock
      const product = await Product.findById(productId).select("stock stockByCountry name image description price").lean();
      
      if (!product) continue; // Skip if product not found
      
      // Get country-specific stock
      let stock = 0;
      if (country && product.stockByCountry && Object.keys(product.stockByCountry).length > 0) {
        // Use country-specific stock if available
        stock = product.stockByCountry[country] || 0;
      } else {
        // Fallback to total stock if stockByCountry not populated
        stock = product.stock || 0;
      }
      
      console.log(`Investor Dashboard - Product: ${product.name}, Country: ${country}, Stock: ${stock}, Total Stock: ${product.stock}, stockByCountry:`, product.stockByCountry);
      
      productStats.push({
        product: {
          _id: product._id,
          name: product.name,
          image: product.image,
          description: product.description,
          price: product.price
        },
        country: country || "All",
        stock: stock,
        profitPerUnit,
        totalUnits,
        deliveredUnits,
        totalRevenue,
        totalProfit
      });
    }

    // Calculate summary
    const totalProfit = productStats.reduce((sum, p) => sum + p.totalProfit, 0);
    const totalDeliveredUnits = productStats.reduce((sum, p) => sum + p.deliveredUnits, 0);
    const totalUnits = productStats.reduce((sum, p) => sum + p.totalUnits, 0);

    return res.json({
      totalInvestment,
      currency,
      totalProfit,
      totalDeliveredUnits,
      totalUnits,
      products: productStats
    });
  } catch (err) {
    console.error("Investor dashboard error:", err);
    return res.status(500).json({ message: "Failed to load dashboard data" });
  }
});
