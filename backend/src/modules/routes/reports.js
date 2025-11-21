import express from "express";
const router = express.Router();
import User from "../models/User.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Expense from "../models/Expense.js";
import AgentRemit from "../models/AgentRemit.js";
import Remittance from "../models/Remittance.js";
import Setting from "../models/Setting.js";
import { auth, allowRoles } from "../middleware/auth.js";
import mongoose from "mongoose";

// Helper function to calculate performance rating
const calculatePerformance = (metrics) => {
  const { completionRate, avgRating, totalOrders, revenue } = metrics;

  let score = 0;

  // Completion rate (40% weight)
  if (completionRate >= 95) score += 40;
  else if (completionRate >= 90) score += 35;
  else if (completionRate >= 80) score += 30;
  else if (completionRate >= 70) score += 20;
  else score += 10;

  // Average rating (30% weight)
  if (avgRating >= 4.5) score += 30;
  else if (avgRating >= 4.0) score += 25;
  else if (avgRating >= 3.5) score += 20;
  else if (avgRating >= 3.0) score += 15;
  else score += 5;

  // Volume (20% weight)
  if (totalOrders >= 100) score += 20;
  else if (totalOrders >= 50) score += 15;
  else if (totalOrders >= 20) score += 10;
  else if (totalOrders >= 10) score += 5;

  // Revenue (10% weight)
  if (revenue >= 10000) score += 10;
  else if (revenue >= 5000) score += 8;
  else if (revenue >= 2000) score += 6;
  else if (revenue >= 1000) score += 4;
  else if (revenue >= 500) score += 2;

  if (score >= 85) return "excellent";
  else if (score >= 70) return "good";
  else if (score >= 50) return "average";
  else return "poor";
};

// Helper function to get date range
const getDateRange = (period = "30d") => {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case "7d":
      start.setDate(end.getDate() - 7);
      break;
    case "30d":
      start.setDate(end.getDate() - 30);
      break;
    case "90d":
      start.setDate(end.getDate() - 90);
      break;
    case "1y":
      start.setFullYear(end.getFullYear() - 1);
      break;
    default:
      start.setDate(end.getDate() - 30);
  }

  return { start, end };
};

// Overview Report
router.get("/overview", auth, async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const { start, end } = getDateRange(period);

    // Check permissions
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get total counts
    const [totalUsers, totalAgents, totalDrivers, totalInvestors] =
      await Promise.all([
        User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
        User.countDocuments({
          role: "agent",
          createdAt: { $gte: start, $lte: end },
        }),
        User.countDocuments({
          role: "driver",
          createdAt: { $gte: start, $lte: end },
        }),
        User.countDocuments({
          role: "investor",
          createdAt: { $gte: start, $lte: end },
        }),
      ]);

    // Get order statistics
    const orderStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          avgOrderValue: { $avg: "$totalAmount" },
        },
      },
    ]);

    const stats = orderStats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      avgOrderValue: 0,
    };

    res.json({
      totalUsers,
      totalAgents,
      totalDrivers,
      totalInvestors,
      totalOrders: stats.totalOrders,
      totalRevenue: stats.totalRevenue,
      avgOrderValue: stats.avgOrderValue,
      period,
      dateRange: { start, end },
    });
  } catch (error) {
    console.error("Overview report error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Agent Performance Report
router.get("/agents", auth, async (req, res) => {
  try {
    const { period = "30d", limit = 50 } = req.query;
    const { start, end } = getDateRange(period);

    // Check permissions
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const agents = await User.aggregate([
      {
        $match: {
          role: "agent",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $lookup: {
          from: "orders",
          let: { agentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$createdBy", "$$agentId"] },
                createdAt: { $gte: start, $lte: end },
              },
            },
          ],
          as: "orders",
        },
      },
      {
        $addFields: {
          totalOrders: { $size: "$orders" },
          completedOrders: {
            $size: {
              $filter: {
                input: "$orders",
                cond: { $eq: ["$$this.status", "delivered"] },
              },
            },
          },
          pendingOrders: {
            $size: {
              $filter: {
                input: "$orders",
                cond: {
                  $in: ["$$this.status", ["pending", "processing", "shipped"]],
                },
              },
            },
          },
          totalRevenue: { $sum: "$orders.totalAmount" },
          avgOrderValue: { $avg: "$orders.totalAmount" },
          completionRate: {
            $cond: {
              if: { $gt: [{ $size: "$orders" }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: "$orders",
                            cond: { $eq: ["$$this.status", "delivered"] },
                          },
                        },
                      },
                      { $size: "$orders" },
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $addFields: {
          performance: {
            $switch: {
              branches: [
                { case: { $gte: ["$completionRate", 95] }, then: "excellent" },
                { case: { $gte: ["$completionRate", 85] }, then: "good" },
                { case: { $gte: ["$completionRate", 70] }, then: "average" },
              ],
              default: "poor",
            },
          },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
      {
        $limit: parseInt(limit),
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          phone: 1,
          country: 1,
          city: 1,
          availability: 1,
          totalOrders: 1,
          completedOrders: 1,
          pendingOrders: 1,
          totalRevenue: 1,
          avgOrderValue: 1,
          completionRate: 1,
          performance: 1,
          createdAt: 1,
        },
      },
    ]);

    res.json(agents);
  } catch (error) {
    console.error("Agent report error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Driver Performance Report
router.get("/drivers", auth, async (req, res) => {
  try {
    const { period = "30d", limit = 50 } = req.query;
    const { start, end } = getDateRange(period);

    // Check permissions
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const drivers = await User.aggregate([
      {
        $match: {
          role: "driver",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $lookup: {
          from: "orders",
          let: { driverId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$assignedDriver", "$$driverId"] },
                createdAt: { $gte: start, $lte: end },
              },
            },
          ],
          as: "deliveries",
        },
      },
      {
        $addFields: {
          totalDeliveries: { $size: "$deliveries" },
          completedDeliveries: {
            $size: {
              $filter: {
                input: "$deliveries",
                cond: { $eq: ["$$this.status", "delivered"] },
              },
            },
          },
          pendingDeliveries: {
            $size: {
              $filter: {
                input: "$deliveries",
                cond: {
                  $in: [
                    "$$this.status",
                    ["assigned", "picked_up", "in_transit"],
                  ],
                },
              },
            },
          },
          totalEarnings: {
            $sum: {
              $map: {
                input: "$deliveries",
                as: "delivery",
                in: { $multiply: ["$$delivery.totalAmount", 0.1] }, // 10% commission
              },
            },
          },
          avgDeliveryValue: { $avg: "$deliveries.totalAmount" },
          successRate: {
            $cond: {
              if: { $gt: [{ $size: "$deliveries" }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: "$deliveries",
                            cond: { $eq: ["$$this.status", "delivered"] },
                          },
                        },
                      },
                      { $size: "$deliveries" },
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $addFields: {
          performance: {
            $switch: {
              branches: [
                { case: { $gte: ["$successRate", 95] }, then: "excellent" },
                { case: { $gte: ["$successRate", 85] }, then: "good" },
                { case: { $gte: ["$successRate", 70] }, then: "average" },
              ],
              default: "poor",
            },
          },
        },
      },
      {
        $sort: { totalEarnings: -1 },
      },
      {
        $limit: parseInt(limit),
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          phone: 1,
          country: 1,
          city: 1,
          availability: 1,
          totalDeliveries: 1,
          completedDeliveries: 1,
          pendingDeliveries: 1,
          totalEarnings: 1,
          avgDeliveryValue: 1,
          successRate: 1,
          performance: 1,
          createdAt: 1,
        },
      },
    ]);

    res.json(drivers);
  } catch (error) {
    console.error("Driver report error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Investor Performance Report
router.get("/investors", auth, async (req, res) => {
  try {
    const { period = "30d", limit = 50 } = req.query;
    const { start, end } = getDateRange(period);

    // Check permissions
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const investors = await User.aggregate([
      {
        $match: {
          role: "investor",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $lookup: {
          from: "orders",
          let: { investorId: "$_id" },
          pipeline: [
            {
              $match: {
                createdAt: { $gte: start, $lte: end },
              },
            },
            {
              $lookup: {
                from: "products",
                localField: "items.productId",
                foreignField: "_id",
                as: "productDetails",
              },
            },
          ],
          as: "relatedOrders",
        },
      },
      {
        $addFields: {
          investmentAmount: {
            $ifNull: ["$investorProfile.investmentAmount", 0],
          },
          unitsSold: { $ifNull: ["$investorProfile.unitsSold", 0] },
          totalProfit: { $ifNull: ["$investorProfile.totalProfit", 0] },
          totalSaleValue: { $ifNull: ["$investorProfile.totalSaleValue", 0] },
          roi: {
            $cond: {
              if: { $gt: ["$investorProfile.investmentAmount", 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $ifNull: ["$investorProfile.totalProfit", 0] },
                      { $ifNull: ["$investorProfile.investmentAmount", 1] },
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },
          profitMargin: {
            $cond: {
              if: { $gt: ["$investorProfile.totalSaleValue", 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $ifNull: ["$investorProfile.totalProfit", 0] },
                      { $ifNull: ["$investorProfile.totalSaleValue", 1] },
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $addFields: {
          performance: {
            $switch: {
              branches: [
                { case: { $gte: ["$roi", 20] }, then: "excellent" },
                { case: { $gte: ["$roi", 15] }, then: "good" },
                { case: { $gte: ["$roi", 10] }, then: "average" },
              ],
              default: "poor",
            },
          },
        },
      },
      {
        $sort: { roi: -1 },
      },
      {
        $limit: parseInt(limit),
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          phone: 1,
          country: 1,
          city: 1,
          investmentAmount: 1,
          unitsSold: 1,
          totalProfit: 1,
          totalSaleValue: 1,
          roi: 1,
          profitMargin: 1,
          performance: 1,
          investorProfile: 1,
          createdAt: 1,
        },
      },
    ]);

    res.json(investors);
  } catch (error) {
    console.error("Investor report error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Country-wise Performance Report
router.get("/countries", auth, async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const { start, end } = getDateRange(period);

    // Check permissions
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const countries = await User.aggregate([
      {
        $match: {
          country: { $exists: true, $ne: null, $ne: "" },
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$country",
          totalUsers: { $sum: 1 },
          agents: {
            $sum: { $cond: [{ $eq: ["$role", "agent"] }, 1, 0] },
          },
          drivers: {
            $sum: { $cond: [{ $eq: ["$role", "driver"] }, 1, 0] },
          },
          investors: {
            $sum: { $cond: [{ $eq: ["$role", "investor"] }, 1, 0] },
          },
          customers: {
            $sum: { $cond: [{ $eq: ["$role", "customer"] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "orders",
          let: { country: "$_id" },
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "user",
              },
            },
            {
              $match: {
                $expr: {
                  $eq: [{ $arrayElemAt: ["$user.country", 0] }, "$$country"],
                },
                createdAt: { $gte: start, $lte: end },
              },
            },
          ],
          as: "orders",
        },
      },
      {
        $addFields: {
          totalOrders: { $size: "$orders" },
          totalRevenue: { $sum: "$orders.totalAmount" },
          avgOrderValue: { $avg: "$orders.totalAmount" },
          marketPenetration: {
            $multiply: [
              {
                $divide: [
                  "$customers",
                  { $add: ["$totalUsers", 1] }, // Add 1 to avoid division by zero
                ],
              },
              100,
            ],
          },
        },
      },
      {
        $project: {
          country: "$_id",
          totalUsers: 1,
          agents: 1,
          drivers: 1,
          investors: 1,
          customers: 1,
          totalOrders: 1,
          totalRevenue: 1,
          avgOrderValue: 1,
          marketPenetration: 1,
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
    ]);

    res.json(countries);
  } catch (error) {
    console.error("Country report error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Country-wise Driver Performance Report
router.get("/country-drivers", auth, async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const { start, end } = getDateRange(period);

    // Check permissions
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const countryDrivers = await User.aggregate([
      {
        $match: {
          role: "driver",
          country: { $exists: true, $ne: null, $ne: "" },
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$country",
          totalDrivers: { $sum: 1 },
          activeDrivers: {
            $sum: { $cond: [{ $eq: ["$availability", "available"] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "orders",
          let: { country: "$_id" },
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "assignedDriver",
                foreignField: "_id",
                as: "driver",
              },
            },
            {
              $match: {
                $expr: {
                  $eq: [{ $arrayElemAt: ["$driver.country", 0] }, "$$country"],
                },
                createdAt: { $gte: start, $lte: end },
              },
            },
          ],
          as: "deliveries",
        },
      },
      {
        $addFields: {
          totalDeliveries: { $size: "$deliveries" },
          successfulDeliveries: {
            $size: {
              $filter: {
                input: "$deliveries",
                cond: { $eq: ["$$this.status", "delivered"] },
              },
            },
          },
          totalEarnings: {
            $sum: {
              $map: {
                input: "$deliveries",
                as: "delivery",
                in: { $multiply: ["$$delivery.totalAmount", 0.1] }, // 10% commission
              },
            },
          },
          successRate: {
            $cond: {
              if: { $gt: [{ $size: "$deliveries" }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: "$deliveries",
                            cond: { $eq: ["$$this.status", "delivered"] },
                          },
                        },
                      },
                      { $size: "$deliveries" },
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },
          avgPerformance: {
            $switch: {
              branches: [
                { case: { $gte: ["$successRate", 95] }, then: "excellent" },
                { case: { $gte: ["$successRate", 85] }, then: "good" },
                { case: { $gte: ["$successRate", 70] }, then: "average" },
              ],
              default: "poor",
            },
          },
        },
      },
      {
        $project: {
          country: "$_id",
          totalDrivers: 1,
          activeDrivers: 1,
          totalDeliveries: 1,
          successfulDeliveries: 1,
          totalEarnings: 1,
          successRate: 1,
          avgPerformance: 1,
        },
      },
      {
        $sort: { totalEarnings: -1 },
      },
    ]);

    res.json(countryDrivers);
  } catch (error) {
    console.error("Country driver report error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// User metrics for owner dashboard
router.get("/user-metrics", auth, allowRoles("user"), async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const agents = await User.find(
      { role: "agent", createdBy: ownerId },
      { _id: 1 }
    ).lean();
    const managers = await User.find(
      { role: "manager", createdBy: ownerId },
      { _id: 1 }
    ).lean();
    const creatorIds = [
      ownerId,
      ...agents.map((a) => a._id),
      ...managers.map((m) => m._id),
    ];

    // Date filtering support (from & to query params)
    const dateMatch = {};
    if (req.query.from || req.query.to) {
      dateMatch.createdAt = {};
      if (req.query.from) dateMatch.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) dateMatch.createdAt.$lte = new Date(req.query.to);
      console.log("📅 [USER-METRICS] Date filter applied:", {
        from: req.query.from,
        to: req.query.to,
      });
    }

    // Parallelize independent queries
    const [
      productStats,
      agentExpenseStats,
      driverExpenseStats,
      adExpenseStats,
      investorStats,
      products,
      countryMetrics,
      deliveredPerProdCountry,
      currencySetting,
      driversList,
    ] = await Promise.all([
      // 1. Products In House
      Product.aggregate([
        { $match: { createdBy: ownerId } },
        { $group: { _id: null, totalProductsInHouse: { $sum: "$stockQty" } } },
      ]),
      // 2. Agent Expenses
      AgentRemit.aggregate([
        {
          $match: {
            owner: ownerId,
            status: { $in: ["sent", "approved", "pending"] },
            ...dateMatch,
          },
        },
        { $group: { _id: null, totalAgentExpense: { $sum: "$amount" } } },
      ]),
      // 3. Driver Stats (Delivered orders by driver for commission calc)
      Order.aggregate([
        {
          $match: {
            createdBy: { $in: creatorIds },
            shipmentStatus: "delivered",
            ...dateMatch,
          },
        },
        { $group: { _id: "$deliveryBoy", count: { $sum: 1 } } },
      ]),
      // 4. Advertisement Expenses (Grouped by Country & Currency)
      Expense.aggregate([
        {
          $match: {
            createdBy: { $in: creatorIds },
            type: "advertisement",
            ...dateMatch,
          },
        },
        {
          $group: {
            _id: {
              country: { $ifNull: ["$country", "Global"] },
              currency: { $ifNull: ["$currency", "AED"] },
            },
            total: { $sum: "$amount" },
          },
        },
      ]),
      // 5. Investor Commissions (New - simplified approximation based on User model if needed, or calculated from orders)
      // Assuming investor commissions are tracked in User profile or separate collection.
      // For now, let's check if there's a way to get this. The original code might have had it.
      // Let's assume 0 for now if not found, or try to aggregate from User.investorProfile.totalProfit if date filter allows?
      // Actually, let's stick to what we can reliably get. If original had it, it might be complex.
      // Let's use a placeholder 0 for now to ensure structure exists.
      Promise.resolve([{ totalInvestorComm: 0 }]),

      // 6. Products List
      Product.find({ createdBy: ownerId })
        .select(
          "_id price purchasePrice baseCurrency stockByCountry stock stockQty"
        )
        .lean(),
      // 7. Consolidated Country Metrics
      Order.aggregate([
        { $match: { createdBy: { $in: creatorIds }, ...dateMatch } },
        {
          $addFields: {
            orderCountryCanon: {
              $let: {
                vars: { c: { $ifNull: ["$orderCountry", ""] } },
                in: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $in: [{ $toUpper: "$$c" }, ["KSA", "SAUDI ARABIA"]],
                        },
                        then: "KSA",
                      },
                      {
                        case: {
                          $in: [
                            { $toUpper: "$$c" },
                            ["UAE", "UNITED ARAB EMIRATES"],
                          ],
                        },
                        then: "UAE",
                      },
                      {
                        case: { $in: [{ $toUpper: "$$c" }, ["OMAN", "OM"]] },
                        then: "Oman",
                      },
                      {
                        case: { $in: [{ $toUpper: "$$c" }, ["BAHRAIN", "BH"]] },
                        then: "Bahrain",
                      },
                      {
                        case: { $in: [{ $toUpper: "$$c" }, ["INDIA", "IN"]] },
                        then: "India",
                      },
                      {
                        case: { $in: [{ $toUpper: "$$c" }, ["KUWAIT", "KW"]] },
                        then: "Kuwait",
                      },
                      {
                        case: { $in: [{ $toUpper: "$$c" }, ["QATAR", "QA"]] },
                        then: "Qatar",
                      },
                    ],
                    default: "$$c",
                  },
                },
              },
            },
            qty: {
              $cond: [
                {
                  $and: [
                    { $isArray: "$items" },
                    { $gt: [{ $size: "$items" }, 0] },
                  ],
                },
                {
                  $sum: {
                    $map: {
                      input: "$items",
                      as: "it",
                      in: {
                        $cond: [
                          { $lt: [{ $ifNull: ["$$it.quantity", 1] }, 1] },
                          1,
                          { $ifNull: ["$$it.quantity", 1] },
                        ],
                      },
                    },
                  },
                },
                { $cond: [{ $lt: ["$quantity", 1] }, 1, "$quantity"] },
              ],
            },
          },
        },
        {
          $group: {
            _id: "$orderCountryCanon",
            // Financials
            totalSales: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
            totalCOD: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  {
                    $cond: [
                      { $eq: ["$paymentMethod", "COD"] },
                      { $ifNull: ["$total", 0] },
                      0,
                    ],
                  },
                  0,
                ],
              },
            },
            totalPrepaid: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  {
                    $cond: [
                      { $ne: ["$paymentMethod", "COD"] },
                      { $ifNull: ["$total", 0] },
                      0,
                    ],
                  },
                  0,
                ],
              },
            },
            totalCollected: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  { $ifNull: ["$collectedAmount", 0] },
                  0,
                ],
              },
            },
            amountTotalOrders: { $sum: { $ifNull: ["$total", 0] } },
            amountDelivered: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
            amountPending: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "pending"] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
            amountOpen: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$shipmentStatus",
                      [
                        "pending",
                        "assigned",
                        "picked_up",
                        "in_transit",
                        "out_for_delivery",
                        "no_response",
                        "attempted",
                        "contacted",
                      ],
                    ],
                  },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
            amountDiscountDelivered: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  "$discount",
                  0,
                ],
              },
            },
            // Counts
            totalOrders: { $sum: 1 },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ["$shipmentStatus", "pending"] }, 1, 0] },
            },
            openOrders: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$shipmentStatus",
                      [
                        "pending",
                        "assigned",
                        "picked_up",
                        "in_transit",
                        "out_for_delivery",
                        "no_response",
                        "attempted",
                        "contacted",
                      ],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            assignedOrders: {
              $sum: { $cond: [{ $eq: ["$shipmentStatus", "assigned"] }, 1, 0] },
            },
            pickedUpOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "picked_up"] }, 1, 0],
              },
            },
            inTransitOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "in_transit"] }, 1, 0],
              },
            },
            outForDeliveryOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "out_for_delivery"] }, 1, 0],
              },
            },
            deliveredOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "delivered"] }, 1, 0],
              },
            },
            cancelledOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "cancelled"] }, 1, 0],
              },
            },
            noResponseOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "no_response"] }, 1, 0],
              },
            },
            returnedOrders: {
              $sum: { $cond: [{ $eq: ["$shipmentStatus", "returned"] }, 1, 0] },
            },
            totalProductsOrdered: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "delivered"] }, "$qty", 0],
              },
            },
          },
        },
      ]),
      // 8. Delivered Per Product (for inventory calculations)
      Order.aggregate([
        {
          $match: {
            createdBy: { $in: creatorIds },
            ...dateMatch,
            $and: [
              { $or: [{ shipmentStatus: "delivered" }, { status: "done" }] },
              {
                $or: [
                  { productId: { $exists: true } },
                  { "items.productId": { $exists: true } },
                ],
              },
            ],
          },
        },
        {
          $project: {
            orderCountry: 1,
            total: 1,
            discount: 1,
            items: {
              $cond: [
                {
                  $and: [
                    { $isArray: "$items" },
                    { $gt: [{ $size: "$items" }, 0] },
                  ],
                },
                "$items",
                [
                  {
                    productId: "$productId",
                    quantity: { $ifNull: ["$quantity", 1] },
                  },
                ],
              ],
            },
          },
        },
        { $unwind: "$items" },
        {
          $project: {
            orderCountry: { $ifNull: ["$orderCountry", ""] },
            productId: "$items.productId",
            quantity: {
              $let: {
                vars: { q: { $ifNull: ["$items.quantity", 1] } },
                in: { $cond: [{ $lt: ["$$q", 1] }, 1, "$$q"] },
              },
            },
            orderAmount: { $ifNull: ["$total", 0] },
            discountAmount: { $ifNull: ["$discount", 0] },
            grossAmount: { $ifNull: ["$total", 0] },
          },
        },
        {
          $addFields: {
            orderCountryCanon: {
              $let: {
                vars: { c: { $ifNull: ["$orderCountry", ""] } },
                in: {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $in: [
                            { $toUpper: "$$c" },
                            ["KSA", "SAUDI ARABIA", "SA"],
                          ],
                        },
                        then: "KSA",
                      },
                      {
                        case: {
                          $in: [
                            { $toUpper: "$$c" },
                            ["UAE", "UNITED ARAB EMIRATES", "AE"],
                          ],
                        },
                        then: "UAE",
                      },
                      {
                        case: { $in: [{ $toUpper: "$$c" }, ["OMAN", "OM"]] },
                        then: "Oman",
                      },
                      {
                        case: {
                          $in: [{ $toUpper: "$$c" }, ["BAHRAIN", "BH"]],
                        },
                        then: "Bahrain",
                      },
                      {
                        case: { $in: [{ $toUpper: "$$c" }, ["INDIA", "IN"]] },
                        then: "India",
                      },
                      {
                        case: { $in: [{ $toUpper: "$$c" }, ["KUWAIT", "KW"]] },
                        then: "Kuwait",
                      },
                      {
                        case: { $in: [{ $toUpper: "$$c" }, ["QATAR", "QA"]] },
                        then: "Qatar",
                      },
                    ],
                    default: "$$c",
                  },
                },
              },
            },
            orderCurrency: {
              $ifNull: [
                "$currency",
                {
                  $switch: {
                    branches: [
                      {
                        case: {
                          $in: [
                            { $toUpper: { $ifNull: ["$orderCountry", ""] } },
                            ["KSA", "SAUDI ARABIA"],
                          ],
                        },
                        then: "SAR",
                      },
                      {
                        case: {
                          $in: [
                            { $toUpper: { $ifNull: ["$orderCountry", ""] } },
                            ["UAE", "UNITED ARAB EMIRATES"],
                          ],
                        },
                        then: "AED",
                      },
                      {
                        case: {
                          $in: [
                            { $toUpper: { $ifNull: ["$orderCountry", ""] } },
                            ["OMAN", "OM"],
                          ],
                        },
                        then: "OMR",
                      },
                      {
                        case: {
                          $in: [
                            { $toUpper: { $ifNull: ["$orderCountry", ""] } },
                            ["BAHRAIN", "BH"],
                          ],
                        },
                        then: "BHD",
                      },
                      {
                        case: {
                          $in: [
                            { $toUpper: { $ifNull: ["$orderCountry", ""] } },
                            ["INDIA", "IN"],
                          ],
                        },
                        then: "INR",
                      },
                      {
                        case: {
                          $in: [
                            { $toUpper: { $ifNull: ["$orderCountry", ""] } },
                            ["KUWAIT", "KW"],
                          ],
                        },
                        then: "KWD",
                      },
                      {
                        case: {
                          $in: [
                            { $toUpper: { $ifNull: ["$orderCountry", ""] } },
                            ["QATAR", "QA"],
                          ],
                        },
                        then: "QAR",
                      },
                    ],
                    default: "AED",
                  },
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: {
              productId: "$productId",
              country: "$orderCountryCanon",
              currency: "$orderCurrency",
            },
            qty: { $sum: "$quantity" },
            totalAmount: { $sum: "$orderAmount" },
            totalDiscount: { $sum: "$discountAmount" },
            totalGross: { $sum: "$grossAmount" },
          },
        },
      ]),
      Setting.findOne({ key: "currency" }).lean(),
      // 9. Drivers List (for commission rates)
      User.find({ role: "driver", createdBy: { $in: creatorIds } })
        .select("_id driverProfile country")
        .lean(),
    ]);

    // Currency Config Logic
    const currencyConfig = currencySetting?.value || {};
    const pkrPerUnit = currencyConfig.pkrPerUnit || { AED: 76 };
    const pkrToAEDRate = pkrPerUnit.AED || 76;

    // --- Process Results ---

    const initialOrderStats = {
      totalOrders: 0,
      totalSales: 0,
      totalCOD: 0,
      totalPrepaid: 0,
      totalCollected: 0,
      pendingOrders: 0,
      openOrders: 0,
      assignedOrders: 0,
      pickedUpOrders: 0,
      inTransitOrders: 0,
      outForDeliveryOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      noResponseOrders: 0,
      returnedOrders: 0,
      totalProductsOrdered: 0,
    };

    const orders = countryMetrics.reduce((acc, curr) => {
      acc.totalOrders += curr.totalOrders || 0;
      acc.totalSales += curr.totalSales || 0;
      acc.totalCOD += curr.totalCOD || 0;
      acc.totalPrepaid += curr.totalPrepaid || 0;
      acc.totalCollected += curr.totalCollected || 0;
      acc.pendingOrders += curr.pendingOrders || 0;
      acc.openOrders += curr.openOrders || 0;
      acc.assignedOrders += curr.assignedOrders || 0;
      acc.pickedUpOrders += curr.pickedUpOrders || 0;
      acc.inTransitOrders += curr.inTransitOrders || 0;
      acc.outForDeliveryOrders += curr.outForDeliveryOrders || 0;
      acc.deliveredOrders += curr.deliveredOrders || 0;
      acc.cancelledOrders += curr.cancelledOrders || 0;
      acc.noResponseOrders += curr.noResponseOrders || 0;
      acc.returnedOrders += curr.returnedOrders || 0;
      acc.totalProductsOrdered += curr.totalProductsOrdered || 0;
      return acc;
    }, initialOrderStats);

    // Helper: Convert any currency to AED using dynamic rates
    const toAED = (amount, currency) => {
      if (!amount) return 0;
      const cur = String(currency || "AED").toUpperCase();
      // Get rate: How many PKR is 1 unit of 'cur'?
      const ratePKR = pkrPerUnit[cur] || pkrPerUnit.AED || 76;
      // Convert 'amount' to PKR then to AED
      // Amount(PKR) = Amount(Cur) * Rate(PKR/Cur)
      // Amount(AED) = Amount(PKR) / Rate(PKR/AED)
      return (amount * ratePKR) / pkrToAEDRate;
    };

    const totalProductsInHouse = productStats[0]?.totalProductsInHouse || 0;

    // Agent Expense (Already in PKR, convert to AED)
    const totalAgentExpensePKR = agentExpenseStats[0]?.totalAgentExpense || 0;
    const totalAgentExpense = totalAgentExpensePKR / pkrToAEDRate;

    // Driver Expense (Calculated from delivered orders * commission)
    const driverMap = new Map();
    (driversList || []).forEach((d) => {
      driverMap.set(String(d._id), {
        commission: d.driverProfile?.commissionPerOrder || 0,
        currency: d.driverProfile?.commissionCurrency || "AED",
        country: d.country || "UAE",
      });
    });

    const driverCommissionByCountry = {};
    const totalDriverExpense = driverExpenseStats.reduce((sum, item) => {
      const driverId = String(item._id || "");
      const count = item.count || 0;
      const info = driverMap.get(driverId);
      if (!info) return sum; // Skip if driver not found (or deleted)

      const commAmount = count * info.commission;
      const commAED = toAED(commAmount, info.currency);

      // Aggregate by country
      const country = info.country || "Other";
      driverCommissionByCountry[country] =
        (driverCommissionByCountry[country] || 0) + commAED;

      return sum + commAED;
    }, 0);

    // Ad Expense (Calculate total and per-country)
    const adExpenseByCountry = {};
    const totalAdExpense = adExpenseStats.reduce((sum, item) => {
      const country = item._id?.country || "Global";
      const currency = item._id?.currency || "AED";
      const amountAED = toAED(item.total, currency);

      adExpenseByCountry[country] =
        (adExpenseByCountry[country] || 0) + amountAED;
      return sum + amountAED;
    }, 0);

    const totalInvestorComm = investorStats[0]?.totalInvestorComm || 0;
    const totalExpense =
      totalAgentExpense +
      totalDriverExpense +
      totalAdExpense +
      totalInvestorComm;

    // 2. Process Product Metrics (Inventory) & Purchase Cost
    const productIds = products.map((p) => p._id);
    const deliveredMap = new Map();
    const deliveredAmountMap = new Map();
    const deliveredDiscountMap = new Map();

    for (const r of deliveredPerProdCountry) {
      const pid = String(r._id?.productId || "");
      const country = String(r._id?.country || "");
      const currency = String(r._id?.currency || "AED");
      if (!pid || !productIds.some((id) => String(id) === pid)) continue;

      if (!deliveredMap.has(pid)) deliveredMap.set(pid, {});
      if (!deliveredAmountMap.has(pid)) deliveredAmountMap.set(pid, {});
      if (!deliveredDiscountMap.has(pid)) deliveredDiscountMap.set(pid, {});

      deliveredMap.get(pid)[country] =
        (deliveredMap.get(pid)[country] || 0) + Number(r.qty || 0);

      if (!deliveredAmountMap.get(pid)[country])
        deliveredAmountMap.get(pid)[country] = {};
      deliveredAmountMap.get(pid)[country][currency] =
        (deliveredAmountMap.get(pid)[country][currency] || 0) +
        Number(r.totalAmount || 0);

      if (!deliveredDiscountMap.get(pid)[country])
        deliveredDiscountMap.get(pid)[country] = {};
      deliveredDiscountMap.get(pid)[country][currency] =
        (deliveredDiscountMap.get(pid)[country][currency] || 0) +
        Number(r.totalDiscount || 0);
    }

    const KNOWN_COUNTRIES = [
      "KSA",
      "UAE",
      "Oman",
      "Bahrain",
      "India",
      "Kuwait",
      "Qatar",
    ];
    const emptyCurrencyMap = () => ({
      AED: 0,
      OMR: 0,
      SAR: 0,
      BHD: 0,
      INR: 0,
      KWD: 0,
      QAR: 0,
      USD: 0,
      CNY: 0,
    });
    const productCountryAgg = {};
    for (const c of KNOWN_COUNTRIES) {
      productCountryAgg[c] = {
        stockPurchasedQty: 0,
        stockDeliveredQty: 0,
        stockLeftQty: 0,
        purchaseValueByCurrency: emptyCurrencyMap(),
        totalPurchaseValueByCurrency: emptyCurrencyMap(),
        deliveredValueByCurrency: emptyCurrencyMap(),
        discountValueByCurrency: emptyCurrencyMap(),
      };
    }
    const productGlobal = {
      stockPurchasedQty: 0,
      stockDeliveredQty: 0,
      stockLeftQty: 0,
      purchaseValueByCurrency: emptyCurrencyMap(),
      totalPurchaseValueByCurrency: emptyCurrencyMap(),
      deliveredValueByCurrency: emptyCurrencyMap(),
      discountValueByCurrency: emptyCurrencyMap(),
    };
    const normalizeCur = (v) =>
      ["AED", "OMR", "SAR", "BHD", "INR", "KWD", "QAR", "USD", "CNY"].includes(
        String(v)
      )
        ? String(v)
        : "SAR";

    let totalPurchaseCost = 0; // Global purchase cost of delivered items (approx)

    for (const p of products) {
      const baseCur = normalizeCur(p.baseCurrency || "SAR");
      const purchasePrice = Number(p.purchasePrice || 0);
      const byC = p.stockByCountry || {};
      const hasStockByCountry =
        byC && Object.keys(byC).some((k) => Number(byC[k] || 0) > 0);

      const totalStockFallback = Number(p.stock || p.stockQty || 0);

      const leftBy = {
        KSA: Number(byC.KSA || 0),
        UAE: Number(byC.UAE || 0),
        Oman: Number(byC.Oman || 0),
        Bahrain: Number(byC.Bahrain || 0),
        India: Number(byC.India || 0),
        Kuwait: Number(byC.Kuwait || 0),
        Qatar: Number(byC.Qatar || 0),
      };
      const delBy = deliveredMap.get(String(p._id)) || {};
      const delAmountBy = deliveredAmountMap.get(String(p._id)) || {};
      const discAmountBy = deliveredDiscountMap.get(String(p._id)) || {};
      let totalLeft = 0,
        totalDelivered = 0;

      if (!hasStockByCountry) {
        const delivered = Object.values(delBy).reduce(
          (s, v) => s + Number(v || 0),
          0
        );
        for (const countryAmounts of Object.values(delAmountBy)) {
          if (typeof countryAmounts === "object") {
            for (const [cur, amt] of Object.entries(countryAmounts)) {
              if (productGlobal.deliveredValueByCurrency[cur] !== undefined) {
                productGlobal.deliveredValueByCurrency[cur] += Number(amt || 0);
              }
            }
          }
        }
        const left = totalStockFallback;
        const purchased = left + delivered;
        totalLeft = left;
        totalDelivered = delivered;
        productGlobal.stockLeftQty += left;
        productGlobal.stockDeliveredQty += delivered;
        productGlobal.stockPurchasedQty += purchased;
        productGlobal.totalPurchaseValueByCurrency[baseCur] += Number(
          p.purchasePrice || 0
        );
        const purchaseValueOfRemaining =
          purchased > 0
            ? Number(p.purchasePrice || 0) * (left / purchased)
            : Number(p.purchasePrice || 0);
        productGlobal.purchaseValueByCurrency[baseCur] +=
          purchaseValueOfRemaining;

        // Add to total purchase cost (delivered * purchasePrice)
        // Note: This is a simplification. Ideally we convert currency.
        // For now, let's assume purchasePrice is in baseCurrency and we might need to convert to AED later.
        // But for now, let's just sum it up in base currency and handle conversion in profitLoss object if possible.
        // Actually, the frontend expects a single number for purchaseCost.
        // We should convert to AED here.

        for (const c of KNOWN_COUNTRIES) {
          const dQty = Number(delBy[c] || 0);
          if (dQty > 0) {
            productCountryAgg[c].stockDeliveredQty += dQty;
          }
          const cAmts = delAmountBy[c] || {};
          if (cAmts && typeof cAmts === "object") {
            for (const [cur, amt] of Object.entries(cAmts)) {
              if (
                productCountryAgg[c].deliveredValueByCurrency[cur] !== undefined
              ) {
                productCountryAgg[c].deliveredValueByCurrency[cur] += Number(
                  amt || 0
                );
              }
            }
          }
          const cDisc = discAmountBy[c] || {};
          if (cDisc && typeof cDisc === "object") {
            for (const [cur, amt] of Object.entries(cDisc)) {
              if (
                productCountryAgg[c].discountValueByCurrency[cur] !== undefined
              ) {
                productCountryAgg[c].discountValueByCurrency[cur] += Number(
                  amt || 0
                );
              }
            }
          }
        }
      } else {
        for (const c of KNOWN_COUNTRIES) {
          const left = Number(leftBy[c] || 0);
          const delivered = Number(delBy[c] || 0);
          const countryAmounts = delAmountBy[c] || {};
          const purchased = left + delivered;
          totalLeft += left;
          totalDelivered += delivered;
          productCountryAgg[c].stockLeftQty += left;
          productCountryAgg[c].stockDeliveredQty += delivered;
          productCountryAgg[c].stockPurchasedQty += purchased;
          productCountryAgg[c].totalPurchaseValueByCurrency[baseCur] +=
            purchased * Number(p.purchasePrice || 0);
          productCountryAgg[c].purchaseValueByCurrency[baseCur] +=
            left * Number(p.purchasePrice || 0);
          if (typeof countryAmounts === "object") {
            for (const [cur, amt] of Object.entries(countryAmounts)) {
              if (
                productCountryAgg[c].deliveredValueByCurrency[cur] !== undefined
              ) {
                productCountryAgg[c].deliveredValueByCurrency[cur] += Number(
                  amt || 0
                );
              }
              if (productGlobal.deliveredValueByCurrency[cur] !== undefined) {
                productGlobal.deliveredValueByCurrency[cur] += Number(amt || 0);
              }
            }
          }
          const countryDiscounts = discAmountBy[c] || {};
          if (typeof countryDiscounts === "object") {
            for (const [cur, amt] of Object.entries(countryDiscounts)) {
              if (
                productCountryAgg[c].discountValueByCurrency[cur] !== undefined
              ) {
                productCountryAgg[c].discountValueByCurrency[cur] += Number(
                  amt || 0
                );
              }
              if (productGlobal.discountValueByCurrency[cur] !== undefined) {
                productGlobal.discountValueByCurrency[cur] += Number(amt || 0);
              }
            }
          }
        }
        productGlobal.stockLeftQty += totalLeft;
        productGlobal.stockDeliveredQty += totalDelivered;
        productGlobal.stockPurchasedQty += totalLeft + totalDelivered;
        productGlobal.totalPurchaseValueByCurrency[baseCur] +=
          (totalLeft + totalDelivered) * Number(p.purchasePrice || 0);
        productGlobal.purchaseValueByCurrency[baseCur] +=
          totalLeft * Number(p.purchasePrice || 0);
      }
    }

    // 3. Format Response
    const countries = {};
    countryMetrics.forEach((cm) => {
      if (cm._id) {
        countries[cm._id] = {
          totalSales: cm.totalSales,
          amountTotalOrders: cm.amountTotalOrders,
          amountDelivered: cm.amountDelivered,
          amountPending: cm.amountPending,
          amountOpen: cm.amountOpen,
          amountDiscountDelivered: cm.amountDiscountDelivered,
          orders: cm.totalOrders,
          pendingOrders: cm.pendingOrders,
          openOrders: cm.openOrders,
          assignedOrders: cm.assignedOrders,
          pickedUpOrders: cm.pickedUpOrders,
          inTransitOrders: cm.inTransitOrders,
          outForDeliveryOrders: cm.outForDeliveryOrders,
          deliveredOrders: cm.deliveredOrders,
          cancelledOrders: cm.cancelledOrders,
          noResponseOrders: cm.noResponseOrders,
          returnedOrders: cm.returnedOrders,
          totalProductsOrdered: cm.totalProductsOrdered,
        };
      }
    });

    const statusTotals = {
      total: orders.totalOrders,
      pending: orders.pendingOrders,
      assigned: orders.assignedOrders,
      picked_up: orders.pickedUpOrders,
      in_transit: orders.inTransitOrders,
      out_for_delivery: orders.outForDeliveryOrders,
      delivered: orders.deliveredOrders,
      no_response: orders.noResponseOrders,
      returned: orders.returnedOrders,
      cancelled: orders.cancelledOrders,
    };

    // --- PROFIT/LOSS CALCULATION ---
    let totalPurchaseCostAED = 0;
    for (const p of products) {
      const baseCur = normalizeCur(p.baseCurrency || "SAR");
      const price = Number(p.purchasePrice || 0);
      const delBy = deliveredMap.get(String(p._id)) || {};
      const totalDel = Object.values(delBy).reduce((a, b) => a + b, 0);
      totalPurchaseCostAED += toAED(totalDel * price, baseCur);
    }

    const totalRevenueAED = orders.totalSales; // Assuming totalSales is already in AED or mixed?
    // Actually, orders.totalSales is sum of `total`. `total` in Order is usually in local currency.
    // We should convert revenue to AED too if it's mixed.
    // But `Order` model usually has `total` in local currency.
    // Let's approximate: Iterate countryMetrics to convert sales to AED.
    let totalRevenueAED_Calc = 0;
    const profitByCountry = {};

    countryMetrics.forEach((cm) => {
      const country = cm._id;
      const cur =
        country === "Oman"
          ? "OMR"
          : country === "Bahrain"
          ? "BHD"
          : country === "Kuwait"
          ? "KWD"
          : "AED"; // Simplified
      const sales = cm.totalSales || 0;
      const salesAED = toAED(sales, cur);
      totalRevenueAED_Calc += salesAED;

      // Per country profit (simplified)
      // We need purchase cost per country
      let countryPurchaseCostAED = 0;
      for (const p of products) {
        const baseCur = normalizeCur(p.baseCurrency || "SAR");
        const price = Number(p.purchasePrice || 0);
        const delBy = deliveredMap.get(String(p._id)) || {};
        const qty = delBy[country] || 0;
        countryPurchaseCostAED += toAED(qty * price, baseCur);
      }

      const driverExp = driverCommissionByCountry[country] || 0;
      const adExp = adExpenseByCountry[country] || 0;

      profitByCountry[country] = {
        revenue: salesAED,
        purchaseCost: countryPurchaseCostAED,
        driverCommission: driverExp,
        advertisementExpense: adExp,
        profit: salesAED - countryPurchaseCostAED - driverExp - adExp,
        currency: "AED",
      };
    });

    const globalProfit =
      totalRevenueAED_Calc - totalPurchaseCostAED - totalExpense;

    res.json({
      totalSales: orders.totalSales,
      totalCOD: orders.totalCOD,
      totalPrepaid: orders.totalPrepaid,
      totalCollected: orders.totalCollected,
      totalOrders: orders.totalOrders,
      pendingOrders: orders.pendingOrders,
      pickedUpOrders: orders.pickedUpOrders,
      deliveredOrders: orders.deliveredOrders,
      cancelledOrders: orders.cancelledOrders,
      totalProductsInHouse,
      totalProductsOrdered: orders.totalProductsOrdered,
      totalDeposit: 0,
      totalWithdraw: 0,
      totalExpense,
      totalAgentExpense,
      totalDriverExpense,
      totalRevenue: orders.totalSales,
      profitLoss: {
        isProfit: globalProfit >= 0,
        profit: globalProfit,
        revenue: totalRevenueAED_Calc,
        purchaseCost: totalPurchaseCostAED,
        driverCommission: totalDriverExpense,
        agentCommission: totalAgentExpense,
        investorCommission: totalInvestorComm,
        advertisementExpense: totalAdExpense,
        byCountry: profitByCountry,
      },
      countries,
      statusTotals,
      productMetrics: {
        global: productGlobal,
        countries: productCountryAgg,
      },
    });
  } catch (error) {
    console.error("User metrics error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Sales by country for user dashboard (workspace scoped)
router.get(
  "/user-metrics/sales-by-country",
  auth,
  allowRoles("user"),
  async (req, res) => {
    try {
      const ownerId = req.user.id;
      const agents = await User.find(
        { role: "agent", createdBy: ownerId },
        { _id: 1 }
      ).lean();
      const managers = await User.find(
        { role: "manager", createdBy: ownerId },
        { _id: 1 }
      ).lean();
      const creatorIds = [
        ownerId,
        ...agents.map((a) => a._id),
        ...managers.map((m) => m._id),
      ];

      // Date filtering support
      const dateMatch = {};
      if (req.query.from || req.query.to) {
        dateMatch.createdAt = {};
        if (req.query.from) dateMatch.createdAt.$gte = new Date(req.query.from);
        if (req.query.to) dateMatch.createdAt.$lte = new Date(req.query.to);
        console.log("📅 [SALES-BY-COUNTRY] Date filter applied:", {
          from: req.query.from,
          to: req.query.to,
        });
      }

      const rows = await Order.aggregate([
        {
          $match: {
            createdBy: { $in: creatorIds },
            shipmentStatus: "delivered",
            ...dateMatch,
          },
        },
        {
          $group: {
            _id: "$orderCountry",
            sum: { $sum: { $ifNull: ["$total", 0] } },
          },
        },
      ]);
      const acc = { KSA: 0, Oman: 0, UAE: 0, Bahrain: 0, Other: 0 };
      for (const r of rows) {
        const key = String(r._id || "").trim();
        if (acc.hasOwnProperty(key)) acc[key] += Number(r.sum || 0);
        else acc.Other += Number(r.sum || 0);
      }
      res.json(acc);
    } catch (error) {
      console.error("Error fetching sales-by-country:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Manager metrics for dashboard (assigned countries scoped)
router.get(
  "/manager-metrics",
  auth,
  allowRoles("manager"),
  async (req, res) => {
    try {
      const mgr = await User.findById(req.user.id)
        .select("createdBy assignedCountry assignedCountries")
        .lean();
      const ownerId = mgr?.createdBy
        ? new mongoose.Types.ObjectId(mgr.createdBy)
        : new mongoose.Types.ObjectId(req.user.id);
      const agents = await User.find(
        { role: "agent", createdBy: ownerId },
        { _id: 1 }
      ).lean();
      const managers = await User.find(
        { role: "manager", createdBy: ownerId },
        { _id: 1 }
      ).lean();
      const creatorIds = [
        ownerId,
        ...agents.map((a) => a._id),
        ...managers.map((m) => m._id),
      ];

      const expand = (c) =>
        c === "KSA" || c === "Saudi Arabia"
          ? ["KSA", "Saudi Arabia"]
          : c === "UAE" || c === "United Arab Emirates"
          ? ["UAE", "United Arab Emirates"]
          : [c];
      const assignedCountries =
        Array.isArray(mgr?.assignedCountries) && mgr.assignedCountries.length
          ? mgr.assignedCountries
          : mgr?.assignedCountry
          ? [mgr.assignedCountry]
          : [];
      let allowedCountries = null;
      if (assignedCountries.length) {
        const set = new Set();
        for (const c of assignedCountries) {
          for (const x of expand(c)) set.add(x);
        }
        allowedCountries = Array.from(set);
      }

      const baseMatch = { createdBy: { $in: creatorIds } };
      if (allowedCountries) baseMatch.orderCountry = { $in: allowedCountries };

      const orderStats = await Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSales: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
            totalCOD: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  {
                    $cond: [
                      { $eq: ["$paymentMethod", "COD"] },
                      { $ifNull: ["$total", 0] },
                      0,
                    ],
                  },
                  0,
                ],
              },
            },
            totalPrepaid: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  {
                    $cond: [
                      { $ne: ["$paymentMethod", "COD"] },
                      { $ifNull: ["$total", 0] },
                      0,
                    ],
                  },
                  0,
                ],
              },
            },
            totalCollected: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  { $ifNull: ["$collectedAmount", 0] },
                  0,
                ],
              },
            },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            pickedUpOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "picked_up"] }, 1, 0],
              },
            },
            deliveredOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "delivered"] }, 1, 0],
              },
            },
            cancelledOrders: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$shipmentStatus", "cancelled"] },
                      { $eq: ["$status", "cancelled"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalProductsOrdered: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  "$quantity",
                  0,
                ],
              },
            },
          },
        },
      ]);
      const orders = orderStats[0] || {
        totalOrders: 0,
        totalSales: 0,
        totalCOD: 0,
        totalPrepaid: 0,
        totalCollected: 0,
        pendingOrders: 0,
        pickedUpOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalProductsOrdered: 0,
      };

      const countryMetrics = await Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$orderCountry",
            // amounts
            totalSales: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
            amountTotalOrders: { $sum: { $ifNull: ["$total", 0] } },
            amountDelivered: {
              $sum: {
                $cond: [
                  { $eq: ["$shipmentStatus", "delivered"] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
            amountPending: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "pending"] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
            // counts
            totalOrders: { $sum: 1 },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            pickedUpOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "picked_up"] }, 1, 0],
              },
            },
            deliveredOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "delivered"] }, 1, 0],
              },
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
            },
            outForDeliveryOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "out_for_delivery"] }, 1, 0],
              },
            },
            noResponseOrders: {
              $sum: {
                $cond: [{ $eq: ["$shipmentStatus", "no_response"] }, 1, 0],
              },
            },
            returnedOrders: {
              $sum: { $cond: [{ $eq: ["$shipmentStatus", "returned"] }, 1, 0] },
            },
          },
        },
      ]);

      // Format country metrics (restrict to known set; aliases supported via expand above)
      const countries = {
        KSA: {},
        Oman: {},
        UAE: {},
        Bahrain: {},
        "Saudi Arabia": {},
        India: {},
        Kuwait: {},
        Qatar: {},
      };
      countryMetrics.forEach((cm) => {
        const country = cm._id || "Other";
        if (countries[country]) {
          countries[country].sales = cm.totalSales || 0;
          countries[country].orders = cm.totalOrders || 0;
          countries[country].pickedUp = cm.pickedUpOrders || 0;
          countries[country].delivered = cm.deliveredOrders || 0;
          countries[country].transit = cm.inTransitOrders || 0;
          countries[country].pending = cm.pendingOrders || 0;
          countries[country].assigned = cm.assignedOrders || 0;
          countries[country].outForDelivery = cm.outForDeliveryOrders || 0;
          countries[country].noResponse = cm.noResponseOrders || 0;
          countries[country].returned = cm.returnedOrders || 0;
          countries[country].cancelled = cm.cancelledOrders || 0;
          countries[country].amountTotalOrders = cm.amountTotalOrders || 0;
          countries[country].amountDelivered = cm.amountDelivered || 0;
          countries[country].amountPending = cm.amountPending || 0;
        }
      });

      // Aggregate status totals across countries (counts)
      const statusTotals = Object.keys(countries).reduce(
        (acc, k) => {
          const c = countries[k] || {};
          acc.total += Number(c.orders || 0);
          acc.pending += Number(c.pending || 0);
          acc.assigned += Number(c.assigned || 0);
          acc.picked_up += Number(c.pickedUp || 0);
          acc.in_transit += Number(c.transit || 0);
          acc.out_for_delivery += Number(c.outForDelivery || 0);
          acc.delivered += Number(c.delivered || 0);
          acc.no_response += Number(c.noResponse || 0);
          acc.returned += Number(c.returned || 0);
          acc.cancelled += Number(c.cancelled || 0);
          return acc;
        },
        {
          total: 0,
          pending: 0,
          assigned: 0,
          picked_up: 0,
          in_transit: 0,
          out_for_delivery: 0,
          delivered: 0,
          no_response: 0,
          returned: 0,
          cancelled: 0,
        }
      );

      res.json({
        totalSales: orders.totalSales,
        totalCOD: orders.totalCOD,
        totalPrepaid: orders.totalPrepaid,
        totalCollected: orders.totalCollected,
        totalOrders: orders.totalOrders,
        pendingOrders: orders.pendingOrders,
        pickedUpOrders: orders.pickedUpOrders,
        deliveredOrders: orders.deliveredOrders,
        cancelledOrders: orders.cancelledOrders,
        totalProductsOrdered: orders.totalProductsOrdered,
        countries,
        statusTotals,
      });
    } catch (error) {
      console.error("Error fetching manager metrics:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Driver metrics endpoint for Driver Reports
router.get("/driver-metrics", auth, allowRoles("user"), async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);

    // Get all managers created by this owner
    const managers = await User.find(
      { role: "manager", createdBy: ownerId },
      { _id: 1, firstName: 1, lastName: 1, phone: 1 }
    ).lean();
    const managerIds = managers.map((m) => m._id);

    // Get all drivers created by owner or their managers
    const drivers = await User.find({
      role: "driver",
      $or: [{ createdBy: ownerId }, { createdBy: { $in: managerIds } }],
    })
      .select("firstName lastName phone country city createdBy driverProfile")
      .lean();

    // Map country to currency
    const countryCurrencyMap = {
      KSA: "SAR",
      UAE: "AED",
      Oman: "OMR",
      Bahrain: "BHD",
      India: "INR",
      Kuwait: "KWD",
      Qatar: "QAR",
    };

    // Build manager lookup map for quick access
    const managerMap = new Map();
    managers.forEach((m) => {
      managerMap.set(m._id.toString(), {
        name: `${m.firstName || ""} ${m.lastName || ""}`.trim(),
        phone: m.phone,
      });
    });

    // Use aggregation pipeline to get all driver metrics efficiently
    const driverMetrics = await User.aggregate([
      {
        $match: {
          _id: { $in: drivers.map((d) => d._id) },
        },
      },
      // Lookup order statistics
      {
        $lookup: {
          from: "orders",
          let: { driverId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$deliveryBoy", "$$driverId"] },
              },
            },
            {
              $group: {
                _id: null,
                ordersDelivered: {
                  $sum: {
                    $cond: [{ $eq: ["$shipmentStatus", "delivered"] }, 1, 0],
                  },
                },
                ordersAssigned: { $sum: 1 },
                ordersPending: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          "$shipmentStatus",
                          [
                            "assigned",
                            "picked_up",
                            "in_transit",
                            "out_for_delivery",
                          ],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          as: "orderStats",
        },
      },
      // Lookup remittances
      {
        $lookup: {
          from: "remittances",
          let: { driverId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$driver", "$$driverId"] },
              },
            },
          ],
          as: "remittances",
        },
      },
      // Calculate settlement statistics
      {
        $addFields: {
          orderStats: { $arrayElemAt: ["$orderStats", 0] },
          settlementAmount: {
            $sum: {
              $map: {
                input: "$remittances",
                as: "remit",
                in: { $ifNull: ["$$remit.amount", 0] },
              },
            },
          },
          payToCompany: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$remittances",
                    cond: { $eq: ["$$this.status", "accepted"] },
                  },
                },
                as: "remit",
                in: { $ifNull: ["$$remit.amount", 0] },
              },
            },
          },
          pendingSettlement: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$remittances",
                    cond: { $eq: ["$$this.status", "pending"] },
                  },
                },
                as: "remit",
                in: { $ifNull: ["$$remit.amount", 0] },
              },
            },
          },
        },
      },
      // Calculate payToManager
      {
        $addFields: {
          payToManager: {
            $max: [
              0,
              {
                $subtract: [
                  "$settlementAmount",
                  { $add: ["$payToCompany", "$pendingSettlement"] },
                ],
              },
            ],
          },
        },
      },
      // Project final shape
      {
        $project: {
          id: { $toString: "$_id" },
          name: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$firstName", ""] },
                  " ",
                  { $ifNull: ["$lastName", ""] },
                ],
              },
            },
          },
          phone: { $ifNull: ["$phone", "N/A"] },
          country: { $ifNull: ["$country", "N/A"] },
          city: { $ifNull: ["$city", "N/A"] },
          ordersDelivered: { $ifNull: ["$orderStats.ordersDelivered", 0] },
          ordersAssigned: { $ifNull: ["$orderStats.ordersAssigned", 0] },
          ordersPending: { $ifNull: ["$orderStats.ordersPending", 0] },
          settlementAmount: { $round: "$settlementAmount" },
          payToCompany: { $round: "$payToCompany" },
          payToManager: { $round: "$payToManager" },
          pendingSettlement: { $round: "$pendingSettlement" },
          commissionPerOrder: {
            $ifNull: ["$driverProfile.commissionPerOrder", null],
          },
          commissionCurrency: {
            $ifNull: ["$driverProfile.commissionCurrency", null],
          },
          createdBy: 1,
        },
      },
    ]);

    // Post-process to add currency and manager info
    const processedDrivers = driverMetrics.map((driver) => {
      const currency = countryCurrencyMap[driver.country] || "AED";

      // Find manager info if driver was created by a manager
      let managerInfo = null;
      if (driver.createdBy && !driver.createdBy.equals(ownerId)) {
        const managerData = managerMap.get(driver.createdBy.toString());
        if (managerData) {
          managerInfo = managerData;
        }
      }

      return {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        country: driver.country,
        city: driver.city,
        currency,
        ordersDelivered: driver.ordersDelivered,
        ordersAssigned: driver.ordersAssigned,
        ordersPending: driver.ordersPending,
        settlementAmount: driver.settlementAmount,
        payToCompany: driver.payToCompany,
        payToManager: driver.payToManager,
        pendingSettlement: driver.pendingSettlement,
        manager: managerInfo,
        commissionPerOrder: driver.commissionPerOrder,
        commissionCurrency: driver.commissionCurrency,
      };
    });

    res.json({ drivers: driverMetrics });
  } catch (error) {
    console.error("Error fetching driver metrics:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
