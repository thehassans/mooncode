import express from 'express'
import { auth, allowRoles } from '../middleware/auth.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'

const router = express.Router()

// GET /api/warehouse/summary
router.get('/summary', auth, allowRoles('admin','user'), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin'
    const productQuery = isAdmin ? {} : { createdBy: req.user.id }

    const products = await Product.find(productQuery).sort({ name: 1 })
    const productIds = products.map(p => p._id)

    const orderMatch = { shipmentStatus: 'delivered', productId: { $in: productIds } }
    if (!isAdmin) orderMatch.createdBy = req.user.id

    // Aggregate delivered quantities per product and country
    const deliveredAgg = await Order.aggregate([
      { $match: orderMatch },
      { $group: {
          _id: { productId: '$productId', country: '$orderCountry' },
          deliveredQty: { $sum: { $ifNull: ['$quantity', 1] } },
        }
      }
    ])

    const deliveredMap = new Map()
    for (const row of deliveredAgg) {
      const pid = String(row._id.productId)
      const country = row._id.country || 'Unknown'
      if (!deliveredMap.has(pid)) deliveredMap.set(pid, {})
      deliveredMap.get(pid)[country] = row.deliveredQty
    }

    const response = products.map(p => {
      const byC = p.stockByCountry || {}
      const leftUAE = byC.UAE || 0
      const leftOman = byC.Oman || 0
      const leftKSA = byC.KSA || 0
      const leftBahrain = byC.Bahrain || 0
      const leftIndia = byC.India || 0
      const leftKuwait = byC.Kuwait || 0
      const leftQatar = byC.Qatar || 0
      const totalLeft = leftUAE + leftOman + leftKSA + leftBahrain + leftIndia + leftKuwait + leftQatar

      const dMap = deliveredMap.get(String(p._id)) || {}
      const delUAE = dMap.UAE || 0
      const delOman = dMap.Oman || 0
      const delKSA = dMap.KSA || 0
      const delBahrain = dMap.Bahrain || 0
      const delIndia = dMap.India || 0
      const delKuwait = dMap.Kuwait || 0
      const delQatar = dMap.Qatar || 0
      const totalDelivered = delUAE + delOman + delKSA + delBahrain + delIndia + delKuwait + delQatar

      const totalBought = totalLeft + totalDelivered

      const baseCur = ['AED','OMR','SAR','BHD','INR','KWD','QAR'].includes(String(p.baseCurrency)) ? String(p.baseCurrency) : 'SAR'
      const deliveredRevenueByCurrency = { AED: 0, OMR: 0, SAR: 0, BHD: 0, INR: 0, KWD: 0, QAR: 0 }
      const stockValueByCurrency = { AED: 0, OMR: 0, SAR: 0, BHD: 0, INR: 0, KWD: 0, QAR: 0 }
      // Delivered revenue = delivered qty * sell price in base currency of product
      deliveredRevenueByCurrency[baseCur] = totalDelivered * (p.price || 0)
      // Stock value = stock left * buy price in base currency of product
      stockValueByCurrency[baseCur] = totalLeft * (p.purchasePrice || 0)

      return {
        _id: p._id,
        name: p.name,
        price: p.price,
        baseCurrency: baseCur,
        purchasePrice: p.purchasePrice || 0,
        stockLeft: { UAE: leftUAE, Oman: leftOman, KSA: leftKSA, Bahrain: leftBahrain, India: leftIndia, Kuwait: leftKuwait, Qatar: leftQatar, total: totalLeft },
        delivered: { UAE: delUAE, Oman: delOman, KSA: delKSA, Bahrain: delBahrain, India: delIndia, Kuwait: delKuwait, Qatar: delQatar, total: totalDelivered },
        totalBought,
        stockValue: totalLeft * (p.purchasePrice || 0),
        potentialRevenue: totalLeft * (p.price || 0),
        deliveredRevenue: totalDelivered * (p.price || 0),
        deliveredRevenueByCurrency,
        stockValueByCurrency,
        createdAt: p.createdAt,
      }
    })

    res.json({ items: response })
  } catch (err) {
    console.error('warehouse summary error', err)
    res.status(500).json({ message: 'Failed to load summary' })
  }
})

export default router
