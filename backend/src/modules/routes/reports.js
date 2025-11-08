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
router.get('/user-metrics', auth, allowRoles('user'), async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean();
    const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean();
    const creatorIds = [ownerId, ...agents.map(a => a._id), ...managers.map(m => m._id)];
    
    // Date filtering support (from & to query params)
    const dateMatch = {};
    if (req.query.from || req.query.to) {
      dateMatch.createdAt = {};
      if (req.query.from) dateMatch.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) dateMatch.createdAt.$lte = new Date(req.query.to);
      console.log('📅 [USER-METRICS] Date filter applied:', {
        from: req.query.from,
        to: req.query.to,
        fromDate: dateMatch.createdAt.$gte,
        toDate: dateMatch.createdAt.$lte
      });
    } else {
      console.log('⚠️ [USER-METRICS] No date filter - showing all time data');
    }
    
    // All metrics from orders
    const orderStats = await Order.aggregate([
      { $match: { createdBy: { $in: creatorIds }, ...dateMatch } },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSales: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $ifNull: ['$total', 0] }, 0 ] } },
        totalCOD: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $cond: [ { $eq: ['$paymentMethod', 'COD'] }, { $ifNull: ['$total', 0] }, 0 ] }, 0 ] } },
        totalPrepaid: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $cond: [ { $ne: ['$paymentMethod', 'COD'] }, { $ifNull: ['$total', 0] }, 0 ] }, 0 ] } },
        totalCollected: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $ifNull: ['$collectedAmount', 0] }, 0 ] } },
        pendingOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'pending'] }, 1, 0 ] } },
        openOrders: { $sum: { $cond: [ { $in: ['$shipmentStatus', ['pending','assigned','picked_up','in_transit','out_for_delivery','no_response','attempted','contacted']] }, 1, 0 ] } },
        pickedUpOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'picked_up'] }, 1, 0 ] } },
        deliveredOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, 1, 0 ] } },
        cancelledOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'cancelled'] }, 1, 0 ] } },
        totalProductsOrdered: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, '$quantity', 0 ] } },
      } }
    ]);
    const orders = orderStats[0] || { 
      totalOrders: 0, 
      totalSales: 0, 
      totalCOD: 0,
      totalPrepaid: 0,
      pendingOrders: 0, 
      pickedUpOrders: 0, 
      deliveredOrders: 0, 
      cancelledOrders: 0,
      totalProductsOrdered: 0
    };
    console.log('📊 [USER-METRICS] Order stats result:', {
      totalOrders: orders.totalOrders,
      deliveredOrders: orders.deliveredOrders,
      totalSales: orders.totalSales
    });
    
    // Products In House - from inventory (remaining stock)
    const productStats = await Product.aggregate([
      { $match: { createdBy: ownerId } },
      { $group: { _id: null, totalProductsInHouse: { $sum: '$stockQty' } } }
    ]);
    const totalProductsInHouse = productStats[0]?.totalProductsInHouse || 0;
    
    // Agent expenses from remittances
    const agentExpenseStats = await AgentRemit.aggregate([
      { $match: { owner: ownerId, status: 'sent' } },
      { $group: { _id: null, totalAgentExpense: { $sum: '$amount' } } }
    ]);
    const totalAgentExpense = agentExpenseStats[0]?.totalAgentExpense || 0;
    
    // Driver expenses from remittances
    const driverExpenseStats = await Remittance.aggregate([
      { $match: { owner: ownerId, status: 'accepted' } },
      { $group: { _id: null, totalDriverExpense: { $sum: '$amount' } } }
    ]);
    const totalDriverExpense = driverExpenseStats[0]?.totalDriverExpense || 0;
    
    // Total operational expenses (agent + driver)
    const totalExpense = totalAgentExpense + totalDriverExpense;
    
    // ===== Product metrics (inventory + delivered orders) =====
    const products = await Product.find({ createdBy: ownerId })
      .select('_id price purchasePrice baseCurrency stockByCountry stock stockQty')
      .lean()
    const productIds = products.map(p => p._id)
    // Map countries to currencies
    const countryCurrencyMap = {
      'KSA': 'SAR', 'UAE': 'AED', 'Oman': 'OMR', 'Bahrain': 'BHD',
      'India': 'INR', 'Kuwait': 'KWD', 'Qatar': 'QAR'
    }
    
    // Aggregate delivered quantities per product and country with actual order amounts
    // From internal Orders
    const deliveredPerProdCountry = await Order.aggregate([
      { $match: { 
          createdBy: { $in: creatorIds },
          ...dateMatch,
          $and: [
            { $or: [ { shipmentStatus: 'delivered' }, { status: 'done' } ] },
            { $or: [ { productId: { $in: productIds } }, { 'items.productId': { $in: productIds } } ] }
          ]
        } 
      },
      { $project: {
          orderCountry: 1,
          total: 1,
          discount: 1,
          items: { $cond: [ { $and: [ { $isArray: '$items' }, { $gt: [ { $size: '$items' }, 0 ] } ] }, '$items', [ { productId: '$productId', quantity: { $ifNull: ['$quantity', 1] } } ] ] }
        }
      },
      { $unwind: '$items' },
      { $project: {
          orderCountry: { $ifNull: ['$orderCountry', ''] },
          productId: '$items.productId',
          quantity: { $let: { vars: { q: { $ifNull: ['$items.quantity', 1] } }, in: { $cond: [ { $lt: ['$$q', 1] }, 1, '$$q' ] } } },
          orderAmount: { $ifNull: ['$total', 0] },
          discountAmount: { $ifNull: ['$discount', 0] },
          grossAmount: { $ifNull: ['$total', 0] }
        }
      },
      { $match: { productId: { $in: productIds } } },
      { $addFields: {
          orderCountryCanon: {
            $let: {
              vars: { c: { $ifNull: ['$orderCountry', ''] } },
              in: {
                $switch: {
                  branches: [
                    { case: { $in: [ { $toUpper: '$$c' }, ['KSA','SAUDI ARABIA','SA'] ] }, then: 'KSA' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['UAE','UNITED ARAB EMIRATES','AE'] ] }, then: 'UAE' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['OMAN','OM'] ] }, then: 'Oman' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['BAHRAIN','BH'] ] }, then: 'Bahrain' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['INDIA','IN'] ] }, then: 'India' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['KUWAIT','KW'] ] }, then: 'Kuwait' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['QATAR','QA'] ] }, then: 'Qatar' },
                  ],
                  default: '$$c'
                }
              }
            }
          },
          orderCurrency: {
            $ifNull: [
              '$currency',
              {
                $switch: {
                  branches: [
                    { case: { $in: [ { $toUpper: { $ifNull: ['$orderCountry', ''] } }, ['KSA','SAUDI ARABIA'] ] }, then: 'SAR' },
                    { case: { $in: [ { $toUpper: { $ifNull: ['$orderCountry', ''] } }, ['UAE','UNITED ARAB EMIRATES'] ] }, then: 'AED' },
                    { case: { $in: [ { $toUpper: { $ifNull: ['$orderCountry', ''] } }, ['OMAN','OM'] ] }, then: 'OMR' },
                    { case: { $in: [ { $toUpper: { $ifNull: ['$orderCountry', ''] } }, ['BAHRAIN','BH'] ] }, then: 'BHD' },
                    { case: { $in: [ { $toUpper: { $ifNull: ['$orderCountry', ''] } }, ['INDIA','IN'] ] }, then: 'INR' },
                    { case: { $in: [ { $toUpper: { $ifNull: ['$orderCountry', ''] } }, ['KUWAIT','KW'] ] }, then: 'KWD' },
                    { case: { $in: [ { $toUpper: { $ifNull: ['$orderCountry', ''] } }, ['QATAR','QA'] ] }, then: 'QAR' },
                  ],
                  default: 'AED'
                }
              }
            ]
          }
        }
      },
      { $group: { 
          _id: { productId: '$productId', country: '$orderCountryCanon', currency: '$orderCurrency' }, 
          qty: { $sum: '$quantity' },
          totalAmount: { $sum: '$orderAmount' },
          totalDiscount: { $sum: '$discountAmount' },
          totalGross: { $sum: '$grossAmount' }
        } 
      }
    ])
    
    const deliveredMap = new Map()
    const deliveredAmountMap = new Map()
    const deliveredDiscountMap = new Map()
    // Merge internal orders
    for (const r of deliveredPerProdCountry){
      const pid = String(r._id?.productId || '')
      const country = String(r._id?.country || '')
      const currency = String(r._id?.currency || 'AED')
      if (!pid) continue
      if (!deliveredMap.has(pid)) deliveredMap.set(pid, {})
      if (!deliveredAmountMap.has(pid)) deliveredAmountMap.set(pid, {})
      if (!deliveredDiscountMap.has(pid)) deliveredDiscountMap.set(pid, {})
      deliveredMap.get(pid)[country] = (deliveredMap.get(pid)[country] || 0) + Number(r.qty || 0)
      if (!deliveredAmountMap.get(pid)[country]) deliveredAmountMap.get(pid)[country] = {}
      deliveredAmountMap.get(pid)[country][currency] = (deliveredAmountMap.get(pid)[country][currency] || 0) + Number(r.totalAmount || 0)
      if (!deliveredDiscountMap.get(pid)[country]) deliveredDiscountMap.get(pid)[country] = {}
      deliveredDiscountMap.get(pid)[country][currency] = (deliveredDiscountMap.get(pid)[country][currency] || 0) + Number(r.totalDiscount || 0)
    }
    // No web orders merge: metrics derive from Orders collection only
    const KNOWN_COUNTRIES = ['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar']
    const emptyCurrencyMap = () => ({ AED:0, OMR:0, SAR:0, BHD:0, INR:0, KWD:0, QAR:0, USD:0, CNY:0 })
    const productCountryAgg = {}
    for (const c of KNOWN_COUNTRIES){ productCountryAgg[c] = { stockPurchasedQty:0, stockDeliveredQty:0, stockLeftQty:0, purchaseValueByCurrency: emptyCurrencyMap(), totalPurchaseValueByCurrency: emptyCurrencyMap(), deliveredValueByCurrency: emptyCurrencyMap(), discountValueByCurrency: emptyCurrencyMap() } }
    const productGlobal = { stockPurchasedQty:0, stockDeliveredQty:0, stockLeftQty:0, purchaseValueByCurrency: emptyCurrencyMap(), totalPurchaseValueByCurrency: emptyCurrencyMap(), deliveredValueByCurrency: emptyCurrencyMap(), discountValueByCurrency: emptyCurrencyMap() }
    const normalizeCur = (v)=> (['AED','OMR','SAR','BHD','INR','KWD','QAR','USD','CNY'].includes(String(v)) ? String(v) : 'SAR')
    for (const p of products){
      const baseCur = normalizeCur(p.baseCurrency || 'SAR')
      const byC = p.stockByCountry || {}
      const hasStockByCountry = byC && Object.keys(byC).some(k => Number(byC[k] || 0) > 0)
      
      // If no stockByCountry, use total stock/stockQty
      const totalStockFallback = Number(p.stock || p.stockQty || 0)
      
      const leftBy = { KSA: Number(byC.KSA || 0), UAE: Number(byC.UAE || 0), Oman: Number(byC.Oman || 0), Bahrain: Number(byC.Bahrain || 0), India: Number(byC.India || 0), Kuwait: Number(byC.Kuwait || 0), Qatar: Number(byC.Qatar || 0) }
      const delBy = deliveredMap.get(String(p._id)) || {}
      const delAmountBy = deliveredAmountMap.get(String(p._id)) || {}
      const discAmountBy = deliveredDiscountMap.get(String(p._id)) || {}
      let totalLeft = 0, totalDelivered = 0
      
      if (!hasStockByCountry){
        // Product has no stockByCountry, but deliveries are per-country from orders.
        // 1) Global totals
        const delivered = Object.values(delBy).reduce((s,v)=> s + Number(v||0), 0)
        let totalDeliveredAmount = 0
        for (const countryAmounts of Object.values(delAmountBy)){
          if (typeof countryAmounts === 'object'){
            for (const [cur, amt] of Object.entries(countryAmounts)){
              if (productGlobal.deliveredValueByCurrency[cur] !== undefined){
                productGlobal.deliveredValueByCurrency[cur] += Number(amt || 0)
              }
              totalDeliveredAmount += Number(amt || 0)
            }
          }
        }
        const left = totalStockFallback
        const purchased = left + delivered
        totalLeft = left
        totalDelivered = delivered
        productGlobal.stockLeftQty += left
        productGlobal.stockDeliveredQty += delivered
        productGlobal.stockPurchasedQty += purchased
        productGlobal.totalPurchaseValueByCurrency[baseCur] += Number(p.purchasePrice || 0)
        const purchaseValueOfRemaining = purchased > 0 
          ? Number(p.purchasePrice || 0) * (left / purchased)
          : Number(p.purchasePrice || 0)
        productGlobal.purchaseValueByCurrency[baseCur] += purchaseValueOfRemaining
        // 2) Per-country delivered attribution (qty and amounts)
        for (const c of KNOWN_COUNTRIES){
          const dQty = Number(delBy[c] || 0)
          if (dQty > 0){
            productCountryAgg[c].stockDeliveredQty += dQty
          }
          const cAmts = delAmountBy[c] || {}
          if (cAmts && typeof cAmts === 'object'){
            for (const [cur, amt] of Object.entries(cAmts)){
              if (productCountryAgg[c].deliveredValueByCurrency[cur] !== undefined){
                productCountryAgg[c].deliveredValueByCurrency[cur] += Number(amt || 0)
              }
            }
          }
          const cDisc = discAmountBy[c] || {}
          if (cDisc && typeof cDisc === 'object'){
            for (const [cur, amt] of Object.entries(cDisc)){
              if (productCountryAgg[c].discountValueByCurrency[cur] !== undefined){
                productCountryAgg[c].discountValueByCurrency[cur] += Number(amt || 0)
              }
            }
          }
        }
      } else {
        // Product has country breakdown - purchasePrice is per-unit
        for (const c of KNOWN_COUNTRIES){
          const left = Number(leftBy[c] || 0)
          const delivered = Number(delBy[c] || 0)
          const countryAmounts = delAmountBy[c] || {}
          const purchased = left + delivered
          totalLeft += left
          totalDelivered += delivered
          productCountryAgg[c].stockLeftQty += left
          productCountryAgg[c].stockDeliveredQty += delivered
          productCountryAgg[c].stockPurchasedQty += purchased
          // Total purchase price (all stock: remaining + delivered)
          productCountryAgg[c].totalPurchaseValueByCurrency[baseCur] += purchased * Number(p.purchasePrice || 0)
          // Purchase value of REMAINING stock only (left × per-unit price)
          productCountryAgg[c].purchaseValueByCurrency[baseCur] += left * Number(p.purchasePrice || 0)
          // Add amounts by currency
          if (typeof countryAmounts === 'object'){
            for (const [cur, amt] of Object.entries(countryAmounts)){
              if (productCountryAgg[c].deliveredValueByCurrency[cur] !== undefined){
                productCountryAgg[c].deliveredValueByCurrency[cur] += Number(amt || 0)
              }
              if (productGlobal.deliveredValueByCurrency[cur] !== undefined){
                productGlobal.deliveredValueByCurrency[cur] += Number(amt || 0)
              }
            }
          }
          const countryDiscounts = discAmountBy[c] || {}
          if (typeof countryDiscounts === 'object'){
            for (const [cur, amt] of Object.entries(countryDiscounts)){
              if (productCountryAgg[c].discountValueByCurrency[cur] !== undefined){
                productCountryAgg[c].discountValueByCurrency[cur] += Number(amt || 0)
              }
              if (productGlobal.discountValueByCurrency[cur] !== undefined){
                productGlobal.discountValueByCurrency[cur] += Number(amt || 0)
              }
            }
          }
        }
        productGlobal.stockLeftQty += totalLeft
        productGlobal.stockDeliveredQty += totalDelivered
        productGlobal.stockPurchasedQty += (totalLeft + totalDelivered)
        // Total purchase price (all stock: remaining + delivered)
        productGlobal.totalPurchaseValueByCurrency[baseCur] += (totalLeft + totalDelivered) * Number(p.purchasePrice || 0)
        // Purchase value of REMAINING stock only (totalLeft × per-unit price)
        productGlobal.purchaseValueByCurrency[baseCur] += totalLeft * Number(p.purchasePrice || 0)
      }
    }

    // Country-specific metrics from internal Orders (with date filter)
    const countryMetrics = await Order.aggregate([
      { $match: { createdBy: { $in: creatorIds }, ...dateMatch } },
      // Canonicalize orderCountry to unify aliases
      { $addFields: {
        orderCountryCanon: {
          $let: {
            vars: { c: { $ifNull: ['$orderCountry', ''] } },
            in: {
              $switch: {
                branches: [
                  { case: { $in: [ { $toUpper: '$$c' }, ['KSA','SAUDI ARABIA'] ] }, then: 'KSA' },
                  { case: { $in: [ { $toUpper: '$$c' }, ['UAE','UNITED ARAB EMIRATES'] ] }, then: 'UAE' },
                  { case: { $in: [ { $toUpper: '$$c' }, ['OMAN','OM'] ] }, then: 'Oman' },
                  { case: { $in: [ { $toUpper: '$$c' }, ['BAHRAIN','BH'] ] }, then: 'Bahrain' },
                  { case: { $in: [ { $toUpper: '$$c' }, ['INDIA','IN'] ] }, then: 'India' },
                  { case: { $in: [ { $toUpper: '$$c' }, ['KUWAIT','KW'] ] }, then: 'Kuwait' },
                  { case: { $in: [ { $toUpper: '$$c' }, ['QATAR','QA'] ] }, then: 'Qatar' },
                ],
                default: '$$c'
              }
            }
          }
        }
      } },
      { $project: {
          orderCountryCanon: 1,
          shipmentStatus: 1,
          total: { $ifNull: ['$total', 0] },
          discount: { $ifNull: ['$discount', 0] },
          items: { $ifNull: ['$items', []] },
          quantity: { $ifNull: ['$quantity', 1] }
        }
      },
      { $addFields: {
          qty: {
            $cond: [
              { $gt: [ { $size: '$items' }, 0 ] },
              { $sum: { $map: { input: '$items', as: 'it', in: { $cond: [ { $lt: [ { $ifNull: ['$$it.quantity', 1] }, 1 ] }, 1, { $ifNull: ['$$it.quantity', 1] } ] } } } },
              { $cond: [ { $lt: ['$quantity', 1] }, 1, '$quantity' ] }
            ]
          }
        }
      },
      { $group: {
        _id: '$orderCountryCanon',
        // amounts (sum of total only)
        totalSales: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $ifNull: ['$total', 0] }, 0 ] } },
        amountTotalOrders: { $sum: { $ifNull: ['$total', 0] } },
        amountDelivered: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $ifNull: ['$total', 0] }, 0 ] } },
        amountPending: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'pending'] }, { $ifNull: ['$total', 0] }, 0 ] } },
        amountOpen: { $sum: { $cond: [ { $in: ['$shipmentStatus', ['pending','assigned','picked_up','in_transit','out_for_delivery','no_response','attempted','contacted']] }, { $ifNull: ['$total', 0] }, 0 ] } },
        amountDiscountDelivered: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, '$discount', 0 ] } },
        // counts
        totalOrders: { $sum: 1 },
        pendingOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'pending'] }, 1, 0 ] } },
        openOrders: { $sum: { $cond: [ { $in: ['$shipmentStatus', ['pending','assigned','picked_up','in_transit','out_for_delivery','no_response','attempted','contacted']] }, 1, 0 ] } },
        assignedOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'assigned'] }, 1, 0 ] } },
        pickedUpOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'picked_up'] }, 1, 0 ] } },
        inTransitOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'in_transit'] }, 1, 0 ] } },
        outForDeliveryOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'out_for_delivery'] }, 1, 0 ] } },
        deliveredOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, 1, 0 ] } },
        noResponseOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'no_response'] }, 1, 0 ] } },
        returnedOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'returned'] }, 1, 0 ] } },
        cancelledOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'cancelled'] }, 1, 0 ] } },
        deliveredQty: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, '$qty', 0 ] } }
      } }
    ]);
    
    // Removed WebOrder aggregation: dashboard country metrics derive from Orders only

    // Delivered quantity by country (internal Orders): items-aware and not restricted by productIds
    const deliveredQtyByCountryInternal = await Order.aggregate([
      { $match: { createdBy: { $in: creatorIds }, $or: [ { $eq: ['$shipmentStatus','delivered'] }, { $eq: ['$status','done'] } ] } }
    ]).catch(async()=>{
      // Fallback pipeline without $expr in $match for some Mongo versions
      return await Order.aggregate([
        { $match: { createdBy: { $in: creatorIds }, $or: [ { shipmentStatus: 'delivered' }, { status: 'done' } ] } },
        { $addFields: {
          orderCountryCanon: {
            $let: {
              vars: { c: { $ifNull: ['$orderCountry', ''] } },
              in: {
                $switch: {
                  branches: [
                    { case: { $in: [ { $toUpper: '$$c' }, ['KSA','SAUDI ARABIA'] ] }, then: 'KSA' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['UAE','UNITED ARAB EMIRATES'] ] }, then: 'UAE' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['OMAN','OM'] ] }, then: 'Oman' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['BAHRAIN','BH'] ] }, then: 'Bahrain' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['INDIA','IN'] ] }, then: 'India' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['KUWAIT','KW'] ] }, then: 'Kuwait' },
                    { case: { $in: [ { $toUpper: '$$c' }, ['QATAR','QA'] ] }, then: 'Qatar' },
                  ],
                  default: '$$c'
                }
              }
            }
          },
          _items: { $cond: [ { $gt: [ { $size: { $ifNull: ['$items', []] } }, 0 ] }, '$items', [ { quantity: { $ifNull: ['$quantity', 1] } } ] ] }
        } },
        { $unwind: '$_items' },
        { $group: { _id: '$orderCountryCanon', qty: { $sum: { $cond: [ { $lt: [ { $ifNull: ['$_items.quantity', 1] }, 1 ] }, 1, { $ifNull: ['$_items.quantity', 1] } ] } } } }
      ])
    })

    // Removed WebOrder delivered qty aggregation
    
    // Driver expenses by country (based on driver's country)
    const driversByCountry = await User.aggregate([
      { $match: { createdBy: ownerId, role: 'driver' } },
      { $group: { _id: '$country', drivers: { $push: '$_id' } } }
    ]);
    
    const driverExpensesByCountry = {};
    for (const dc of driversByCountry) {
      const country = dc._id;
      const driverIds = dc.drivers;
      const expStats = await Remittance.aggregate([
        { $match: { driver: { $in: driverIds }, status: 'accepted' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      driverExpensesByCountry[country] = expStats[0]?.total || 0;
    }
    
    // Format country metrics (include an 'Other' bucket)
    const countries = {
      KSA: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      Oman: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      UAE: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      Bahrain: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      'Saudi Arabia': { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      India: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      Kuwait: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      Qatar: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      Other: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
    };
    const canon = (name) => name === 'Saudi Arabia' ? 'KSA' : (name === 'United Arab Emirates' ? 'UAE' : name)
    
    // Merge internal orders
    countryMetrics.forEach(cm => {
      const code = cm._id || '';
      const ccode = canon(String(code))
      const key = countries[ccode] ? ccode : 'Other';
      countries[key].sales = (countries[key].sales || 0) + (cm.totalSales || 0);
      countries[key].orders = (countries[key].orders || 0) + (cm.totalOrders || 0);
      countries[key].pickedUp = (countries[key].pickedUp || 0) + (cm.pickedUpOrders || 0);
      countries[key].delivered = (countries[key].delivered || 0) + (cm.deliveredOrders || 0);
      countries[key].transit = (countries[key].transit || 0) + (cm.inTransitOrders || 0);
      // additional status counts (use openOrders for "pending" tile semantics)
      countries[key].pending = (countries[key].pending || 0) + (cm.openOrders || 0);
      countries[key].assigned = (countries[key].assigned || 0) + (cm.assignedOrders || 0);
      countries[key].outForDelivery = (countries[key].outForDelivery || 0) + (cm.outForDeliveryOrders || 0);
      countries[key].noResponse = (countries[key].noResponse || 0) + (cm.noResponseOrders || 0);
      countries[key].returned = (countries[key].returned || 0) + (cm.returnedOrders || 0);
      countries[key].cancelled = (countries[key].cancelled || 0) + (cm.cancelledOrders || 0);
      // amounts by status
      countries[key].amountTotalOrders = (countries[key].amountTotalOrders || 0) + (cm.amountTotalOrders || 0);
      const amtPending = (cm.amountOpen != null ? cm.amountOpen : cm.amountPending) || 0
      countries[key].amountDelivered = (countries[key].amountDelivered || 0) + (cm.amountDelivered || 0);
      countries[key].amountPending = (countries[key].amountPending || 0) + amtPending;
      countries[key].amountDiscountDelivered = (countries[key].amountDiscountDelivered || 0) + (cm.amountDiscountDelivered || 0);
      countries[key].deliveredQty = (countries[key].deliveredQty || 0) + (cm.deliveredQty || 0);
    });
    
    // No web country merge: all country totals come from Orders only

    // Delivered qty per country derived from deliveredMap (owner product scope)
    const deliveredQtyMap = {}
    for (const [_pid, perCountry] of deliveredMap.entries()){
      const pc = perCountry || {}
      for (const [country, qty] of Object.entries(pc)){
        const key = canon(String(country))
        deliveredQtyMap[key] = (deliveredQtyMap[key]||0) + Number(qty||0)
      }
    }
    
    // Set per-country delivered qty from map above; set local amounts directly from aggregated totals
    for (const c of KNOWN_COUNTRIES){
      if (!countries[c]) countries[c] = {}
      const cur = (countryCurrencyMap && countryCurrencyMap[c]) ? countryCurrencyMap[c] : (c==='KSA' ? 'SAR' : c==='UAE' ? 'AED' : c==='Oman' ? 'OMR' : c==='Bahrain' ? 'BHD' : c==='India' ? 'INR' : c==='Kuwait' ? 'KWD' : c==='Qatar' ? 'QAR' : 'AED')
      countries[c].deliveredQty = Number(deliveredQtyMap[c] || countries[c].deliveredQty || 0)
      const amtLocal = Number(countries[c].amountDelivered || 0)
      const discLocal = Number(countries[c].amountDiscountDelivered || 0)
      countries[c].amountDeliveredLocal = amtLocal
      countries[c].amountDiscountLocal = discLocal
      countries[c].amountGrossLocal = amtLocal
    }
    
    // Add driver expenses
    Object.keys(driverExpensesByCountry).forEach(country => {
      if (countries[country]) {
        countries[country].driverExpense = driverExpensesByCountry[country];
      }
    });
    
    // Aggregate status totals across countries (counts)
    const statusTotals = Object.keys(countries).reduce((acc, k) => {
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
    }, { total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 })

    const totalDeposit = orders.totalSales;
    const totalWithdraw = totalExpense;
    const totalRevenue = orders.totalSales - totalExpense; // Net profit
    
    // ===== PROFIT/LOSS CALCULATION =====
    // Profit = Revenue (total) - Purchase Cost - Driver Commission - Agent Commission - Investor Commission
    
    // Get currency configuration - use perAED rates (how much of currency X per 1 AED)
    let perAED = {
      AED: 1,
      SAR: 1,
      QAR: 1,
      BHD: 0.10,
      OMR: 0.10,
      KWD: 0.083,
      USD: 0.27,
      CNY: 1.94,
      INR: 24.16,
      PKR: 76.56
    }
    
    try {
      const currencyDoc = await Setting.findOne({ key: 'currency' }).lean()
      if (currencyDoc?.value?.perAED) {
        // Direct perAED rates
        perAED = { ...perAED, ...currencyDoc.value.perAED }
      } else if (currencyDoc?.value?.sarPerUnit) {
        // Legacy: convert sarPerUnit to perAED
        const sarPerUnit = currencyDoc.value.sarPerUnit
        const sarPerAED = sarPerUnit.AED || 1.02
        for (const [curr, sarRate] of Object.entries(sarPerUnit)) {
          if (curr === 'AED') {
            perAED.AED = 1
          } else if (sarRate > 0) {
            // C per AED = (SAR per AED) / (SAR per C)
            perAED[curr] = sarPerAED / sarRate
          }
        }
        // Add PKR from pkrPerUnit if available
        if (currencyDoc.value.pkrPerUnit?.AED) {
          perAED.PKR = currencyDoc.value.pkrPerUnit.AED
        }
      }
    } catch (e) {
      // Use default rates if fetch fails
    }
    
    // Currency conversion helpers using perAED rates (matching frontend utility)
    // perAED[currency] = how much of that currency per 1 AED
    // Example: perAED.PKR = 76.56 means 1 AED = 76.56 PKR
    
    // Convert any currency to AED
    const toAED = (amount, fromCurrency) => {
      if (fromCurrency === 'AED') return amount
      const rate = perAED[fromCurrency]
      if (!rate || rate === 0) return amount
      // amount in C -> AED = amount / (C per AED)
      return amount / rate
    }
    
    // Convert AED to any currency
    const fromAED = (amountAED, toCurrency) => {
      if (toCurrency === 'AED') return amountAED
      const rate = perAED[toCurrency]
      if (!rate || rate === 0) return amountAED
      // AED -> C = amount * (C per AED)
      return amountAED * rate
    }
    
    // Convert from one currency to another via AED
    const convertCurrency = (amount, fromCurrency, toCurrency) => {
      if (fromCurrency === toCurrency) return amount
      const amountInAED = toAED(amount, fromCurrency)
      return fromAED(amountInAED, toCurrency)
    }
    
    // Get all delivered orders with full details for profit calculation
    // Apply date filter if provided
    const profitQuery = {
      createdBy: { $in: creatorIds },
      shipmentStatus: 'delivered',
      ...dateMatch
    }
    const deliveredOrders = await Order.find(profitQuery)
    .populate('productId', 'purchasePrice baseCurrency')
    .populate('items.productId', 'purchasePrice baseCurrency')
    .populate('deliveryBoy', 'driverProfile')
    .populate('createdBy', 'role')
    .lean()
    
    console.log(`[Profit/Loss] Found ${deliveredOrders.length} delivered orders for profit calculation`, dateMatch.createdAt ? `(filtered by date: ${JSON.stringify(dateMatch.createdAt)})` : '(all time)')
    
    // Log sample of order countries for debugging
    if (deliveredOrders.length > 0) {
      const sampleCountries = deliveredOrders.slice(0, 10).map(o => `"${o.orderCountry}"`).join(', ')
      console.log(`[Profit/Loss] Sample order countries: ${sampleCountries}`)
    }
    
    // Get all investors for this owner with their product assignments
    const investors = await User.find({
      createdBy: ownerId,
      role: 'investor'
    }).select('investorProfile').lean()
    
    // Build investor commission map: productId+country -> profitPerUnit
    const investorCommissionMap = new Map()
    for (const inv of investors) {
      if (inv.investorProfile?.assignedProducts) {
        for (const ap of inv.investorProfile.assignedProducts) {
          const key = `${ap.product}_${ap.country}`
          const existing = investorCommissionMap.get(key) || 0
          investorCommissionMap.set(key, existing + Number(ap.profitPerUnit || 0))
        }
      }
    }
    
    // Helper to canonicalize country names consistently
    const canonicalizeCountry = (country) => {
      const c = String(country || '').trim()
      const upper = c.toUpperCase()
      
      // Handle all variants
      if (upper === 'KSA' || upper === 'SAUDI ARABIA' || upper === 'SA') return 'KSA'
      if (upper === 'UAE' || upper === 'UNITED ARAB EMIRATES' || upper === 'AE') return 'UAE'
      if (upper === 'OMAN' || upper === 'OM') return 'Oman'
      if (upper === 'BAHRAIN' || upper === 'BH') return 'Bahrain'
      if (upper === 'INDIA' || upper === 'IN') return 'India'
      if (upper === 'KUWAIT' || upper === 'KW') return 'Kuwait'
      if (upper === 'QATAR' || upper === 'QA') return 'Qatar'
      
      // Return original if no match
      return c
    }
    
    // Get advertisement expenses (with date filter if provided)
    const adExpenses = await Expense.find({
      createdBy: { $in: creatorIds },
      type: 'advertisement',
      ...dateMatch
    }).lean()
    console.log(`[Profit/Loss] Found ${adExpenses.length} advertisement expenses`, dateMatch.createdAt ? `(filtered by date)` : '(all time)')
    
    // Group ad expenses by country
    const adExpensesByCountry = {}
    for (const c of KNOWN_COUNTRIES) {
      adExpensesByCountry[c] = 0
    }
    
    for (const expense of adExpenses) {
      const expenseCountry = canonicalizeCountry(expense.country || '')
      if (adExpensesByCountry[expenseCountry] !== undefined) {
        // Convert expense amount to country currency if needed
        const countryCurrency = countryCurrencyMap[expenseCountry] || 'AED'
        const expenseCurrency = expense.currency || 'SAR'
        const expenseAmount = Number(expense.amount || 0)
        
        // Convert to country currency
        const convertedAmount = convertCurrency(expenseAmount, expenseCurrency, countryCurrency)
        adExpensesByCountry[expenseCountry] += convertedAmount
      }
    }
    
    console.log('[Profit/Loss] Advertisement expenses by country:', Object.keys(adExpensesByCountry).map(c => `${c}: ${adExpensesByCountry[c].toFixed(2)}`).join(', '))
    
    // Calculate profit/loss globally and by country
    let globalRevenue = 0
    let globalPurchaseCost = 0
    let globalDriverCommission = 0
    let globalAgentCommission = 0
    let globalInvestorCommission = 0
    
    const profitByCountry = {}
    for (const c of KNOWN_COUNTRIES) {
      profitByCountry[c] = {
        revenue: 0,
        purchaseCost: 0,
        driverCommission: 0,
        agentCommission: 0,
        investorCommission: 0,
        advertisementExpense: adExpensesByCountry[c] || 0,
        profit: 0,
        currency: countryCurrencyMap[c] || 'AED'
      }
    }
    
    for (const order of deliveredOrders) {
      const orderCountry = String(order.orderCountry || '')
      const canon = canonicalizeCountry(orderCountry)
      
      // Validate order has essential data
      if (!order._id) {
        console.warn('[Profit/Loss] Order missing _id, skipping')
        continue
      }
      
      const revenue = Number(order.total || 0)
      if (revenue === 0) {
        console.warn(`[Profit/Loss] Order ${order._id} has zero total, country: ${orderCountry}`)
      }
      
      let purchaseCost = 0
      let investorCommission = 0
      const countryCurrency = countryCurrencyMap[canon] || 'AED'
      
      // Calculate purchase cost and investor commission per item
      // Note: Purchase costs are stored in product baseCurrency and need conversion
      if (Array.isArray(order.items) && order.items.length > 0) {
        for (const item of order.items) {
          const prod = item.productId
          if (!prod) {
            console.warn(`[Profit/Loss] Order ${order._id} has item with no product reference`)
            continue
          }
          if (!prod._id) {
            console.warn(`[Profit/Loss] Order ${order._id} has item with unpopulated product`)
            continue
          }
          
          const qty = Math.max(1, Number(item.quantity || 1))
          const productBaseCurrency = prod.baseCurrency || 'SAR'
          const purchasePriceInBaseCurrency = Number(prod.purchasePrice || 0)
          
          if (purchasePriceInBaseCurrency === 0) {
            console.warn(`[Profit/Loss] Product ${prod._id} has zero purchasePrice`)
          }
          
          // Convert purchase price from product's baseCurrency to order country currency
          const purchasePriceConverted = convertCurrency(purchasePriceInBaseCurrency, productBaseCurrency, countryCurrency)
          purchaseCost += purchasePriceConverted * qty
            
          // Investor commission
          const key = `${prod._id}_${canon}`
          const invCommPerUnit = investorCommissionMap.get(key) || 0
          investorCommission += invCommPerUnit * qty
        }
      } else if (order.productId) {
        const prod = order.productId
        if (!prod || !prod._id) {
          console.warn(`[Profit/Loss] Order ${order._id} has unpopulated productId`)
        } else {
          const qty = Math.max(1, Number(order.quantity || 1))
          const productBaseCurrency = prod.baseCurrency || 'SAR'
          const purchasePriceInBaseCurrency = Number(prod.purchasePrice || 0)
          
          if (purchasePriceInBaseCurrency === 0) {
            console.warn(`[Profit/Loss] Product ${prod._id} in order ${order._id} has zero purchasePrice`)
          }
          
          // Convert purchase price from product's baseCurrency to order country currency
          const purchasePriceConverted = convertCurrency(purchasePriceInBaseCurrency, productBaseCurrency, countryCurrency)
          purchaseCost += purchasePriceConverted * qty
          
          // Investor commission
          const key = `${prod._id}_${canon}`
          const invCommPerUnit = investorCommissionMap.get(key) || 0
          investorCommission += invCommPerUnit * qty
        }
      } else {
        console.warn(`[Profit/Loss] Order ${order._id} has neither items nor productId`)
      }
      
      // Driver commission
      const driverCommission = order.deliveryBoy?.driverProfile?.commissionPerOrder ? Number(order.deliveryBoy.driverProfile.commissionPerOrder) : 0
      
      // Agent commission (stored in PKR, needs conversion)
      const agentCommissionPKR = Number(order.agentCommissionPKR || 0)
      
      // Add to global totals (keep PKR for global)
      globalRevenue += revenue
      globalPurchaseCost += purchaseCost
      globalDriverCommission += driverCommission
      globalAgentCommission += agentCommissionPKR
      globalInvestorCommission += investorCommission
      
      // Add to country totals (convert agent commission from PKR to local currency)
      if (profitByCountry[canon]) {
        const countryCurrency = countryCurrencyMap[canon] || 'AED'
        const agentCommissionLocal = convertCurrency(agentCommissionPKR, 'PKR', countryCurrency)
        
        profitByCountry[canon].revenue += revenue
        profitByCountry[canon].purchaseCost += purchaseCost
        profitByCountry[canon].driverCommission += driverCommission
        profitByCountry[canon].agentCommission += agentCommissionLocal
        profitByCountry[canon].investorCommission += investorCommission
      } else {
        // Log unmatched countries for debugging
        console.warn(`[Profit/Loss] Order country '${orderCountry}' (canonicalized to '${canon}') not in KNOWN_COUNTRIES. Order ID: ${order._id}`)
      }
    }
    
    // Log distribution by country for debugging
    console.log('[Profit/Loss] Orders by country:', Object.keys(profitByCountry).map(c => `${c}: revenue=${profitByCountry[c].revenue.toFixed(2)}, purchaseCost=${profitByCountry[c].purchaseCost.toFixed(2)}`).join(', '))
    
    // Calculate profit for each country in local currency (including ad expenses)
    for (const c of KNOWN_COUNTRIES) {
      if (profitByCountry[c]) {
        profitByCountry[c].profit = profitByCountry[c].revenue - profitByCountry[c].purchaseCost - profitByCountry[c].driverCommission - profitByCountry[c].agentCommission - profitByCountry[c].investorCommission - profitByCountry[c].advertisementExpense
      }
    }
    
    // Calculate global profit by converting each country's profit to AED and summing
    let globalProfitFromCountries = 0
    for (const c of KNOWN_COUNTRIES) {
      if (profitByCountry[c]) {
        const countryCurrency = profitByCountry[c].currency || 'AED'
        const profitInAED = toAED(profitByCountry[c].profit, countryCurrency)
        globalProfitFromCountries += profitInAED
      }
    }
    
    // Convert country-wise revenue, costs, commissions to AED for accurate global totals
    let totalRevenueAED = 0
    let totalPurchaseCostAED = 0
    let totalDriverCommAED = 0
    let totalAgentCommAED = 0
    let totalInvestorCommAED = 0
    let totalAdExpenseAED = 0
    
    for (const c of KNOWN_COUNTRIES) {
      if (profitByCountry[c]) {
        const curr = profitByCountry[c].currency || 'AED'
        totalRevenueAED += toAED(profitByCountry[c].revenue, curr)
        totalPurchaseCostAED += toAED(profitByCountry[c].purchaseCost, curr)
        totalDriverCommAED += toAED(profitByCountry[c].driverCommission, curr)
        totalAgentCommAED += toAED(profitByCountry[c].agentCommission, curr)
        totalInvestorCommAED += toAED(profitByCountry[c].investorCommission, curr)
        totalAdExpenseAED += toAED(profitByCountry[c].advertisementExpense, curr)
      }
    }
    
    const globalProfit = globalProfitFromCountries
    
    // Add profit data to country objects
    for (const c of KNOWN_COUNTRIES) {
      if (countries[c]) {
        countries[c].profit = profitByCountry[c].profit
        countries[c].profitDetails = profitByCountry[c]
      }
    }
    
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
      totalDeposit,
      totalWithdraw,
      totalExpense,
      totalAgentExpense,
      totalDriverExpense,
      totalRevenue,
      // Profit/Loss metrics
      profitLoss: {
        profit: globalProfit,
        isProfit: globalProfit >= 0,
        revenue: totalRevenueAED,
        purchaseCost: totalPurchaseCostAED,
        driverCommission: totalDriverCommAED,
        agentCommission: totalAgentCommAED,
        investorCommission: totalInvestorCommAED,
        advertisementExpense: totalAdExpenseAED,
        byCountry: profitByCountry
      },
      countries,
      statusTotals,
      productMetrics: {
        global: productGlobal,
        countries: productCountryAgg
      }
    });
  } catch (error) {
    console.error('Error fetching user metrics:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Sales by country for user dashboard (workspace scoped)
router.get('/user-metrics/sales-by-country', auth, allowRoles('user'), async (req, res) => {
  try {
    const ownerId = req.user.id
    const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
    const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
    const creatorIds = [ownerId, ...agents.map(a => a._id), ...managers.map(m => m._id)]
    
    // Date filtering support
    const dateMatch = {};
    if (req.query.from || req.query.to) {
      dateMatch.createdAt = {};
      if (req.query.from) dateMatch.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) dateMatch.createdAt.$lte = new Date(req.query.to);
      console.log('📅 [SALES-BY-COUNTRY] Date filter applied:', {
        from: req.query.from,
        to: req.query.to
      });
    }
    
    const rows = await Order.aggregate([
      { $match: { createdBy: { $in: creatorIds }, shipmentStatus: 'delivered', ...dateMatch } },
      { $group: { _id: '$orderCountry', sum: { $sum: { $ifNull: ['$total', 0] } } } }
    ])
    const acc = { KSA: 0, Oman: 0, UAE: 0, Bahrain: 0, Other: 0 }
    for (const r of rows){
      const key = String(r._id || '').trim()
      if (acc.hasOwnProperty(key)) acc[key] += Number(r.sum || 0)
      else acc.Other += Number(r.sum || 0)
    }
    res.json(acc)
  } catch (error) {
    console.error('Error fetching sales-by-country:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Manager metrics for dashboard (assigned countries scoped)
router.get('/manager-metrics', auth, allowRoles('manager'), async (req, res) => {
  try {
    const mgr = await User.findById(req.user.id).select('createdBy assignedCountry assignedCountries').lean()
    const ownerId = mgr?.createdBy ? new mongoose.Types.ObjectId(mgr.createdBy) : new mongoose.Types.ObjectId(req.user.id)
    const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
    const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
    const creatorIds = [ownerId, ...agents.map(a => a._id), ...managers.map(m => m._id)]

    const expand = (c)=> (c==='KSA'||c==='Saudi Arabia') ? ['KSA','Saudi Arabia'] : (c==='UAE'||c==='United Arab Emirates') ? ['UAE','United Arab Emirates'] : [c]
    const assignedCountries = Array.isArray(mgr?.assignedCountries) && mgr.assignedCountries.length ? mgr.assignedCountries : (mgr?.assignedCountry ? [mgr.assignedCountry] : [])
    let allowedCountries = null
    if (assignedCountries.length){
      const set = new Set(); for (const c of assignedCountries){ for (const x of expand(c)) set.add(x) }
      allowedCountries = Array.from(set)
    }

    const baseMatch = { createdBy: { $in: creatorIds } }
    if (allowedCountries) baseMatch.orderCountry = { $in: allowedCountries }

    const orderStats = await Order.aggregate([
      { $match: baseMatch },
      { $group: { _id: null,
        totalOrders: { $sum: 1 },
        totalSales: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $ifNull: ['$total', 0] }, 0 ] } },
        totalCOD: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $cond: [ { $eq: ['$paymentMethod', 'COD'] }, { $ifNull: ['$total', 0] }, 0 ] }, 0 ] } },
        totalPrepaid: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $cond: [ { $ne: ['$paymentMethod', 'COD'] }, { $ifNull: ['$total', 0] }, 0 ] }, 0 ] } },
        totalCollected: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $ifNull: ['$collectedAmount', 0] }, 0 ] } },
        pendingOrders: { $sum: { $cond: [ { $eq: ['$status', 'pending'] }, 1, 0 ] } },
        pickedUpOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'picked_up'] }, 1, 0 ] } },
        deliveredOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, 1, 0 ] } },
        cancelledOrders: { $sum: { $cond: [ { $or: [ { $eq: ['$shipmentStatus', 'cancelled'] }, { $eq: ['$status', 'cancelled'] } ] }, 1, 0 ] } },
        totalProductsOrdered: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, '$quantity', 0 ] } },
      } }
    ])
    const orders = orderStats[0] || { totalOrders:0, totalSales:0, totalCOD:0, totalPrepaid:0, totalCollected:0, pendingOrders:0, pickedUpOrders:0, deliveredOrders:0, cancelledOrders:0, totalProductsOrdered:0 }

    const countryMetrics = await Order.aggregate([
      { $match: baseMatch },
      { $group: {
        _id: '$orderCountry',
        // amounts
        totalSales: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $ifNull: ['$total', 0] }, 0 ] } },
        amountTotalOrders: { $sum: { $ifNull: ['$total', 0] } },
        amountDelivered: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, { $ifNull: ['$total', 0] }, 0 ] } },
        amountPending: { $sum: { $cond: [ { $eq: ['$status', 'pending'] }, { $ifNull: ['$total', 0] }, 0 ] } },
        // counts
        totalOrders: { $sum: 1 },
        pendingOrders: { $sum: { $cond: [ { $eq: ['$status', 'pending'] }, 1, 0 ] } },
        pickedUpOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'picked_up'] }, 1, 0 ] } },
        deliveredOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, 1, 0 ] } },
        cancelledOrders: { $sum: { $cond: [ { $eq: ['$status', 'cancelled'] }, 1, 0 ] } },
        outForDeliveryOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'out_for_delivery'] }, 1, 0 ] } },
        noResponseOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'no_response'] }, 1, 0 ] } },
        returnedOrders: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'returned'] }, 1, 0 ] } },
      } }
    ])

    // Format country metrics (restrict to known set; aliases supported via expand above)
    const countries = {
      KSA: { }, Oman: { }, UAE: { }, Bahrain: { }, 'Saudi Arabia': { }, India: { }, Kuwait: { }, Qatar: { },
    }
    countryMetrics.forEach(cm => {
      const country = cm._id || 'Other'
      if (countries[country]){
        countries[country].sales = cm.totalSales || 0
        countries[country].orders = cm.totalOrders || 0
        countries[country].pickedUp = cm.pickedUpOrders || 0
        countries[country].delivered = cm.deliveredOrders || 0
        countries[country].transit = cm.inTransitOrders || 0
        countries[country].pending = cm.pendingOrders || 0
        countries[country].assigned = cm.assignedOrders || 0
        countries[country].outForDelivery = cm.outForDeliveryOrders || 0
        countries[country].noResponse = cm.noResponseOrders || 0
        countries[country].returned = cm.returnedOrders || 0
        countries[country].cancelled = cm.cancelledOrders || 0
        countries[country].amountTotalOrders = cm.amountTotalOrders || 0
        countries[country].amountDelivered = cm.amountDelivered || 0
        countries[country].amountPending = cm.amountPending || 0
      }
    })

    // Aggregate status totals across countries (counts)
    const statusTotals = Object.keys(countries).reduce((acc, k) => {
      const c = countries[k] || {}
      acc.total += Number(c.orders || 0)
      acc.pending += Number(c.pending || 0)
      acc.assigned += Number(c.assigned || 0)
      acc.picked_up += Number(c.pickedUp || 0)
      acc.in_transit += Number(c.transit || 0)
      acc.out_for_delivery += Number(c.outForDelivery || 0)
      acc.delivered += Number(c.delivered || 0)
      acc.no_response += Number(c.noResponse || 0)
      acc.returned += Number(c.returned || 0)
      acc.cancelled += Number(c.cancelled || 0)
      return acc
    }, { total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 })

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
      statusTotals
    })
  } catch (error) {
    console.error('Error fetching manager metrics:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Driver metrics endpoint for Driver Reports
router.get('/driver-metrics', auth, allowRoles('user'), async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    
    // Get all managers created by this owner
    const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1, firstName: 1, lastName: 1, phone: 1 }).lean();
    const managerIds = managers.map(m => m._id);
    
    // Get all drivers created by owner or their managers
    const drivers = await User.find({ 
      role: 'driver', 
      $or: [
        { createdBy: ownerId },
        { createdBy: { $in: managerIds } }
      ]
    }).select('firstName lastName phone country city createdBy driverProfile').lean();
    
    // Aggregate driver statistics
    const driverMetrics = await Promise.all(drivers.map(async (driver) => {
      const driverId = driver._id;
      
      // Get order statistics
      const orderStats = await Order.aggregate([
        { $match: { deliveryBoy: driverId } },
        { $group: {
            _id: null,
            ordersDelivered: { $sum: { $cond: [ { $eq: ['$shipmentStatus', 'delivered'] }, 1, 0 ] } },
            ordersAssigned: { $sum: 1 },
            ordersPending: { $sum: { $cond: [ { $in: ['$shipmentStatus', ['assigned','picked_up','in_transit','out_for_delivery']] }, 1, 0 ] } },
          }
        }
      ]);
      
      // Get settlement information from remittances
      const settlements = await Remittance.find({ 
        driver: driverId 
      }).lean();
      
      let settlementAmount = 0;
      let payToCompany = 0;
      let payToManager = 0;
      let pendingSettlement = 0;
      
      settlements.forEach(remit => {
        const amount = Number(remit.amount || 0);
        settlementAmount += amount;
        
        if (remit.status === 'accepted') {
          payToCompany += amount;
        } else if (remit.status === 'pending') {
          pendingSettlement += amount;
        }
      });
      
      // Find which manager this driver belongs to
      let managerInfo = null;
      if (driver.createdBy && !driver.createdBy.equals(ownerId)) {
        const manager = managers.find(m => m._id.equals(driver.createdBy));
        if (manager) {
          managerInfo = {
            name: `${manager.firstName || ''} ${manager.lastName || ''}`.trim(),
            phone: manager.phone
          };
          payToManager = settlementAmount - payToCompany - pendingSettlement;
        }
      }
      
      const stats = orderStats[0] || { ordersDelivered: 0, ordersAssigned: 0, ordersPending: 0 };
      
      // Map country to currency
      const countryCurrencyMap = {
        'KSA': 'SAR', 'UAE': 'AED', 'Oman': 'OMR', 'Bahrain': 'BHD',
        'India': 'INR', 'Kuwait': 'KWD', 'Qatar': 'QAR'
      };
      
      return {
        id: String(driver._id),
        name: `${driver.firstName || ''} ${driver.lastName || ''}`.trim(),
        phone: driver.phone || 'N/A',
        country: driver.country || 'N/A',
        city: driver.city || 'N/A',
        currency: countryCurrencyMap[driver.country] || 'AED',
        ordersDelivered: stats.ordersDelivered,
        ordersAssigned: stats.ordersAssigned,
        ordersPending: stats.ordersPending,
        settlementAmount,
        payToCompany,
        payToManager,
        pendingSettlement,
        manager: managerInfo,
        commissionPerOrder: driver.driverProfile?.commissionPerOrder || null,
        commissionCurrency: driver.driverProfile?.commissionCurrency || null
      };
    }));
    
    res.json({ drivers: driverMetrics });
  } catch (error) {
    console.error('Error fetching driver metrics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
