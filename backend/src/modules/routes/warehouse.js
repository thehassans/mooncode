import express from 'express'
import { auth, allowRoles } from '../middleware/auth.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import WebOrder from '../models/WebOrder.js'
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

    // Aggregate delivered quantities per product and country, supporting both single-product orders and multi-item orders
    const baseMatch = { $or: [ { shipmentStatus: 'delivered' }, { status: 'done' } ] }

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
          },
          _itemsNorm: {
            $map: {
              input: '$._items',
              as: 'it',
              in: {
                productId: '$$it.productId',
                q: { $cond: [ { $lt: [ { $ifNull: ['$$it.quantity', 1] }, 1 ] }, 1, { $ifNull: ['$$it.quantity', 1] } ] }
              }
            }
          },
          matchedItems: { $filter: { input: '$._itemsNorm', as: 'it', cond: { $in: ['$$it.productId', productIds] } } },
          matchedQtyTotal: { $sum: { $map: { input: '$matchedItems', as: 'mi', in: '$$mi.q' } } }
        } 
      },
      { $unwind: '$matchedItems' },
      { $project: {
          productId: '$matchedItems.productId',
          orderCountry: { $ifNull: ['$orderCountry', ''] },
          quantity: '$matchedItems.q',
          orderAmount: { $subtract: [ { $ifNull: ['$total', 0] }, { $ifNull: ['$discount', 0] } ] },
          discountAmount: { $ifNull: ['$discount', 0] },
          grossAmount: { $ifNull: ['$total', 0] },
          matchedQtyTotal: { $ifNull: ['$matchedQtyTotal', 0] }
        }
      },
      { $addFields: {
          allocFactor: { $cond: [ { $gt: ['$matchedQtyTotal', 0] }, { $divide: ['$quantity', '$matchedQtyTotal'] }, 0 ] },
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
          totalAmount: { $sum: { $multiply: ['$orderAmount', '$allocFactor'] } },
          totalDiscount: { $sum: { $multiply: ['$discountAmount', '$allocFactor'] } },
          totalGross: { $sum: { $multiply: ['$grossAmount', '$allocFactor'] } }
        }
      },
    ])

    // Web (E-commerce) Orders: delivered quantities and amounts
    const webDeliveredAgg = await WebOrder.aggregate([
      { $match: { $or: [ { shipmentStatus: 'delivered' }, { status: 'done' } ] } },
      { $addFields: {
          itemsNorm: { $map: { input: { $ifNull: ['$items', []] }, as: 'it', in: { productId: '$$it.productId', q: { $cond: [ { $lt: [ { $ifNull: ['$$it.quantity', 1] }, 1 ] }, 1, { $ifNull: ['$$it.quantity', 1] } ] } } } },
          matchedItems: { $filter: { input: { $ifNull: ['$itemsNorm', []] }, as: 'mi', cond: { $in: ['$$mi.productId', productIds] } } },
          matchedQtyTotal: { $sum: { $map: { input: { $ifNull: ['$matchedItems', []] }, as: 'x', in: '$$x.q' } } }
        }
      },
      { $unwind: '$matchedItems' },
      { $project: {
          productId: '$matchedItems.productId',
          orderCountry: { $ifNull: ['$orderCountry', ''] },
          quantity: '$matchedItems.q',
          orderAmount: { $subtract: [ { $ifNull: ['$total', 0] }, { $ifNull: ['$discount', 0] } ] },
          currency: { $ifNull: ['$currency', null] },
          discountAmount: { $ifNull: ['$discount', 0] },
          grossAmount: { $ifNull: ['$total', 0] },
          matchedQtyTotal: { $ifNull: ['$matchedQtyTotal', 0] }
        }
      },
      { $addFields: {
          allocFactor: { $cond: [ { $gt: ['$matchedQtyTotal', 0] }, { $divide: ['$quantity', '$matchedQtyTotal'] }, 0 ] },
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
          totalAmount: { $sum: { $multiply: ['$orderAmount', '$allocFactor'] } },
          totalDiscount: { $sum: { $multiply: ['$discountAmount', '$allocFactor'] } },
          totalGross: { $sum: { $multiply: ['$grossAmount', '$allocFactor'] } }
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
    for (const row of webDeliveredAgg) {
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

    const response = products.map(p => {
      // Current left per country comes directly from product.stockByCountry
      const byC = p.stockByCountry || {}
      let leftUAE = Math.max(0, Number(byC.UAE || 0))
      let leftOman = Math.max(0, Number(byC.Oman || 0))
      let leftKSA = Math.max(0, Number(byC.KSA || 0))
      let leftBahrain = Math.max(0, Number(byC.Bahrain || 0))
      let leftIndia = Math.max(0, Number(byC.India || 0))
      let leftKuwait = Math.max(0, Number(byC.Kuwait || 0))
      let leftQatar = Math.max(0, Number(byC.Qatar || 0))

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
      // Purchased per country is left + delivered
      const bUAE = leftUAE + delUAE
      const bOman = leftOman + delOman
      const bKSA = leftKSA + delKSA
      const bBahrain = leftBahrain + delBahrain
      const bIndia = leftIndia + delIndia
      const bKuwait = leftKuwait + delKuwait
      const bQatar = leftQatar + delQatar
      const totalBought = bUAE + bOman + bKSA + bBahrain + bIndia + bKuwait + bQatar

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
