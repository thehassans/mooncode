import express from 'express'
import WebOrder from '../models/WebOrder.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import { auth, allowRoles } from '../middleware/auth.js'

const router = express.Router()

// POST /api/ecommerce/orders (public)
router.post('/orders', async (req, res) => {
  try{
    const {
      customerName = '',
      customerPhone = '',
      phoneCountryCode = '',
      orderCountry = '',
      city = '',
      area = '',
      address = '',
      details = '',
      items = [],
      currency = 'SAR',
    } = req.body || {}

    if (!customerName.trim()) return res.status(400).json({ message: 'Name is required' })
    if (!customerPhone.trim()) return res.status(400).json({ message: 'Phone is required' })
    if (!orderCountry.trim()) return res.status(400).json({ message: 'Country is required' })
    if (!city.trim()) return res.status(400).json({ message: 'City is required' })
    if (!address.trim()) return res.status(400).json({ message: 'Address is required' })

    // Normalize items
    const norm = Array.isArray(items) ? items : []
    if (norm.length === 0) return res.status(400).json({ message: 'Cart is empty' })

    const ids = norm.map(i => i && i.productId).filter(Boolean)
    const prods = await Product.find({ _id: { $in: ids }, displayOnWebsite: true })
    const byId = Object.fromEntries(prods.map(p => [String(p._id), p]))
    let total = 0
    const orderItems = []
    for (const it of norm){
      const p = byId[String(it.productId)]
      if (!p) return res.status(400).json({ message: 'One or more products not available' })
      const qty = Math.max(1, Number(it.quantity||1))
      const unit = Number(p.price||0)
      total += unit * qty
      orderItems.push({ productId: p._id, name: p.name||'', price: unit, quantity: qty })
    }

    const doc = new WebOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      phoneCountryCode: String(phoneCountryCode||'').trim(),
      orderCountry: orderCountry.trim(),
      city: city.trim(),
      area: String(area||'').trim(),
      address: address.trim(),
      details: String(details||'').trim(),
      items: orderItems,
      total: Math.max(0, Number(total||0)),
      currency: String(currency||'SAR'),
      status: 'new',
    })
    await doc.save()
    return res.status(201).json({ message: 'Order received', order: doc })
  }catch(err){
    return res.status(500).json({ message: 'Failed to submit order', error: err?.message })
  }
})

// GET /api/ecommerce/orders (admin/user/manager)
router.get('/orders', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try{
    const { q = '', status = '', start = '', end = '', product = '', ship = '' } = req.query || {}
    const match = {}
    if (q){
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      match.$or = [
        { customerName: rx },
        { customerPhone: rx },
        { address: rx },
        { city: rx },
        { area: rx },
        { details: rx },
      ]
    }
    if (status) match.status = status
    if (ship) match.shipmentStatus = ship
    if (start || end){ match.createdAt = {}; if (start) match.createdAt.$gte = new Date(start); if (end) match.createdAt.$lte = new Date(end) }
    if (product){ match['items.productId'] = product }

    const page = Math.max(1, Number(req.query.page||1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit||20)))
    const skip = (page-1) * limit

    const total = await WebOrder.countDocuments(match)
    const rows = await WebOrder.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('deliveryBoy', 'firstName lastName email city')
    const hasMore = skip + rows.length < total
    return res.json({ orders: rows, page, limit, total, hasMore })
  }catch(err){
    return res.status(500).json({ message: 'Failed to load online orders', error: err?.message })
  }
})

// PATCH /api/ecommerce/orders/:id (update status)
router.patch('/orders/:id', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const { status, shipmentStatus } = req.body || {}
    const allowed = ['new','processing','done','cancelled']
    if (status && !allowed.includes(String(status))) return res.status(400).json({ message: 'Invalid status' })
    const allowedShip = ['pending','assigned','picked_up','in_transit','delivered','returned','cancelled']
    if (shipmentStatus && !allowedShip.includes(String(shipmentStatus))) return res.status(400).json({ message: 'Invalid shipment status' })
    const ord = await WebOrder.findById(id)
    if (!ord) return res.status(404).json({ message: 'Order not found' })
    if (status) ord.status = status
    if (shipmentStatus) ord.shipmentStatus = shipmentStatus
    await ord.save()
    return res.json({ message: 'Updated', order: ord })
  }catch(err){
    return res.status(500).json({ message: 'Failed to update online order', error: err?.message })
  }
})

// Assign driver to an online (web) order
router.post('/orders/:id/assign-driver', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const { driverId } = req.body || {}
    if (!driverId) return res.status(400).json({ message: 'driverId required' })
    const ord = await WebOrder.findById(id)
    if (!ord) return res.status(404).json({ message: 'Order not found' })
    const driver = await User.findById(driverId)
    if (!driver || driver.role !== 'driver') return res.status(400).json({ message: 'Driver not found' })

    // Workspace scoping similar to /api/orders
    if (req.user.role === 'user'){
      if (String(driver.createdBy) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    } else if (req.user.role === 'manager'){
      const mgr = await User.findById(req.user.id).select('createdBy assignedCountry')
      const ownerId = String(mgr?.createdBy || '')
      if (!ownerId || String(driver.createdBy) !== ownerId) return res.status(403).json({ message: 'Not allowed' })
      if (mgr?.assignedCountry) {
        if (driver.country && driver.country !== mgr.assignedCountry) {
          return res.status(403).json({ message: `Manager can only assign drivers from ${mgr.assignedCountry}` })
        }
        if (ord.orderCountry && ord.orderCountry !== mgr.assignedCountry) {
          return res.status(403).json({ message: `Manager can only assign to orders from ${mgr.assignedCountry}` })
        }
      }
    }

    // City rule: enforce order city matches driver city if provided
    if (driver.city && ord.city && String(driver.city).toLowerCase() !== String(ord.city).toLowerCase()){
      return res.status(400).json({ message: 'Driver city does not match order city' })
    }

    ord.deliveryBoy = driver._id
    if (!ord.shipmentStatus || ord.shipmentStatus === 'pending') ord.shipmentStatus = 'assigned'
    await ord.save()
    await ord.populate('deliveryBoy','firstName lastName email city')
    return res.json({ message: 'Driver assigned', order: ord })
  }catch(err){
    return res.status(500).json({ message: 'Failed to assign driver', error: err?.message })
  }
})

export default router
