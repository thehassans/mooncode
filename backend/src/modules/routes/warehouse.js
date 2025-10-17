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
          }
        } 
      },
      { $unwind: '$_items' },
      { $match: { '_items.productId': { $in: productIds } } },
      { $project: {
          productId: '$_items.productId',
          orderCountry: { $ifNull: ['$orderCountry', ''] },
          quantity: { $ifNull: ['$_items.quantity', 1] },
          orderAmount: { $subtract: [ { $ifNull: ['$total', 0] }, { $ifNull: ['$discount', 0] } ] }
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
        }
      },
      { $group: {
          _id: { productId: '$productId', country: '$orderCountryCanon', currency: '$orderCurrency' },
          deliveredQty: { $sum: { $ifNull: ['$quantity', 1] } },
          totalAmount: { $sum: '$orderAmount' }
        }
      },
    ])

    // Web (E-commerce) Orders: delivered quantities and amounts
    const webDeliveredAgg = await WebOrder.aggregate([
      { $match: { $or: [ { shipmentStatus: 'delivered' }, { status: 'done' } ] } },
      { $unwind: '$items' },
      { $match: { 'items.productId': { $in: productIds } } },
      { $project: {
          productId: '$items.productId',
          orderCountry: { $ifNull: ['$orderCountry', ''] },
          quantity: { $ifNull: ['$items.quantity', 1] },
          orderAmount: { $subtract: [ { $ifNull: ['$total', 0] }, { $ifNull: ['$discount', 0] } ] }
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
        }
      },
      { $group: {
          _id: { productId: '$productId', country: '$orderCountryCanon', currency: '$orderCurrency' },
          deliveredQty: { $sum: { $ifNull: ['$quantity', 1] } },
          totalAmount: { $sum: '$orderAmount' }
        }
      },
    ])

    const deliveredMap = new Map()
    const deliveredAmountMap = new Map() // pid -> { country: { currency: amount } }
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
      deliveredMap.get(pid)[country] = (deliveredMap.get(pid)[country] || 0) + Number(row.deliveredQty || 0)
      if (!deliveredAmountMap.get(pid)[country]) deliveredAmountMap.get(pid)[country] = {}
      deliveredAmountMap.get(pid)[country][currency] = (deliveredAmountMap.get(pid)[country][currency] || 0) + Number(row.totalAmount || 0)
    }
    for (const row of webDeliveredAgg) {
      const pid = String(row._id.productId)
      const country = normCountry(row._id.country)
      const currency = String(row._id.currency || 'AED')
      if (!deliveredMap.has(pid)) deliveredMap.set(pid, {})
      if (!deliveredAmountMap.has(pid)) deliveredAmountMap.set(pid, {})
      deliveredMap.get(pid)[country] = (deliveredMap.get(pid)[country] || 0) + Number(row.deliveredQty || 0)
      if (!deliveredAmountMap.get(pid)[country]) deliveredAmountMap.get(pid)[country] = {}
      deliveredAmountMap.get(pid)[country][currency] = (deliveredAmountMap.get(pid)[country][currency] || 0) + Number(row.totalAmount || 0)
    }

    const response = products.map(p => {
      const bought = p.stockByCountry || {}
      let bUAE = bought.UAE || 0
      let bOman = bought.Oman || 0
      let bKSA = bought.KSA || 0
      let bBahrain = bought.Bahrain || 0
      let bIndia = bought.India || 0
      let bKuwait = bought.Kuwait || 0
      let bQatar = bought.Qatar || 0

      const dMap = deliveredMap.get(String(p._id)) || {}
      let delUAE = dMap.UAE || 0
      let delOman = dMap.Oman || 0
      let delKSA = dMap.KSA || 0
      let delBahrain = dMap.Bahrain || 0
      let delIndia = dMap.India || 0
      let delKuwait = dMap.Kuwait || 0
      let delQatar = dMap.Qatar || 0

      // If manager with assigned countries, zero-out disallowed countries
      if (Array.isArray(managerAssigned) && managerAssigned.length){
        const allow = new Set(managerAssigned)
        if (!allow.has('UAE')) { bUAE = 0; delUAE = 0 }
        if (!allow.has('Oman')) { bOman = 0; delOman = 0 }
        if (!allow.has('KSA')) { bKSA = 0; delKSA = 0 }
        if (!allow.has('Bahrain')) { bBahrain = 0; delBahrain = 0 }
        if (!allow.has('India')) { bIndia = 0; delIndia = 0 }
        if (!allow.has('Kuwait')) { bKuwait = 0; delKuwait = 0 }
        if (!allow.has('Qatar')) { bQatar = 0; delQatar = 0 }
      }

      const totalDelivered = delUAE + delOman + delKSA + delBahrain + delIndia + delKuwait + delQatar

      // Stock left = bought - delivered (clamped to 0)
      const leftUAE = Math.max(0, bUAE - delUAE)
      const leftOman = Math.max(0, bOman - delOman)
      const leftKSA = Math.max(0, bKSA - delKSA)
      const leftBahrain = Math.max(0, bBahrain - delBahrain)
      const leftIndia = Math.max(0, bIndia - delIndia)
      const leftKuwait = Math.max(0, bKuwait - delKuwait)
      const leftQatar = Math.max(0, bQatar - delQatar)
      const totalLeft = leftUAE + leftOman + leftKSA + leftBahrain + leftIndia + leftKuwait + leftQatar

      const totalBought = bUAE + bOman + bKSA + bBahrain + bIndia + bKuwait + bQatar

      const baseCur = ['AED','OMR','SAR','BHD','INR','KWD','QAR'].includes(String(p.baseCurrency)) ? String(p.baseCurrency) : 'SAR'
      const deliveredRevenueByCurrency = { AED: 0, OMR: 0, SAR: 0, BHD: 0, INR: 0, KWD: 0, QAR: 0 }
      const stockValueByCurrency = { AED: 0, OMR: 0, SAR: 0, BHD: 0, INR: 0, KWD: 0, QAR: 0 }
      // Delivered revenue = actual order amounts by currency
      const amtByCountry = deliveredAmountMap.get(String(p._id)) || {}
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
