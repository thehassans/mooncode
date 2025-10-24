import express from 'express'
import { auth, allowRoles } from '../middleware/auth.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
// WebOrder intentionally not used; warehouse metrics derive from Orders only
import User from '../models/User.js'
import mongoose from 'mongoose'

const router = express.Router()

// GET /api/warehouse/summary
router.get('/summary', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin'
    let productQuery = {}
    if (isAdmin) {
      productQuery = {}
    } else if (req.user.role === 'user') {
      productQuery = { createdBy: req.user.id }
    } else if (req.user.role === 'manager') {
      try {
        const mgrOwner = await User.findById(req.user.id).select('createdBy').lean()
        const ownerId = String(mgrOwner?.createdBy || '')
        productQuery = ownerId ? { createdBy: ownerId } : { createdBy: req.user.id }
      } catch {
        productQuery = { createdBy: req.user.id }
      }
    } else {
      productQuery = { createdBy: req.user.id }
    }

    const products = await Product.find(productQuery).sort({ name: 1 })
    const productIds = products.map(p => p._id)

    // Workspace scoping for Orders: include owner + agents/managers; capture manager's assigned countries
    let createdByScope = null
    let managerAssigned = []
    if (!isAdmin){
      if (req.user.role === 'user'){
        const agents = await User.find({ role: 'agent', createdBy: req.user.id }, { _id: 1 }).lean()
        const managers = await User.find({ role: 'manager', createdBy: req.user.id }, { _id: 1 }).lean()
        createdByScope = [ req.user.id, ...agents.map(a=>String(a._id)), ...managers.map(m=>String(m._id)) ]
      } else if (req.user.role === 'manager') {
        const mgr = await User.findById(req.user.id).select('createdBy assignedCountry assignedCountries').lean()
        const ownerId = String(mgr?.createdBy || '')
        const normalize = (c)=> c==='Saudi Arabia' ? 'KSA' : (c==='United Arab Emirates' ? 'UAE' : c)
        managerAssigned = Array.isArray(mgr?.assignedCountries) && mgr.assignedCountries.length ? mgr.assignedCountries.map(normalize) : (mgr?.assignedCountry ? [normalize(String(mgr.assignedCountry))] : [])
        if (ownerId){
          const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
          const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
          createdByScope = [ ownerId, ...agents.map(a=>String(a._id)), ...managers.map(m=>String(m._id)) ]
        } else {
          createdByScope = [ req.user.id ]
        }
      } else {
        // agent
        createdByScope = [ req.user.id ]
      }
    }

    // Aggregate ALL active orders to calculate reserved stock
    // Include cancelled/returned orders that are NOT yet verified (pending approval)
    const activeOrdersAgg = await Order.aggregate([
      { $match: { 
          $and: [
            {
              $or: [
                { shipmentStatus: { $nin: ['cancelled', 'returned'] } },
                { shipmentStatus: { $in: ['cancelled', 'returned'] }, returnVerified: { $ne: true } }
              ]
            },
            {
              $or: [
                { productId: { $in: productIds } },
                { 'items.productId': { $in: productIds } },
              ]
            }
          ],
          ...(createdByScope ? { createdBy: { $in: createdByScope.map(id => new mongoose.Types.ObjectId(id)) } } : {})
        } 
      },
      { $addFields: {
          _items: {
            $cond: [
              { $gt: [ { $size: { $ifNull: ['$items', []] } }, 0 ] },
              '$items',
              [ { productId: '$productId', quantity: { $ifNull: ['$quantity', 1] } } ]
            ]
          }
        } 
      },
      { $unwind: '$_items' },
      { $match: { '_items.productId': { $in: productIds } } },
      { $project: {
          productId: '$_items.productId',
          orderCountry: { $ifNull: ['$orderCountry', ''] },
          quantity: { $ifNull: ['$_items.quantity', 1] }
        }
      },
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
        }
      },
      { $group: {
          _id: { productId: '$productId', country: '$orderCountryCanon' },
          totalOrders: { $sum: { $ifNull: ['$quantity', 1] } }
        }
      }
    ])

    const activeOrdersMap = new Map()
    for (const row of activeOrdersAgg) {
      const pid = String(row._id.productId)
      const country = String(row._id.country || '').trim()
      if (!activeOrdersMap.has(pid)) activeOrdersMap.set(pid, {})
      const normCountry = country === 'UNITED ARAB EMIRATES' || country === 'AE' ? 'UAE' : 
                          country === 'SAUDI ARABIA' || country === 'SA' ? 'KSA' : 
                          country === 'OMAN' || country === 'OM' ? 'Oman' :
                          country === 'BAHRAIN' || country === 'BH' ? 'Bahrain' :
                          country === 'INDIA' || country === 'IN' ? 'India' :
                          country === 'KUWAIT' || country === 'KW' ? 'Kuwait' :
                          country === 'QATAR' || country === 'QA' ? 'Qatar' : country
      activeOrdersMap.get(pid)[normCountry] = (activeOrdersMap.get(pid)[normCountry] || 0) + Number(row.totalOrders || 0)
    }

    // Aggregate delivered quantities per product and country, supporting both single-product orders and multi-item orders
    const baseMatch = { shipmentStatus: 'delivered' }

    // Internal Orders: delivered quantities and amounts
    const deliveredAgg = await Order.aggregate([
      { $match: { 
          ...baseMatch,
          ...(createdByScope ? { createdBy: { $in: createdByScope.map(id => new mongoose.Types.ObjectId(id)) } } : {}),
          $or: [
            { productId: { $in: productIds } },
            { 'items.productId': { $in: productIds } },
          ]
        } 
      },
      { $addFields: {
          _items: {
            $cond: [
              { $gt: [ { $size: { $ifNull: ['$items', []] } }, 0 ] },
              '$items',
              [ { productId: '$productId', quantity: { $ifNull: ['$quantity', 1] } } ]
            ]
          }
        } 
      },
      { $unwind: '$_items' },
      { $match: { '_items.productId': { $in: productIds } } },
      { $project: {
          productId: '$_items.productId',
          orderCountry: { $ifNull: ['$orderCountry', ''] },
          quantity: { $ifNull: ['$_items.quantity', 1] },
          orderAmount: { $ifNull: ['$total', 0] },
          discountAmount: { $ifNull: ['$discount', 0] },
          grossAmount: { $ifNull: ['$total', 0] }
        }
      },
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
          deliveredQty: { $sum: { $ifNull: ['$quantity', 1] } },
          totalAmount: { $sum: '$orderAmount' },
          totalDiscount: { $sum: '$discountAmount' },
          totalGross: { $sum: '$grossAmount' }
        }
      },
    ])


    const deliveredMap = new Map()
    const deliveredAmountMap = new Map()
    const deliveredDiscountMap = new Map()
    const normCountry = (c)=>{
      const s = String(c||'').trim()
      if (!s) return 'Unknown'
      const upper = s.toUpperCase()
      if (upper === 'UNITED ARAB EMIRATES' || upper === 'AE') return 'UAE'
      if (upper === 'SAUDI ARABIA' || upper === 'SA') return 'KSA'
      // Keep canonical names for known keys
      if (upper === 'UAE') return 'UAE'
      if (upper === 'KSA') return 'KSA'
      if (upper === 'OMAN') return 'Oman'
      if (upper === 'BAHRAIN') return 'Bahrain'
      if (upper === 'INDIA') return 'India'
      if (upper === 'KUWAIT') return 'Kuwait'
      if (upper === 'QATAR') return 'Qatar'
      return s
    }
    for (const row of deliveredAgg) {
      const pid = String(row._id.productId)
      const country = normCountry(row._id.country)
      const currency = String(row._id.currency || 'AED')
      if (!deliveredMap.has(pid)) deliveredMap.set(pid, {})
      if (!deliveredAmountMap.has(pid)) deliveredAmountMap.set(pid, {})
      if (!deliveredDiscountMap.has(pid)) deliveredDiscountMap.set(pid, {})
      deliveredMap.get(pid)[country] = (deliveredMap.get(pid)[country] || 0) + Number(row.deliveredQty || 0)
      if (!deliveredAmountMap.get(pid)[country]) deliveredAmountMap.get(pid)[country] = {}
      deliveredAmountMap.get(pid)[country][currency] = (deliveredAmountMap.get(pid)[country][currency] || 0) + Number(row.totalAmount || 0)
      if (!deliveredDiscountMap.get(pid)[country]) deliveredDiscountMap.get(pid)[country] = {}
      deliveredDiscountMap.get(pid)[country][currency] = (deliveredDiscountMap.get(pid)[country][currency] || 0) + Number(row.totalDiscount || 0)
    }
    // No web aggregation: delivered maps are built from Orders only

    const response = products.map(p => {
      // Calculate total purchased from database
      let totalBought = p.totalPurchased || 0
      if (totalBought === 0) {
        if (Array.isArray(p.stockHistory) && p.stockHistory.length > 0) {
          totalBought = p.stockHistory.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0)
        } else {
          // Fallback: use current stockQty
          totalBought = Number(p.stockQty || 0)
        }
      }
      
      // Get stockHistory by country to determine initial stock distribution
      const stockHistoryByCountry = {}
      if (Array.isArray(p.stockHistory) && p.stockHistory.length > 0) {
        for (const entry of p.stockHistory) {
          const country = String(entry.country || '').trim()
          const normCountry = country === 'United Arab Emirates' || country === 'AE' ? 'UAE' : 
                             country === 'Saudi Arabia' || country === 'SA' ? 'KSA' : country
          stockHistoryByCountry[normCountry] = (stockHistoryByCountry[normCountry] || 0) + Number(entry.quantity || 0)
        }
      } else {
        // Fallback: use current stockByCountry distribution
        const byC = p.stockByCountry || {}
        stockHistoryByCountry.UAE = Number(byC.UAE || 0)
        stockHistoryByCountry.Oman = Number(byC.Oman || 0)
        stockHistoryByCountry.KSA = Number(byC.KSA || 0)
        stockHistoryByCountry.Bahrain = Number(byC.Bahrain || 0)
        stockHistoryByCountry.India = Number(byC.India || 0)
        stockHistoryByCountry.Kuwait = Number(byC.Kuwait || 0)
        stockHistoryByCountry.Qatar = Number(byC.Qatar || 0)
      }
      
      // Get active orders for this product
      const activeOrders = activeOrdersMap.get(String(p._id)) || {}
      
      // Calculate available stock = initial stock - active orders
      let leftUAE = Math.max(0, (stockHistoryByCountry.UAE || 0) - (activeOrders.UAE || 0))
      let leftOman = Math.max(0, (stockHistoryByCountry.Oman || 0) - (activeOrders.Oman || 0))
      let leftKSA = Math.max(0, (stockHistoryByCountry.KSA || 0) - (activeOrders.KSA || 0))
      let leftBahrain = Math.max(0, (stockHistoryByCountry.Bahrain || 0) - (activeOrders.Bahrain || 0))
      let leftIndia = Math.max(0, (stockHistoryByCountry.India || 0) - (activeOrders.India || 0))
      let leftKuwait = Math.max(0, (stockHistoryByCountry.Kuwait || 0) - (activeOrders.Kuwait || 0))
      let leftQatar = Math.max(0, (stockHistoryByCountry.Qatar || 0) - (activeOrders.Qatar || 0))

      const dMap = deliveredMap.get(String(p._id)) || {}
      let delUAE = Number(dMap.UAE || 0)
      let delOman = Number(dMap.Oman || 0)
      let delKSA = Number(dMap.KSA || 0)
      let delBahrain = Number(dMap.Bahrain || 0)
      let delIndia = Number(dMap.India || 0)
      let delKuwait = Number(dMap.Kuwait || 0)
      let delQatar = Number(dMap.Qatar || 0)

      // If manager with assigned countries, zero-out disallowed countries
      if (Array.isArray(managerAssigned) && managerAssigned.length){
        const allow = new Set(managerAssigned)
        if (!allow.has('UAE')) { leftUAE = 0; delUAE = 0 }
        if (!allow.has('Oman')) { leftOman = 0; delOman = 0 }
        if (!allow.has('KSA')) { leftKSA = 0; delKSA = 0 }
        if (!allow.has('Bahrain')) { leftBahrain = 0; delBahrain = 0 }
        if (!allow.has('India')) { leftIndia = 0; delIndia = 0 }
        if (!allow.has('Kuwait')) { leftKuwait = 0; delKuwait = 0 }
        if (!allow.has('Qatar')) { leftQatar = 0; delQatar = 0 }
      }

      const totalDelivered = delUAE + delOman + delKSA + delBahrain + delIndia + delKuwait + delQatar
      const totalLeft = leftUAE + leftOman + leftKSA + leftBahrain + leftIndia + leftKuwait + leftQatar
      
      // Bought per country: initial stock from history
      const bUAE = stockHistoryByCountry.UAE || 0
      const bOman = stockHistoryByCountry.Oman || 0
      const bKSA = stockHistoryByCountry.KSA || 0
      const bBahrain = stockHistoryByCountry.Bahrain || 0
      const bIndia = stockHistoryByCountry.India || 0
      const bKuwait = stockHistoryByCountry.Kuwait || 0
      const bQatar = stockHistoryByCountry.Qatar || 0

      const baseCur = ['AED','OMR','SAR','BHD','INR','KWD','QAR'].includes(String(p.baseCurrency)) ? String(p.baseCurrency) : 'SAR'
      const deliveredRevenueByCurrency = { AED: 0, OMR: 0, SAR: 0, BHD: 0, INR: 0, KWD: 0, QAR: 0 }
      const stockValueByCurrency = { AED: 0, OMR: 0, SAR: 0, BHD: 0, INR: 0, KWD: 0, QAR: 0 }
      // Delivered revenue = actual order amounts by currency
      const amtByCountry = deliveredAmountMap.get(String(p._id)) || {}
      const discByCountry = deliveredDiscountMap.get(String(p._id)) || {}
      for (const c of Object.keys(amtByCountry)){
        const byCur = amtByCountry[c] || {}
        for (const [cur, amt] of Object.entries(byCur)){
          if (deliveredRevenueByCurrency[cur] !== undefined){ deliveredRevenueByCurrency[cur] += Number(amt||0) }
        }
      }
      // Stock value: proportional for in-house total batch price; for stockByCountry assume per-unit price
      const purchase = Number(p.purchasePrice||0)
      if (totalBought > 0){
        const share = totalLeft / totalBought
        stockValueByCurrency[baseCur] = purchase * share
      }

      return {
        _id: p._id,
        name: p.name,
        price: p.price,
        baseCurrency: baseCur,
        purchasePrice: p.purchasePrice || 0,
        stockLeft: { UAE: leftUAE, Oman: leftOman, KSA: leftKSA, Bahrain: leftBahrain, India: leftIndia, Kuwait: leftKuwait, Qatar: leftQatar, total: totalLeft },
        boughtByCountry: { UAE: bUAE, Oman: bOman, KSA: bKSA, Bahrain: bBahrain, India: bIndia, Kuwait: bKuwait, Qatar: bQatar },
        delivered: { UAE: delUAE, Oman: delOman, KSA: delKSA, Bahrain: delBahrain, India: delIndia, Kuwait: delKuwait, Qatar: delQatar, total: totalDelivered },
        totalBought,
        stockValue: stockValueByCurrency[baseCur],
        potentialRevenue: totalLeft * (p.price || 0),
        deliveredRevenue: Object.values(deliveredRevenueByCurrency).reduce((s,v)=> s + Number(v||0), 0),
        deliveredRevenueByCurrency,
        deliveredAmountByCountryAndCurrency: amtByCountry,
        discountAmountByCountryAndCurrency: discByCountry,
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
