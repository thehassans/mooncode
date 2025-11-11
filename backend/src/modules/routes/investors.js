import { Router } from 'express';
import Investment from '../models/Investment.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { auth, allowRoles } from '../middleware/auth.js';
import { getIO } from '../config/socket.js';

const router = Router();

// Get all products available for investment (investor view)
router.get('/products', auth, allowRoles('investor'), async (req, res) => {
  try {
    const investor = await User.findById(req.user.id).select('createdBy');
    if (!investor || !investor.createdBy) {
      return res.status(404).json({ message: 'Investor workspace not found' });
    }

    const ownerId = investor.createdBy;
    
    // Get all products from the owner
    const products = await Product.find({ createdBy: ownerId })
      .select('name price baseCurrency image images description stock stockQty stockByCountry')
      .sort({ createdAt: -1 })
      .lean();

    // Get investor's existing investments to show investment status
    const investments = await Investment.find({ 
      investor: req.user.id, 
      status: 'active' 
    }).select('product amount quantity').lean();

    const investmentMap = new Map(
      investments.map(inv => [String(inv.product), { amount: inv.amount, quantity: inv.quantity }])
    );

    // Enrich products with investment status
    const enrichedProducts = products.map(p => ({
      ...p,
      invested: investmentMap.has(String(p._id)),
      investmentAmount: investmentMap.get(String(p._id))?.amount || 0,
      investmentQuantity: investmentMap.get(String(p._id))?.quantity || 0
    }));

    res.json({ products: enrichedProducts });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Failed to load products' });
  }
});

// Create new investment
router.post('/invest', auth, allowRoles('investor'), async (req, res) => {
  try {
    const { productId, amount, quantity } = req.body;

    if (!productId || !amount || !quantity) {
      return res.status(400).json({ message: 'Product, amount, and quantity are required' });
    }

    const investor = await User.findById(req.user.id).select('createdBy investorProfile');
    if (!investor || !investor.createdBy) {
      return res.status(404).json({ message: 'Investor workspace not found' });
    }

    const ownerId = investor.createdBy;

    // Verify product exists and belongs to owner
    const product = await Product.findOne({ _id: productId, createdBy: ownerId });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if investment already exists
    const existing = await Investment.findOne({
      investor: req.user.id,
      product: productId,
      status: 'active'
    });

    if (existing) {
      // Update existing investment
      existing.amount += Number(amount);
      existing.quantity += Number(quantity);
      await existing.save();

      res.json({ 
        message: 'Investment updated successfully', 
        investment: existing 
      });
    } else {
      // Create new investment
      const investment = new Investment({
        investor: req.user.id,
        product: productId,
        owner: ownerId,
        amount: Number(amount),
        quantity: Number(quantity),
        currency: investor.investorProfile?.currency || 'SAR'
      });

      await investment.save();

      // Emit socket event
      try {
        const io = getIO();
        io.to(`user:${String(req.user.id)}`).emit('investment.created', { 
          investmentId: String(investment._id) 
        });
      } catch (e) {}

      res.status(201).json({ 
        message: 'Investment created successfully', 
        investment 
      });
    }
  } catch (err) {
    console.error('Error creating investment:', err);
    res.status(500).json({ message: 'Failed to create investment' });
  }
});

// Get investor's investments
router.get('/my-investments', auth, allowRoles('investor'), async (req, res) => {
  try {
    const investments = await Investment.find({ 
      investor: req.user.id,
      status: 'active'
    })
      .populate('product', 'name price baseCurrency image stock stockQty')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate metrics for each investment
    const enrichedInvestments = await Promise.all(
      investments.map(async (inv) => {
        if (!inv.product) return { ...inv, unitsSold: 0, totalRevenue: 0, totalProfit: 0 };

        // Get orders for this product
        const orders = await Order.find({
          productId: inv.product._id,
          shipmentStatus: 'delivered'
        }).select('quantity total').lean();

        const unitsSold = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
        const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

        // Calculate profit: (totalRevenue / totalUnits) * investedQuantity - investmentAmount
        const avgPricePerUnit = unitsSold > 0 ? totalRevenue / unitsSold : inv.product.price;
        const revenueFromInvestment = avgPricePerUnit * inv.quantity;
        const totalProfit = Math.max(0, revenueFromInvestment - inv.amount);

        return {
          ...inv,
          unitsSold,
          totalRevenue: revenueFromInvestment,
          totalProfit,
          roi: inv.amount > 0 ? ((totalProfit / inv.amount) * 100).toFixed(2) : 0
        };
      })
    );

    res.json({ investments: enrichedInvestments });
  } catch (err) {
    console.error('Error fetching investments:', err);
    res.status(500).json({ message: 'Failed to load investments' });
  }
});

// Get investment dashboard stats
router.get('/dashboard', auth, allowRoles('investor'), async (req, res) => {
  try {
    const investments = await Investment.find({ 
      investor: req.user.id,
      status: 'active'
    })
      .populate('product', 'name price baseCurrency')
      .lean();

    const totalInvested = investments.reduce((sum, inv) => sum + inv.amount, 0);
    const totalQuantity = investments.reduce((sum, inv) => sum + inv.quantity, 0);

    // Calculate total profit from all investments
    let totalProfit = 0;
    let totalRevenue = 0;

    for (const inv of investments) {
      if (!inv.product) continue;

      const orders = await Order.find({
        productId: inv.product._id,
        shipmentStatus: 'delivered'
      }).select('quantity total').lean();

      const unitsSold = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
      const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

      const avgPricePerUnit = unitsSold > 0 ? revenue / unitsSold : inv.product.price;
      const revenueFromInvestment = avgPricePerUnit * inv.quantity;
      const profit = Math.max(0, revenueFromInvestment - inv.amount);

      totalProfit += profit;
      totalRevenue += revenueFromInvestment;
    }

    const roi = totalInvested > 0 ? ((totalProfit / totalInvested) * 100).toFixed(2) : 0;

    res.json({
      totalInvested,
      totalQuantity,
      totalProfit,
      totalRevenue,
      roi,
      activeInvestments: investments.length,
      currency: investments[0]?.currency || 'SAR'
    });
  } catch (err) {
    console.error('Error fetching dashboard:', err);
    res.status(500).json({ message: 'Failed to load dashboard' });
  }
});

// Withdraw investment
router.post('/withdraw/:id', auth, allowRoles('investor'), async (req, res) => {
  try {
    const { id } = req.params;

    const investment = await Investment.findOne({ 
      _id: id, 
      investor: req.user.id 
    });

    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    investment.status = 'withdrawn';
    await investment.save();

    try {
      const io = getIO();
      io.to(`user:${String(req.user.id)}`).emit('investment.withdrawn', { 
        investmentId: String(investment._id) 
      });
    } catch (e) {}

    res.json({ message: 'Investment withdrawn successfully' });
  } catch (err) {
    console.error('Error withdrawing investment:', err);
    res.status(500).json({ message: 'Failed to withdraw investment' });
  }
});

export default router;
