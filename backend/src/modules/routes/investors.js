import { Router } from 'express';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import InvestorPlan from '../models/InvestorPlan.js';
import { auth, allowRoles } from '../middleware/auth.js';
import { getIO } from '../config/socket.js';

const router = Router();

// Get all products (catalog view only - no investment)
router.get('/products', auth, allowRoles('investor'), async (req, res) => {
  try {
    const investor = await User.findById(req.user.id).select('createdBy');
    if (!investor || !investor.createdBy) {
      return res.status(404).json({ message: 'Investor workspace not found' });
    }

    const ownerId = investor.createdBy;
    
    // Get all products from the owner
    const products = await Product.find({ createdBy: ownerId })
      .select('name price baseCurrency image images description')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ products });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Failed to load products' });
  }
});

// Get investor plans (3 packages) for this investor's workspace
router.get('/plans', auth, allowRoles('investor'), async (req, res) => {
  try {
    const investor = await User.findById(req.user.id).select('createdBy').lean();
    const ownerId = investor?.createdBy;
    if (!ownerId) return res.json({ packages: [
      { index: 1, name: 'Products Package 1', price: 0, profitPercentage: 0 },
      { index: 2, name: 'Products Package 2', price: 0, profitPercentage: 0 },
      { index: 3, name: 'Products Package 3', price: 0, profitPercentage: 0 },
    ]});

    const doc = await InvestorPlan.findOne({ owner: ownerId }).lean();
    const defaults = [
      { index: 1, name: 'Products Package 1', price: 0, profitPercentage: 0 },
      { index: 2, name: 'Products Package 2', price: 0, profitPercentage: 0 },
      { index: 3, name: 'Products Package 3', price: 0, profitPercentage: 0 },
    ];
    if (!doc) return res.json({ packages: defaults });
    const map = new Map((doc.packages||[]).map(p => [p.index, p]));
    const merged = defaults.map(d => ({ ...d, ...(map.get(d.index)||{}) }));
    return res.json({ packages: merged });
  } catch (err) {
    console.error('Error fetching investor plans:', err);
    return res.status(500).json({ message: 'Failed to load plans' });
  }
});

// Get investor's orders (orders that contributed profit to this investor)
router.get('/my-orders', auth, allowRoles('investor'), async (req, res) => {
  try {
    // Find all orders where this investor received profit
    const orders = await Order.find({
      'investorProfit.investor': req.user.id
    })
      .select('invoiceNumber customerName total deliveredAt createdAt investorProfit')
      .sort({ deliveredAt: -1 })
      .lean();

    res.json({ orders });
  } catch (err) {
    console.error('Error fetching investor orders:', err);
    res.status(500).json({ message: 'Failed to load orders' });
  }
});

export default router;
