import express from 'express'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Counter from '../models/Counter.js'
import { auth, allowRoles } from '../middleware/auth.js'
import User from '../models/User.js'
import { getIO } from '../config/socket.js'
import { createNotification } from './notifications.js'
// Removed invoice PDF generation

const router = express.Router()

// Lazy WhatsApp import to avoid startup crashes when WA is disabled or deps missing
async function getWA(){
  const enabled = process.env.ENABLE_WA !== 'false'
  if (!enabled) return { sendText: async ()=> ({ ok:true }), sendDocument: async ()=> ({ ok:true }) }
  try{
    const mod = await import('../services/whatsapp.js')
    return mod?.default || mod
  }catch(_e){
    return { sendText: async ()=> ({ ok:true }), sendDocument: async ()=> ({ ok:true }) }
  }
}

// Helper: emit targeted order updates
async function emitOrderChange(ord, action = 'updated'){
  try{
    const io = getIO()
    const orderId = String(ord?._id || '')
    const status = String(ord?.shipmentStatus || ord?.status || '')
    const invoiceNumber = ord?.invoiceNumber || null
    // Notify assigned driver
    if (ord?.deliveryBoy){
      const room = `user:${String(ord.deliveryBoy)}`
      const event = (action === 'assigned') ? 'order.assigned' : 'order.updated'
      try{ io.to(room).emit(event, { orderId, invoiceNumber, action, status, order: ord }) }catch{}
    }
    // Notify the order creator directly as well (e.g., agent who submitted the order)
    try{ io.to(`user:${String(ord.createdBy)}`).emit('orders.changed', { orderId, invoiceNumber, action, status }) }catch{}
    // Compute workspace owner for broadcast
    let ownerId = null
    try{
      const creator = await User.findById(ord.createdBy).select('role createdBy').lean()
      ownerId = (creator?.role === 'user') ? String(ord.createdBy) : (creator?.createdBy ? String(creator.createdBy) : String(ord.createdBy))
    }catch{}
    if (ownerId){
      try{ io.to(`workspace:${ownerId}`).emit('orders.changed', { orderId, invoiceNumber, action, status }) }catch{}
    }
  }catch{ /* ignore socket errors */ }
}

// Create order (admin, user, agent, manager with permission)
router.post('/', auth, allowRoles('admin','user','agent','manager'), async (req, res) => {
  const { customerName, customerPhone, customerLocation, details, phoneCountryCode, orderCountry, city, customerArea, customerAddress, locationLat, locationLng, productId, quantity,
    shipmentMethod, courierName, trackingNumber, deliveryBoy, shippingFee, codAmount, collectedAmount, total, discount, preferredTiming, items,
    additionalPhone, additionalPhonePref } = req.body || {}
  // ===== STRICT VALIDATION: Required fields =====
  
  // 1. Customer phone is required
  if (!customerPhone || !String(customerPhone).trim()) {
    return res.status(400).json({ 
      message: 'Customer phone number is required',
      error: 'MISSING_PHONE'
    })
  }
  
  // 2. WhatsApp location (lat/lng) is required
  if (locationLat == null || locationLng == null) {
    return res.status(400).json({ 
      message: 'WhatsApp location is required. Please share your location pin in WhatsApp',
      error: 'MISSING_LOCATION'
    })
  }
  
  // 3. Customer address is required
  if (!customerAddress || !String(customerAddress).trim()) {
    return res.status(400).json({ 
      message: 'Customer address is required. Please provide the full delivery address',
      error: 'MISSING_ADDRESS'
    })
  }
  
  // 4. City is required
  if (!city || !String(city).trim()) {
    return res.status(400).json({ 
      message: 'City is required. Please specify the city name',
      error: 'MISSING_CITY'
    })
  }
  
  // 5. Order country is required
  if (!orderCountry || !String(orderCountry).trim()) {
    return res.status(400).json({ 
      message: 'Delivery country is required',
      error: 'MISSING_COUNTRY'
    })
  }
  
  // Derive a reasonable customerLocation string
  const customerLocationResolved = (customerLocation && String(customerLocation).trim())
    || `(${Number(locationLat).toFixed(6)}, ${Number(locationLng).toFixed(6)})`
    || (customerAddress && String(customerAddress).trim())
    || ''

  // Validate address country matches phone country code
  if (phoneCountryCode && orderCountry) {
    const phoneDigits = String(phoneCountryCode).replace(/[^0-9]/g, '')
    const countryUpper = String(orderCountry).trim().toUpperCase()
    
    // Map country codes to country names (ISO codes)
    const countryCodeMap = {
      '971': ['UAE', 'AE', 'UNITED ARAB EMIRATES'],
      '966': ['KSA', 'SA', 'SAUDI ARABIA'],
      '968': ['OMN', 'OM', 'OMAN'],
      '973': ['BHR', 'BH', 'BAHRAIN'],
      '974': ['QAT', 'QA', 'QATAR'],
      '965': ['KWT', 'KW', 'KUWAIT'],
      '962': ['JOR', 'JO', 'JORDAN'],
      '963': ['SYR', 'SY', 'SYRIA'],
      '964': ['IRQ', 'IQ', 'IRAQ'],
      '961': ['LBN', 'LB', 'LEBANON'],
      '967': ['YEM', 'YE', 'YEMEN'],
      '20': ['EGY', 'EG', 'EGYPT'],
      '212': ['MAR', 'MA', 'MOROCCO'],
      '213': ['DZA', 'DZ', 'ALGERIA'],
      '216': ['TUN', 'TN', 'TUNISIA'],
      '218': ['LBY', 'LY', 'LIBYA'],
      '249': ['SDN', 'SD', 'SUDAN'],
      '92': ['PAK', 'PK', 'PAKISTAN'],
      '91': ['IND', 'IN', 'INDIA'],
      '880': ['BGD', 'BD', 'BANGLADESH'],
    }
    
    // Find expected countries for this phone code
    const expectedCountries = countryCodeMap[phoneDigits] || []
    
    // Check if order country matches phone country code
    if (expectedCountries.length > 0) {
      const isValidCountry = expectedCountries.some(country => 
        countryUpper === country || countryUpper.includes(country) || country.includes(countryUpper)
      )
      
      if (!isValidCountry) {
        const expectedCountryName = expectedCountries[expectedCountries.length - 1] // Use full name
        return res.status(400).json({ 
          message: `Country Verification Failed: The delivery address country (${orderCountry}) does not match the phone number country code (+${phoneDigits} - ${expectedCountryName}). Please select the correct delivery country: ${expectedCountryName}.`,
          error: 'COUNTRY_MISMATCH',
          phoneCountryCode: phoneDigits,
          orderCountry: orderCountry,
          expectedCountry: expectedCountryName
        })
      }
    }
  }
  
  // Additional validation: If lat/lng provided, verify resolved location country matches phone country code
  if (phoneCountryCode && locationLat != null && locationLng != null) {
    try {
      const phoneDigits = String(phoneCountryCode).replace(/[^0-9]/g, '')
      
      // Map country codes to ISO country codes
      const phoneToISOMap = {
        '971': 'AE',  // UAE
        '966': 'SA',  // Saudi Arabia
        '968': 'OM',  // Oman
        '973': 'BH',  // Bahrain
        '974': 'QA',  // Qatar
        '965': 'KW',  // Kuwait
        '962': 'JO',  // Jordan
        '963': 'SY',  // Syria
        '964': 'IQ',  // Iraq
        '961': 'LB',  // Lebanon
        '967': 'YE',  // Yemen
        '20': 'EG',   // Egypt
        '212': 'MA',  // Morocco
        '213': 'DZ',  // Algeria
        '216': 'TN',  // Tunisia
        '218': 'LY',  // Libya
        '249': 'SD',  // Sudan
        '92': 'PK',   // Pakistan
        '91': 'IN',   // India
        '880': 'BD',  // Bangladesh
      }
      
      const expectedISOCode = phoneToISOMap[phoneDigits]
      
      if (expectedISOCode) {
        // Reverse geocode to get country from coordinates
        const { default: googleMapsService } = await import('../services/googleMapsService.js')
        const geoResult = await googleMapsService.reverseGeocode(locationLat, locationLng)
        
        if (geoResult.success && geoResult.address_components) {
          // Extract country from address components
          const countryComponent = geoResult.address_components.find(comp => 
            comp.types.includes('country')
          )
          
          if (countryComponent) {
            const resolvedISOCode = countryComponent.short_name // e.g., "AE", "SA"
            
            if (resolvedISOCode !== expectedISOCode) {
              const countryCodeMap = {
                '971': 'United Arab Emirates',
                '966': 'Saudi Arabia',
                '968': 'Oman',
                '973': 'Bahrain',
                '974': 'Qatar',
                '965': 'Kuwait',
                '962': 'Jordan',
                '963': 'Syria',
                '964': 'Iraq',
                '961': 'Lebanon',
                '967': 'Yemen',
                '20': 'Egypt',
                '212': 'Morocco',
                '213': 'Algeria',
                '216': 'Tunisia',
                '218': 'Libya',
                '249': 'Sudan',
                '92': 'Pakistan',
                '91': 'India',
                '880': 'Bangladesh',
              }
              
              const expectedCountryName = countryCodeMap[phoneDigits] || expectedISOCode
              const resolvedCountryName = countryComponent.long_name
              
              return res.status(400).json({
                message: `Location Verification Failed: The provided address coordinates correspond to ${resolvedCountryName}, which does not match the phone number country code (+${phoneDigits} - ${expectedCountryName}). Please ensure the delivery location is within ${expectedCountryName}.`,
                error: 'LOCATION_COUNTRY_MISMATCH',
                phoneCountryCode: phoneDigits,
                resolvedCountry: resolvedCountryName,
                resolvedCountryISO: resolvedISOCode,
                expectedCountry: expectedCountryName,
                expectedCountryISO: expectedISOCode
              })
            }
          }
        }
      }
    } catch (geoErr) {
      // Log error but don't block order if geocoding fails
      console.warn('[Order] Location country validation failed:', geoErr.message)
    }
  }

  // Managers may be restricted by permission
  if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('managerPermissions')
    if (!mgr || !mgr.managerPermissions?.canCreateOrders){
      return res.status(403).json({ message: 'Manager not allowed to create orders' })
    }
  }

  // Duplicate guard: if same creator submits same phone+details in last 30s, return existing
  try{
    const since = new Date(Date.now() - 30_000)
    const dup = await Order.findOne({ createdBy: req.user.id, customerPhone, details, createdAt: { $gte: since } })
    if (dup){
      return res.status(200).json({ message: 'Duplicate submission ignored', order: dup, duplicate: true })
    }
  }catch(_e){ /* best effort */ }

  // Resolve single or multiple products
  let prod = null
  let normItems = []
  if (Array.isArray(items) && items.length){
    for (const it of items){
      if (!it || !it.productId) continue
      const p = await Product.findById(it.productId)
      if (!p) return res.status(400).json({ message: 'Product not found' })
      if (orderCountry && p.availableCountries?.length && !p.availableCountries.includes(orderCountry)){
        return res.status(400).json({ message: `Product ${p.name} not available in selected country` })
      }
      normItems.push({ productId: p._id, quantity: Math.max(1, Number(it.quantity||1)) })
    }
  } else if (productId) {
    prod = await Product.findById(productId)
    if (!prod) return res.status(400).json({ message: 'Product not found' })
    if (orderCountry && prod.availableCountries?.length && !prod.availableCountries.includes(orderCountry)){
      return res.status(400).json({ message: 'Product not available in selected country' })
    }
  }
  const cod = Math.max(0, Number(codAmount||0))
  const collected = Math.max(0, Number(collectedAmount||0))
  const shipFee = Math.max(0, Number((shippingFee!=null? shippingFee : req.body?.shipping)||0))
  let ordTotal = (total!=null) ? Number(total) : (req.body?.total!=null ? Number(req.body.total) : undefined)
  const disc = (discount!=null) ? Number(discount) : (req.body?.discount!=null ? Number(req.body.discount) : undefined)
  const balanceDue = Math.max(0, cod - collected - shipFee)

  // If total not provided, compute a simple sum of item unit prices * qty minus discount + shipping
  if (ordTotal == null){
    try{
      if (normItems.length){
        const ids = normItems.map(i=>i.productId)
        const prods = await Product.find({ _id: { $in: ids } })
        const byId = Object.fromEntries(prods.map(p=>[String(p._id), p]))
        let sum = 0
        for (const it of normItems){
          const p = byId[String(it.productId)]
          if (p){ sum += Number(p.price||0) * Math.max(1, Number(it.quantity||1)) }
        }
        ordTotal = Math.max(0, sum + shipFee - (disc||0))
      } else if (prod) {
        ordTotal = Math.max(0, Number(prod.price||0) * Math.max(1, Number(quantity||1)) + shipFee - (disc||0))
      }
    }catch{ ordTotal = undefined }
  }

  // Generate short unique order number (5-digit numeric, zero-padded)
  let shortCode = null
  try{
    const ctr = await Counter.findOneAndUpdate({ name: 'order' }, { $inc: { seq: 1 } }, { new: true, upsert: true })
    const n = Number(ctr?.seq || 1)
    shortCode = n.toString(10).padStart(5, '0')
  }catch{}

  const doc = new Order({
    customerName: customerName || (shortCode ? `customer ${shortCode}` : ''),
    customerPhone,
    phoneCountryCode,
    orderCountry,
    city,
    customerAddress,
    customerArea: customerArea || '',
    locationLat,
    locationLng,
    customerLocation,
    preferredTiming: preferredTiming || '',
    ...(additionalPhone ? { additionalPhone } : {}),
    ...(additionalPhonePref ? { additionalPhonePref } : {}),
    details,
    productId: prod?._id,
    quantity: Math.max(1, Number(quantity || 1)),
    items: normItems,
    createdBy: req.user.id,
    createdByRole: req.user.role,
    shipmentMethod: shipmentMethod || 'none',
    courierName: courierName || undefined,
    trackingNumber: trackingNumber || undefined,
    deliveryBoy: deliveryBoy || undefined,
    shippingFee: shipFee,
    codAmount: cod,
    collectedAmount: collected,
    balanceDue,
    ...(ordTotal!=null ? { total: ordTotal } : {}),
    ...(disc!=null ? { discount: disc } : {}),
    ...(shortCode ? { invoiceNumber: shortCode } : {}),
  })
  await doc.save()
  // Broadcast create
  emitOrderChange(doc, 'created').catch(()=>{})
  // Removed invoice PDF generation and storage

  // Removed auto-send invoice fallback and WhatsApp notifications

  // Create notification for order submission
  try {
    // Determine who should receive the notification
    let notificationUserId = req.user.id
    
    // If order was created by agent or manager, notify the owner (user) as well
    if (req.user.role === 'agent' || req.user.role === 'manager') {
      const creator = await User.findById(req.user.id).select('createdBy role').lean()
      if (creator?.createdBy) {
        // Notify the owner (user who created this agent/manager)
        await createNotification({
          userId: creator.createdBy,
          type: 'order_created',
          title: 'New Order Submitted',
          message: `Order #${doc.invoiceNumber || doc._id} submitted by ${req.user.firstName} ${req.user.lastName} (${req.user.role})`,
          relatedId: doc._id,
          relatedType: 'order',
          triggeredBy: req.user.id,
          triggeredByRole: req.user.role,
          metadata: {
            customerPhone: doc.customerPhone,
            city: doc.city,
            total: doc.total,
            productName: prod?.name
          }
        })
      }
    }
    
    // Always notify the order creator
    await createNotification({
      userId: notificationUserId,
      type: 'order_created',
      title: 'Order Submitted Successfully',
      message: `Your order #${doc.invoiceNumber || doc._id} has been submitted successfully`,
      relatedId: doc._id,
      relatedType: 'order',
      triggeredBy: req.user.id,
      triggeredByRole: req.user.role,
      metadata: {
        customerPhone: doc.customerPhone,
        city: doc.city,
        total: doc.total,
        productName: prod?.name
      }
    })
  } catch (notificationError) {
    console.warn('Failed to create order notification:', notificationError?.message || notificationError)
  }

  // Removed auto-send invoice IIFE

  res.status(201).json({ message: 'Order submitted', order: doc })
})

// List orders (admin => all; others => own)
router.get('/', auth, allowRoles('admin','user','agent','manager'), async (req, res) => {
  try{
    let base = {}
    if (req.user.role === 'admin') {
      base = {}
    } else if (req.user.role === 'user') {
      // Include orders created by the user AND by agents/managers created by this user
      const agents = await User.find({ role: 'agent', createdBy: req.user.id }, { _id: 1 }).lean()
      const managers = await User.find({ role: 'manager', createdBy: req.user.id }, { _id: 1 }).lean()
      const agentIds = agents.map(a => a._id)
      const managerIds = managers.map(m => m._id)
      base = { createdBy: { $in: [req.user.id, ...agentIds, ...managerIds] } }
    } else if (req.user.role === 'manager') {
      // Manager sees workspace orders for their owner (user), filtered by assigned country
      const mgr = await User.findById(req.user.id).select('createdBy assignedCountry').lean()
      const ownerId = mgr?.createdBy
      const assignedCountry = mgr?.assignedCountry
      
      if (ownerId){
        const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
        const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
        const agentIds = agents.map(a => a._id)
        const managerIds = managers.map(m => m._id)
        base = { createdBy: { $in: [ownerId, ...agentIds, ...managerIds] } }
        // Filter by assigned country if manager has one
        if (assignedCountry) {
          base.orderCountry = assignedCountry
        }
      } else {
        base = { createdBy: req.user.id }
        if (assignedCountry) {
          base.orderCountry = assignedCountry
        }
      }
    } else {
      // agent
      base = { createdBy: req.user.id }
    }

    // Pagination and filters
    const page = Math.max(1, Number(req.query.page||1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit||20)))
    const skip = (page-1) * limit
    const q = String(req.query.q||'').trim()
    const country = String(req.query.country||'').trim()
    const city = String(req.query.city||'').trim()
    const onlyUnassigned = String(req.query.onlyUnassigned||'').toLowerCase() === 'true'
    const statusFilter = String(req.query.status||'').trim().toLowerCase()
    const shipFilter = String(req.query.ship||'').trim().toLowerCase()
    const payment = String(req.query.payment||'').trim().toUpperCase()
    const collectedOnly = String(req.query.collected||'').toLowerCase() === 'true'
    const agentId = String(req.query.agent||'').trim()
    const driverId = String(req.query.driver||'').trim()
    const productParam = String(req.query.product||'').trim()

    const match = { ...base }
    if (country) {
      const aliases = {
        'KSA': ['KSA','Saudi Arabia'],
        'Saudi Arabia': ['KSA','Saudi Arabia'],
        'UAE': ['UAE','United Arab Emirates'],
        'United Arab Emirates': ['UAE','United Arab Emirates'],
      }
      if (aliases[country]) match.orderCountry = { $in: aliases[country] }
      else match.orderCountry = country
    }
    if (city) match.city = city
    if (onlyUnassigned) match.deliveryBoy = { $in: [null, undefined] }
    if (statusFilter) match.status = statusFilter
    if (shipFilter) match.shipmentStatus = shipFilter
    if (payment === 'COD') match.paymentMethod = 'COD'
    else if (payment === 'PREPAID') match.paymentMethod = { $ne: 'COD' }
    if (collectedOnly) match.collectedAmount = { $gt: 0 }
    if (agentId) match.createdBy = agentId
    if (driverId) match.deliveryBoy = driverId
    // Product filter: match top-level or items.productId
    if (productParam){
      try{
        const pid = new mongoose.Types.ObjectId(productParam)
        const orList = match.$or ? [...match.$or] : []
        orList.push({ productId: pid })
        orList.push({ 'items.productId': pid })
        match.$or = orList
      }catch{}
    }
    if (q){
      // Normalize invoice token: allow searching with leading '#'
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = new RegExp(safe, 'i')
      const stripped = q.startsWith('#') ? q.slice(1) : q
      const rxInv = stripped && stripped !== q ? new RegExp(stripped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null
      const textConds = [
        { invoiceNumber: rx },
        ...(rxInv ? [{ invoiceNumber: rxInv }] : []),
        { customerPhone: rx },
        { customerName: rx },
        { details: rx },
        { city: rx },
      ]

      // Agent/Driver name search in same 'q' filter
      try{
        // Determine owner scope for users lookup
        let ownerIds = null
        if (req.user.role === 'user') ownerIds = [ req.user.id ]
        else if (req.user.role === 'manager') {
          const mgr = await User.findById(req.user.id).select('createdBy').lean()
          if (mgr?.createdBy) ownerIds = [ String(mgr.createdBy) ]
        }
        const userNameConds = [ { firstName: rx }, { lastName: rx }, { email: rx } ]
        const baseUserFilter = ownerIds ? { createdBy: { $in: ownerIds } } : {}
        const agentsByName = await User.find({ role: 'agent', ...baseUserFilter, $or: userNameConds }).select('_id').lean()
        const driversByName = await User.find({ role: 'driver', ...baseUserFilter, $or: userNameConds }).select('_id').lean()
        const agentIds = agentsByName.map(a => a._id)
        const driverIds = driversByName.map(d => d._id)
        if (agentIds.length) textConds.push({ createdBy: { $in: agentIds } })
        if (driverIds.length) textConds.push({ deliveryBoy: { $in: driverIds } })
      }catch{ /* ignore name lookup errors */ }

      // Product name search (top-level and items)
      try{
        const prods = await Product.find({ name: rx }).select('_id').lean()
        const pids = prods.map(p => p._id)
        if (pids.length){
          textConds.push({ productId: { $in: pids } })
          textConds.push({ 'items.productId': { $in: pids } })
        }
      }catch{ /* ignore */ }

      match.$or = (match.$or ? match.$or : []).concat(textConds)
    }

    const total = await Order.countDocuments(match)
    const orders = await Order
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('productId')
      .populate('items.productId')
      .populate('deliveryBoy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email role')
      .lean()
    const hasMore = skip + orders.length < total
    res.json({ orders, page, limit, total, hasMore })
  }catch(err){
    res.status(500).json({ message: 'Failed to list orders', error: err?.message })
  }
})

// Export orders as CSV with the same scoping and filters as the list endpoint
router.get('/export', auth, allowRoles('admin','user','agent','manager'), async (req, res) => {
  try{
    // Scope (same as list)
    let base = {}
    if (req.user.role === 'admin') {
      base = {}
    } else if (req.user.role === 'user') {
      const agents = await User.find({ role: 'agent', createdBy: req.user.id }, { _id: 1 }).lean()
      const managers = await User.find({ role: 'manager', createdBy: req.user.id }, { _id: 1 }).lean()
      const agentIds = agents.map(a => a._id)
      const managerIds = managers.map(m => m._id)
      base = { createdBy: { $in: [req.user.id, ...agentIds, ...managerIds] } }
    } else if (req.user.role === 'manager') {
      const mgr = await User.findById(req.user.id).select('createdBy assignedCountry').lean()
      const ownerId = mgr?.createdBy
      const assignedCountry = mgr?.assignedCountry
      if (ownerId){
        const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
        const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
        const agentIds = agents.map(a => a._id)
        const managerIds = managers.map(m => m._id)
        base = { createdBy: { $in: [ownerId, ...agentIds, ...managerIds] } }
        if (assignedCountry) base.orderCountry = assignedCountry
      } else {
        base = { createdBy: req.user.id }
        if (assignedCountry) base.orderCountry = assignedCountry
      }
    } else {
      base = { createdBy: req.user.id }
    }

    // Filters
    const q = String(req.query.q||'').trim()
    const country = String(req.query.country||'').trim()
    const city = String(req.query.city||'').trim()
    const onlyUnassigned = String(req.query.onlyUnassigned||'').toLowerCase() === 'true'
    const statusFilter = String(req.query.status||'').trim().toLowerCase()
    const shipFilter = String(req.query.ship||'').trim().toLowerCase()
    const payment = String(req.query.payment||'').trim().toUpperCase()
    const collectedOnly = String(req.query.collected||'').toLowerCase() === 'true'
    const agentId = String(req.query.agent||'').trim()
    const driverId = String(req.query.driver||'').trim()
    const productParam = String(req.query.product||'').trim()

    const match = { ...base }
    if (country) {
      const aliases = {
        'KSA': ['KSA','Saudi Arabia'],
        'Saudi Arabia': ['KSA','Saudi Arabia'],
        'UAE': ['UAE','United Arab Emirates'],
        'United Arab Emirates': ['UAE','United Arab Emirates'],
      }
      match.orderCountry = aliases[country] ? { $in: aliases[country] } : country
    }
    if (city) match.city = city
    if (onlyUnassigned) match.deliveryBoy = { $in: [null, undefined] }
    if (statusFilter) match.status = statusFilter
    if (shipFilter) match.shipmentStatus = shipFilter
    if (payment === 'COD') match.paymentMethod = 'COD'
    else if (payment === 'PREPAID') match.paymentMethod = { $ne: 'COD' }
    if (collectedOnly) match.collectedAmount = { $gt: 0 }
    if (agentId) match.createdBy = agentId
    if (driverId) match.deliveryBoy = driverId
    if (productParam){
      try{
        const pid = new mongoose.Types.ObjectId(productParam)
        const orList = match.$or ? [...match.$or] : []
        orList.push({ productId: pid })
        orList.push({ 'items.productId': pid })
        match.$or = orList
      }catch{}
    }
    if (q){
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = new RegExp(safe, 'i')
      const stripped = q.startsWith('#') ? q.slice(1) : q
      const rxInv = stripped && stripped !== q ? new RegExp(stripped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null
      const textConds = [
        { invoiceNumber: rx },
        ...(rxInv ? [{ invoiceNumber: rxInv }] : []),
        { customerPhone: rx },
        { customerName: rx },
        { details: rx },
        { city: rx },
      ]
      try{
        let ownerIds = null
        if (req.user.role === 'user') ownerIds = [ req.user.id ]
        else if (req.user.role === 'manager') {
          const mgr = await User.findById(req.user.id).select('createdBy').lean()
          if (mgr?.createdBy) ownerIds = [ String(mgr.createdBy) ]
        }
        const userNameConds = [ { firstName: rx }, { lastName: rx }, { email: rx } ]
        const baseUserFilter = ownerIds ? { createdBy: { $in: ownerIds } } : {}
        const agentsByName = await User.find({ role: 'agent', ...baseUserFilter, $or: userNameConds }).select('_id').lean()
        const driversByName = await User.find({ role: 'driver', ...baseUserFilter, $or: userNameConds }).select('_id').lean()
        const agentIds2 = agentsByName.map(a => a._id)
        const driverIds2 = driversByName.map(d => d._id)
        if (agentIds2.length) textConds.push({ createdBy: { $in: agentIds2 } })
        if (driverIds2.length) textConds.push({ deliveryBoy: { $in: driverIds2 } })
      }catch{}
      try{
        const prods = await Product.find({ name: rx }).select('_id').lean()
        const pids = prods.map(p => p._id)
        if (pids.length){
          textConds.push({ productId: { $in: pids } })
          textConds.push({ 'items.productId': { $in: pids } })
        }
      }catch{}
      match.$or = (match.$or ? match.$or : []).concat(textConds)
    }

    const cap = Math.min(20000, Math.max(1, Number(req.query.max||10000)))
    const rows = await Order
      .find(match)
      .sort({ createdAt: -1 })
      .limit(cap)
      .populate('productId')
      .populate('items.productId')
      .populate('deliveryBoy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email role')
      .lean()

    const esc = (v) => {
      if (v == null) return ''
      const s = String(v)
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
      return s
    }
    const fmtDate = (d) => { try{ return new Date(d).toISOString() }catch{ return '' } }
    const productSummary = (o) => {
      try{
        if (Array.isArray(o?.items) && o.items.length){
          return o.items.map(it => `${it?.productId?.name||'Product'} (${Math.max(1, Number(it?.quantity||1))})`).join('; ')
        }
        return o?.productId?.name ? `${o.productId.name} (${Math.max(1, Number(o?.quantity||1))})` : ''
      }catch{ return '' }
    }
    const itemsCount = (o) => {
      try{
        if (Array.isArray(o?.items) && o.items.length){ return o.items.reduce((s,it)=> s + Math.max(1, Number(it?.quantity||1)), 0) }
        return Math.max(1, Number(o?.quantity||1))
      }catch{ return 0 }
    }

    const header = [
      'Invoice','OrderID','CreatedAt','Country','City','Customer','PhoneCode','Phone','Address','Status','ShipmentStatus','COD','Collected','ShippingFee','BalanceDue','Total','Discount','Products','ItemsCount','DriverName','AgentName'
    ]
    const lines = [header.join(',')]
    for (const r of rows){
      const driverName = r?.deliveryBoy ? `${r.deliveryBoy.firstName||''} ${r.deliveryBoy.lastName||''}`.trim() : ''
      const agentName = r?.createdBy ? `${r.createdBy.firstName||''} ${r.createdBy.lastName||''}`.trim() : ''
      const line = [
        esc(r?.invoiceNumber||''),
        esc(r?._id||''),
        esc(fmtDate(r?.createdAt)),
        esc(r?.orderCountry||''),
        esc(r?.city||''),
        esc(r?.customerName||''),
        esc(r?.phoneCountryCode||''),
        esc(r?.customerPhone||''),
        esc(r?.customerAddress||''),
        esc(r?.status||''),
        esc(r?.shipmentStatus||''),
        esc(Number(r?.codAmount||0).toFixed(2)),
        esc(Number(r?.collectedAmount||0).toFixed(2)),
        esc(Number(r?.shippingFee||0).toFixed(2)),
        esc(Number(r?.balanceDue||0).toFixed(2)),
        esc(r?.total!=null ? Number(r.total).toFixed(2) : ''),
        esc(r?.discount!=null ? Number(r.discount).toFixed(2) : ''),
        esc(productSummary(r)),
        esc(itemsCount(r)),
        esc(driverName),
        esc(agentName),
      ].join(',')
      lines.push(line)
    }

    const csv = '\ufeff' + lines.join('\n')
    const ts = new Date().toISOString().slice(0,10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="orders-${ts}.csv"`)
    return res.status(200).send(csv)
  }catch(err){
    res.status(500).json({ message: 'Failed to export orders', error: err?.message })
  }
})

// Distinct options: countries and cities (optionally filtered by country)
router.get('/options', auth, allowRoles('admin','user','agent','manager'), async (req, res) => {
  try{
    let base = {}
    if (req.user.role === 'admin') {
      base = {}
    } else if (req.user.role === 'user') {
      const agents = await User.find({ role: 'agent', createdBy: req.user.id }, { _id: 1 }).lean()
      const managers = await User.find({ role: 'manager', createdBy: req.user.id }, { _id: 1 }).lean()
      const agentIds = agents.map(a => a._id)
      const managerIds = managers.map(m => m._id)
      base = { createdBy: { $in: [req.user.id, ...agentIds, ...managerIds] } }
    } else if (req.user.role === 'manager') {
      const mgr = await User.findById(req.user.id).select('createdBy assignedCountry').lean()
      const ownerId = mgr?.createdBy
      const assignedCountry = mgr?.assignedCountry
      if (ownerId){
        const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
        const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
        const agentIds = agents.map(a => a._id)
        const managerIds = managers.map(m => m._id)
        base = { createdBy: { $in: [ownerId, ...agentIds, ...managerIds] } }
        if (assignedCountry) base.orderCountry = assignedCountry
      } else {
        base = { createdBy: req.user.id }
        if (assignedCountry) base.orderCountry = assignedCountry
      }
    } else {
      base = { createdBy: req.user.id }
    }
    const countryParam = String(req.query.country||'').trim()
    const countriesRaw = (await Order.distinct('orderCountry', base)).filter(Boolean)
    const toCanonical = (name) => {
      if (name === 'Saudi Arabia') return 'KSA'
      if (name === 'United Arab Emirates') return 'UAE'
      return name
    }
    const countries = Array.from(new Set(countriesRaw.map(toCanonical))).sort()
    // Apply alias mapping for city filter
    const aliases = {
      'KSA': ['KSA','Saudi Arabia'],
      'Saudi Arabia': ['KSA','Saudi Arabia'],
      'UAE': ['UAE','United Arab Emirates'],
      'United Arab Emirates': ['UAE','United Arab Emirates'],
    }
    const matchCity = { ...base }
    if (countryParam){
      matchCity.orderCountry = aliases[countryParam] ? { $in: aliases[countryParam] } : countryParam
    }
    const cities = (await Order.distinct('city', matchCity)).filter(Boolean).sort()
    res.json({ countries, cities })
  }catch(err){
    res.status(500).json({ message: 'Failed to load options', error: err?.message })
  }
})

// Get a single order by ID (for label printing, detail views)
router.get('/view/:id', auth, allowRoles('admin','user','agent','manager'), async (req, res) => {
  const { id } = req.params
  const ord = await Order.findById(id)
    .populate('productId')
    .populate('items.productId')
    .populate('deliveryBoy','firstName lastName email')
    .populate('createdBy','firstName lastName email role')
  if (!ord) return res.status(404).json({ message: 'Order not found' })

  // Access control similar to list
  const creatorId = String(ord.createdBy && ord.createdBy._id ? ord.createdBy._id : ord.createdBy)
  if (req.user.role === 'admin') {
    // allowed
  } else if (req.user.role === 'user') {
    const agents = await User.find({ role: 'agent', createdBy: req.user.id }, { _id: 1 }).lean()
    const managers = await User.find({ role: 'manager', createdBy: req.user.id }, { _id: 1 }).lean()
    const allowed = new Set([String(req.user.id), ...agents.map(a=>String(a._id)), ...managers.map(m=>String(m._id))])
    if (!allowed.has(creatorId)) return res.status(403).json({ message: 'Not allowed' })
  } else if (req.user.role === 'manager') {
    const mgr = await User.findById(req.user.id).select('createdBy').lean()
    const ownerId = String(mgr?.createdBy || '')
    if (!ownerId) return res.status(403).json({ message: 'Not allowed' })
    const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
    const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
    const allowed = new Set([ownerId, ...agents.map(a=>String(a._id)), ...managers.map(m=>String(m._id))])
    if (!allowed.has(creatorId)) return res.status(403).json({ message: 'Not allowed' })
  } else if (req.user.role === 'agent') {
    if (creatorId !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
  }

  res.json({ order: ord })
})

// Unassigned orders with optional country/city filter (admin, user, manager)
router.get('/unassigned', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { country = '', city = '' } = req.query || {}
  let base = { deliveryBoy: { $in: [null, undefined] } }
  if (req.user.role === 'admin') {
    // no extra scoping
  } else if (req.user.role === 'user') {
    const agents = await User.find({ role: 'agent', createdBy: req.user.id }, { _id: 1 }).lean()
    const managers = await User.find({ role: 'manager', createdBy: req.user.id }, { _id: 1 }).lean()
    const agentIds = agents.map(a => a._id)
    const managerIds = managers.map(m => m._id)
    base.createdBy = { $in: [req.user.id, ...agentIds, ...managerIds] }
  } else {
    // manager workspace scoping
    const mgr = await User.findById(req.user.id).select('createdBy').lean()
    const ownerId = mgr?.createdBy
    if (ownerId){
      const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
      const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
      const agentIds = agents.map(a => a._id)
      const managerIds = managers.map(m => m._id)
      base.createdBy = { $in: [ownerId, ...agentIds, ...managerIds] }
    } else {
      base.createdBy = req.user.id
    }
  }
  if (country) base.orderCountry = country
  if (city) base.city = city
  const orders = await Order.find(base).sort({ createdAt: -1 }).populate('createdBy','firstName lastName role').populate('productId')
  res.json({ orders })
})

// Assign driver to an order (admin, user, manager). Manager limited to workspace drivers and matching city.
router.post('/:id/assign-driver', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { id } = req.params
  const { driverId } = req.body || {}
  if (!driverId) return res.status(400).json({ message: 'driverId required' })
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  const driver = await User.findById(driverId)
  if (!driver || driver.role !== 'driver') return res.status(400).json({ message: 'Driver not found' })
  // Workspace scoping: user can assign only own drivers; manager only owner drivers
  if (req.user.role === 'user'){
    if (String(driver.createdBy) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
  } else if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('createdBy assignedCountry')
    const ownerId = String(mgr?.createdBy || '')
    if (!ownerId || String(driver.createdBy) !== ownerId) return res.status(403).json({ message: 'Not allowed' })
    
    // Country restriction: manager can only assign drivers from their assigned country
    if (mgr?.assignedCountry) {
      if (driver.country !== mgr.assignedCountry) {
        return res.status(403).json({ message: `Manager can only assign drivers from ${mgr.assignedCountry}` })
      }
      if (ord.orderCountry !== mgr.assignedCountry) {
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
  await ord.populate('deliveryBoy','firstName lastName email')
  // Notify driver + workspace
  emitOrderChange(ord, 'assigned').catch(()=>{})
  res.json({ message: 'Driver assigned', order: ord })
})

// Driver: list assigned orders
router.get('/driver/assigned', auth, allowRoles('driver'), async (req, res) => {
  const orders = await Order.find({ deliveryBoy: req.user.id, shipmentStatus: { $nin: ['delivered','cancelled'] } })
    .sort({ createdAt: -1 })
    .populate('productId')
  res.json({ orders })
})

// Driver: list picked up orders (shipmentStatus = picked_up)
router.get('/driver/picked', auth, allowRoles('driver'), async (req, res) => {
  const orders = await Order.find({ deliveryBoy: req.user.id, shipmentStatus: 'picked_up' })
    .sort({ updatedAt: -1 })
    .populate('productId')
  res.json({ orders })
})

// Driver: list delivered orders
router.get('/driver/delivered', auth, allowRoles('driver'), async (req, res) => {
  const orders = await Order.find({ deliveryBoy: req.user.id, shipmentStatus: 'delivered' })
    .sort({ updatedAt: -1 })
    .populate('productId')
  res.json({ orders })
})

// Driver: list cancelled orders
router.get('/driver/cancelled', auth, allowRoles('driver'), async (req, res) => {
  const orders = await Order.find({ deliveryBoy: req.user.id, shipmentStatus: 'cancelled' })
    .sort({ updatedAt: -1 })
    .populate('productId')
  res.json({ orders })
})

// Driver: history (archive) - default to delivered, optional date filter
router.get('/driver/history', auth, allowRoles('driver'), async (req, res) => {
  const { from = '', to = '' } = req.query || {}
  const match = { deliveryBoy: req.user.id, shipmentStatus: { $in: ['delivered','cancelled'] } }
  if (from) {
    const d = new Date(from)
    if (!Number.isNaN(d.getTime())) match.updatedAt = { ...(match.updatedAt||{}), $gte: d }
  }
  if (to) {
    const d = new Date(to)
    if (!Number.isNaN(d.getTime())) match.updatedAt = { ...(match.updatedAt||{}), $lte: d }
  }
  const orders = await Order.find(match).sort({ updatedAt: -1 }).populate('productId')
  res.json({ orders })
})

// Driver: list orders in my country (optionally filter by city); unassigned only by default
router.get('/driver/available', auth, allowRoles('driver'), async (req, res) => {
  const me = await User.findById(req.user.id).select('country city')
  const { city = '', includeAssigned = 'false' } = req.query || {}
  const cond = { orderCountry: me?.country || '' }
  if (!cond.orderCountry) return res.json({ orders: [] })
  if (city) cond.city = city; else if (me?.city) cond.city = me.city
  if (includeAssigned !== 'true') cond.deliveryBoy = { $in: [null, undefined] }
  const orders = await Order.find(cond).sort({ createdAt: -1 }).populate('productId')
  res.json({ orders })
})

// Driver: claim an unassigned order
router.post('/:id/claim', auth, allowRoles('driver'), async (req, res) => {
  const { id } = req.params
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  if (ord.deliveryBoy) {
    if (String(ord.deliveryBoy) === String(req.user.id)) {
      return res.json({ message: 'Already assigned to you', order: ord })
    }
    return res.status(400).json({ message: 'Order already assigned' })
  }
  const me = await User.findById(req.user.id).select('country city')
  if (ord.orderCountry && me?.country && String(ord.orderCountry) !== String(me.country)) {
    return res.status(400).json({ message: 'Order not in your country' })
  }
  if (ord.city && me?.city && String(ord.city).toLowerCase() !== String(me.city).toLowerCase()) {
    return res.status(400).json({ message: 'Order city does not match your city' })
  }
  ord.deliveryBoy = req.user.id
  if (!ord.shipmentStatus || ord.shipmentStatus === 'pending') ord.shipmentStatus = 'assigned'
  await ord.save()
  await ord.populate('productId')
  emitOrderChange(ord, 'assigned').catch(()=>{})
  res.json({ message: 'Order claimed', order: ord })
})

// Mark shipped (admin, user). Decrement product stock if tracked
router.post('/:id/ship', auth, allowRoles('admin','user'), async (req, res) => {
  const { id } = req.params
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  if (ord.status === 'shipped') return res.json({ message: 'Already shipped', order: ord })

  // Optional shipment updates at ship time
  const { shipmentMethod, courierName, trackingNumber, deliveryBoy, shippingFee, codAmount, collectedAmount } = req.body || {}
  if (shipmentMethod) ord.shipmentMethod = shipmentMethod
  if (courierName != null) ord.courierName = courierName
  if (trackingNumber != null) ord.trackingNumber = trackingNumber
  if (deliveryBoy != null) ord.deliveryBoy = deliveryBoy
  if (shippingFee != null) ord.shippingFee = Math.max(0, Number(shippingFee))
  if (codAmount != null) ord.codAmount = Math.max(0, Number(codAmount))
  if (collectedAmount != null) ord.collectedAmount = Math.max(0, Number(collectedAmount))
  // recompute balance
  ord.balanceDue = Math.max(0, (ord.codAmount||0) - (ord.collectedAmount||0) - (ord.shippingFee||0))

  ord.status = 'shipped'
  if (!ord.shipmentStatus || ord.shipmentStatus === 'pending' || ord.shipmentStatus === 'assigned') ord.shipmentStatus = 'in_transit'
  ord.shippedAt = new Date()
  await ord.save()
  // Broadcast status change
  emitOrderChange(ord, 'shipped').catch(()=>{})
  res.json({ message: 'Order shipped', order: ord })
})

// Update shipment fields and status
router.post('/:id/shipment/update', auth, allowRoles('admin','user','agent','driver'), async (req, res) => {
  const { id } = req.params
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })

  // Drivers: restricted update scope and permissions
  if (req.user.role === 'driver') {
    if (String(ord.deliveryBoy || '') !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not allowed' })
    }
    const { shipmentStatus, deliveryNotes, note } = req.body || {}
    if (shipmentStatus) {
      const allowed = new Set(['no_response', 'attempted', 'contacted', 'picked_up'])
      if (!allowed.has(String(shipmentStatus))) {
        return res.status(400).json({ message: 'Invalid status' })
      }
      ord.shipmentStatus = shipmentStatus
      if (shipmentStatus === 'picked_up') {
        try{ ord.pickedUpAt = new Date() }catch{}
      }
    }
    if (deliveryNotes != null || note != null) ord.deliveryNotes = (note != null ? note : deliveryNotes)
    // Recompute balance
    ord.balanceDue = Math.max(0, (ord.codAmount||0) - (ord.collectedAmount||0) - (ord.shippingFee||0))
    await ord.save()
    emitOrderChange(ord, 'shipment_updated').catch(()=>{})
    return res.json({ message: 'Shipment updated', order: ord })
  }

  // Non-driver roles retain full update capabilities
  const { shipmentMethod, shipmentStatus, courierName, trackingNumber, deliveryBoy, shippingFee, codAmount, collectedAmount, deliveryNotes, returnReason } = req.body || {}
  if (shipmentMethod) ord.shipmentMethod = shipmentMethod
  if (shipmentStatus) ord.shipmentStatus = shipmentStatus
  if (courierName != null) ord.courierName = courierName
  if (trackingNumber != null) ord.trackingNumber = trackingNumber
  if (deliveryBoy != null) ord.deliveryBoy = deliveryBoy
  if (shippingFee != null) ord.shippingFee = Math.max(0, Number(shippingFee))
  if (codAmount != null) ord.codAmount = Math.max(0, Number(codAmount))
  if (collectedAmount != null) ord.collectedAmount = Math.max(0, Number(collectedAmount))
  if (deliveryNotes != null) ord.deliveryNotes = deliveryNotes
  if (returnReason != null) ord.returnReason = returnReason
  ord.balanceDue = Math.max(0, (ord.codAmount||0) - (ord.collectedAmount||0) - (ord.shippingFee||0))
  await ord.save()
  emitOrderChange(ord, 'shipment_updated').catch(()=>{})
  res.json({ message: 'Shipment updated', order: ord })
})

// PATCH endpoint for quick updates (driver assignment, shipment status)
router.patch('/:id', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try {
    const { id } = req.params
    const ord = await Order.findById(id)
    if (!ord) return res.status(404).json({ message: 'Order not found' })
    
    // Access control: user role can only update their workspace orders
    if (req.user.role === 'user') {
      const agents = await User.find({ role: 'agent', createdBy: req.user.id }, { _id: 1 }).lean()
      const managers = await User.find({ role: 'manager', createdBy: req.user.id }, { _id: 1 }).lean()
      const agentIds = agents.map(a => String(a._id))
      const managerIds = managers.map(m => String(m._id))
      const allowedCreators = [String(req.user.id), ...agentIds, ...managerIds]
      if (!allowedCreators.includes(String(ord.createdBy))) {
        return res.status(403).json({ message: 'Not allowed' })
      }
    }
    
    // Update fields
    const { 
      deliveryBoy, shipmentStatus, items, productId, quantity, total, discount, shippingFee,
      customerName, customerPhone, phoneCountryCode, orderCountry, city, customerArea, 
      customerAddress, locationLat, locationLng, customerLocation, details
    } = req.body || {}
    
    // Basic fields
    const previousDriver = ord.deliveryBoy ? String(ord.deliveryBoy) : null
    const newDriver = deliveryBoy !== undefined ? (deliveryBoy || null) : undefined
    if (deliveryBoy !== undefined) ord.deliveryBoy = deliveryBoy || null
    if (customerName !== undefined) ord.customerName = customerName
    if (customerPhone !== undefined) ord.customerPhone = customerPhone
    if (phoneCountryCode !== undefined) ord.phoneCountryCode = phoneCountryCode
    if (orderCountry !== undefined) ord.orderCountry = orderCountry
    if (city !== undefined) ord.city = city
    if (customerArea !== undefined) ord.customerArea = customerArea
    if (customerAddress !== undefined) ord.customerAddress = customerAddress
    if (locationLat !== undefined) ord.locationLat = locationLat
    if (locationLng !== undefined) ord.locationLng = locationLng
    if (customerLocation !== undefined) ord.customerLocation = customerLocation
    if (details !== undefined) ord.details = details
    
    // Products and pricing
    if (items !== undefined && Array.isArray(items)) {
      ord.items = items.map(it => ({
        productId: it.productId,
        quantity: Math.max(1, Number(it.quantity || 1))
      }))
    }
    if (productId !== undefined) ord.productId = productId || null
    if (quantity !== undefined) ord.quantity = Math.max(1, Number(quantity || 1))
    if (total !== undefined) ord.total = Math.max(0, Number(total || 0))
    if (discount !== undefined) ord.discount = Number(discount || 0)
    if (shippingFee !== undefined) ord.shippingFee = Math.max(0, Number(shippingFee || 0))
    
    // Shipment status
    if (shipmentStatus) {
      ord.shipmentStatus = shipmentStatus
      // Auto-set timestamps based on status
      if (shipmentStatus === 'delivered' && !ord.deliveredAt) {
        ord.deliveredAt = new Date()
      }
      if (shipmentStatus === 'picked_up' && !ord.pickedUpAt) {
        ord.pickedUpAt = new Date()
      }
      if (['in_transit', 'shipped'].includes(shipmentStatus) && !ord.shippedAt) {
        ord.shippedAt = new Date()
      }
    }
    
    await ord.save()
    emitOrderChange(ord, 'updated').catch(()=>{})
    
    // Send WhatsApp notification to driver if assigned (non-blocking)
    if (newDriver !== undefined && newDriver && newDriver !== previousDriver) {
      ;(async ()=>{
        try{
          const driver = await User.findById(newDriver).select('firstName lastName phone')
          if (driver && driver.phone) {
            const digits = String(driver.phone||'').replace(/\D/g,'')
            if (digits) {
              const jid = `${digits}@s.whatsapp.net`
              const orderNum = ord.invoiceNumber ? `#${ord.invoiceNumber}` : `Order ${String(ord._id).slice(-5).toUpperCase()}`
              const customerInfo = ord.customerName || 'Customer'
              const address = [ord.customerAddress, ord.customerArea, ord.city, ord.orderCountry].filter(Boolean).join(', ') || 'Address not specified'
              const text = `📦 New Delivery Assignment!\n\nHello ${driver.firstName} ${driver.lastName},\n\nYou have been assigned a new delivery:\n\n🔖 Order: ${orderNum}\n👤 Customer: ${customerInfo}\n📞 Phone: ${ord.customerPhone || 'N/A'}\n📍 Address: ${address}\n\nPlease log in to your dashboard to view full order details and update the delivery status.\n\n🌐 Login: https://web.buysial.com/login\n\nThank you for your service!\nVITALBLAZE Commerce`
              const wa = await getWA()
              await wa.sendText(jid, text)
            }
          }
        }catch(err){
          try { console.error('[order assignment] failed to send WA to driver', err?.message||err) } catch {}
        }
      })()
    }
    
    // Return populated order
    const updated = await Order.findById(id)
      .populate('productId')
      .populate('items.productId')
      .populate('deliveryBoy', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName email role')
    
    res.json({ message: 'Order updated', order: updated })
  } catch (err) {
    console.error('[PATCH order] Error:', err)
    res.status(500).json({ message: err?.message || 'Failed to update order' })
  }
})

// Mark as delivered
router.post('/:id/deliver', auth, allowRoles('admin','user','agent','driver'), async (req, res) => {
  const { id } = req.params
  const { collectedAmount, deliveryNotes, note } = req.body || {}
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  // Permissions: drivers may deliver only their assigned orders; agents only their own created orders
  if (req.user.role === 'driver' && String(ord.deliveryBoy||'') !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  if (req.user.role === 'agent' && String(ord.createdBy||'') !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  if (collectedAmount != null) {
    ord.collectedAmount = Math.max(0, Number(collectedAmount))
  } else {
    // Default collected amount to COD or Total when not provided
    const fallback = (ord.codAmount != null ? Number(ord.codAmount) : (ord.total != null ? Number(ord.total) : 0))
    if (!Number.isNaN(fallback) && (ord.collectedAmount == null || Number(ord.collectedAmount) === 0)){
      ord.collectedAmount = Math.max(0, fallback)
    }
  }
  if (deliveryNotes != null || note != null) ord.deliveryNotes = (note != null ? note : deliveryNotes)
  ord.deliveredAt = new Date()
  ord.shipmentStatus = 'delivered'
  ord.balanceDue = Math.max(0, (ord.codAmount||0) - (ord.collectedAmount||0) - (ord.shippingFee||0))
  // Snapshot agent commission (12% of order value) at delivery in PKR for wallet accounting
  try{
    // FX approximate rates to PKR (fallbacks)
    const FX_PKR = { AED: 76, OMR: 726, SAR: 72, BHD: 830, KWD: 880, QAR: 79, INR: 3.3 }
    let totalVal = 0
    if (ord.total != null && Number.isFinite(Number(ord.total))) {
      totalVal = Number(ord.total)
    } else if (Array.isArray(ord.items) && ord.items.length){
      try{
        const ids = ord.items.map(i=> i.productId).filter(Boolean)
        const prods = await Product.find({ _id: { $in: ids } }).select('price')
        const map = new Map(prods.map(p=> [String(p._id), Number(p.price||0)]))
        totalVal = ord.items.reduce((s,it)=> s + (Number(map.get(String(it.productId))||0) * Math.max(1, Number(it.quantity||1))), 0)
      }catch{}
    } else if (ord.productId){
      try{ const p = await Product.findById(ord.productId).select('price'); totalVal = Number(p?.price||0) * Math.max(1, Number(ord.quantity||1)) }catch{}
    }
    // Determine base currency
    let baseCcy = 'SAR'
    try{ if (ord.productId){ const p = await Product.findById(ord.productId).select('baseCurrency'); baseCcy = p?.baseCurrency || 'SAR' } }catch{}
    const rate = FX_PKR[baseCcy] || FX_PKR.SAR
    const commission = Math.round((totalVal * 0.12) * rate)
    ord.agentCommissionPKR = commission
    ord.agentCommissionComputedAt = new Date()
  }catch{}
  await ord.save()
  // Adjust product inventory on delivery (idempotent). Supports single or multi-item orders.
  try{
    if (!ord.inventoryAdjusted){
      const country = ord.orderCountry
      if (Array.isArray(ord.items) && ord.items.length){
        const ids = ord.items.map(i => i.productId).filter(Boolean)
        const prods = await Product.find({ _id: { $in: ids } })
        const byId = new Map(prods.map(p => [String(p._id), p]))
        for (const it of ord.items){
          const p = byId.get(String(it.productId))
          if (!p) continue
          const qty = Math.max(1, Number(it.quantity||1))
          if (p.stockByCountry){
            const byC = p.stockByCountry
            if (country === 'UAE') byC.UAE = Math.max(0, (byC.UAE || 0) - qty)
            else if (country === 'Oman') byC.Oman = Math.max(0, (byC.Oman || 0) - qty)
            else if (country === 'KSA') byC.KSA = Math.max(0, (byC.KSA || 0) - qty)
            else if (country === 'Bahrain') byC.Bahrain = Math.max(0, (byC.Bahrain || 0) - qty)
            const totalLeft = (byC.UAE||0) + (byC.Oman||0) + (byC.KSA||0) + (byC.Bahrain||0)
            p.stockQty = totalLeft
            p.inStock = totalLeft > 0
          } else if (p.stockQty != null){
            p.stockQty = Math.max(0, (p.stockQty || 0) - qty)
            p.inStock = p.stockQty > 0
          }
          await p.save()
        }
        ord.inventoryAdjusted = true
        ord.inventoryAdjustedAt = new Date()
        await ord.save()
      } else if (ord.productId) {
        const prod = await Product.findById(ord.productId)
        if (prod){
          const qty = Math.max(1, ord.quantity || 1)
          if (prod.stockByCountry){
            const byC = prod.stockByCountry
            if (country === 'UAE') byC.UAE = Math.max(0, (byC.UAE || 0) - qty)
            else if (country === 'Oman') byC.Oman = Math.max(0, (byC.Oman || 0) - qty)
            else if (country === 'KSA') byC.KSA = Math.max(0, (byC.KSA || 0) - qty)
            else if (country === 'Bahrain') byC.Bahrain = Math.max(0, (byC.Bahrain || 0) - qty)
            const totalLeft = (byC.UAE||0) + (byC.Oman||0) + (byC.KSA||0) + (byC.Bahrain||0)
            prod.stockQty = totalLeft
            prod.inStock = totalLeft > 0
          } else if (prod.stockQty != null){
            prod.stockQty = Math.max(0, (prod.stockQty || 0) - qty)
            prod.inStock = prod.stockQty > 0
          }
          await prod.save()
          ord.inventoryAdjusted = true
          ord.inventoryAdjustedAt = new Date()
          await ord.save()
        }
      }
    }
  }catch{}
  emitOrderChange(ord, 'delivered').catch(()=>{})
  res.json({ message: 'Order delivered', order: ord })
})

// Mark as returned
router.post('/:id/return', auth, allowRoles('admin','user','agent'), async (req, res) => {
  const { id } = req.params
  const { reason } = req.body || {}
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  ord.shipmentStatus = 'returned'
  ord.returnReason = reason || ord.returnReason
  await ord.save()
  emitOrderChange(ord, 'returned').catch(()=>{})
  res.json({ message: 'Order returned', order: ord })
})

// Cancel order with reason (admin, user, agent, manager, driver)
router.post('/:id/cancel', auth, allowRoles('admin','user','agent','manager','driver'), async (req, res) => {
  const { id } = req.params
  const { reason } = req.body || {}
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  // Permissions: drivers may cancel only their assigned orders; agents only their own created orders
  if (req.user.role === 'driver' && String(ord.deliveryBoy||'') !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  if (req.user.role === 'agent' && String(ord.createdBy||'') !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  ord.shipmentStatus = 'cancelled'
  if (reason != null) ord.returnReason = String(reason)
  await ord.save()
  emitOrderChange(ord, 'cancelled').catch(()=>{})
  res.json({ message: 'Order cancelled', order: ord })
})

// Settle COD with courier/delivery
router.post('/:id/settle', auth, allowRoles('admin','user'), async (req, res) => {
  const { id } = req.params
  const { receivedFromCourier } = req.body || {}
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  ord.receivedFromCourier = Math.max(0, Number(receivedFromCourier || 0))
  ord.settled = true
  ord.settledAt = new Date()
  ord.settledBy = req.user.id
  await ord.save()
  emitOrderChange(ord, 'settled').catch(()=>{})
  res.json({ message: 'Order settled', order: ord })
})

// Send invoice to customer
// Removed manual send-invoice endpoint

// Helper: Generate invoice HTML
function generateInvoiceHTML(order) {
  const invoiceNumber = order.invoiceNumber || `ORD-${String(order._id).slice(-8).toUpperCase()}`
  const date = new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  
  const items = order.items && order.items.length > 0 
    ? order.items 
    : [{ productId: order.productId, quantity: order.quantity || 1 }]
  
  let itemsHTML = ''
  let subtotal = 0
  
  items.forEach(item => {
    const product = item.productId
    const qty = item.quantity || 1
    const price = Number(product?.price || 0)
    const amount = price * qty
    subtotal += amount
    
    itemsHTML += `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product?.name || 'Product'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${qty}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${price.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${amount.toFixed(2)}</td>
      </tr>
    `
  })
  
  const discount = Number(order.discount || 0)
  const shipping = Number(order.shippingFee || 0)
  const total = Math.max(0, subtotal + shipping - discount)
  const currency = order.productId?.baseCurrency || 'SAR'
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoiceNumber}</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f9fafb;">
      <div style="max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin: 0;">INVOICE</h1>
          <p style="color: #6b7280; margin: 5px 0;">Invoice #${invoiceNumber}</p>
          <p style="color: #6b7280; margin: 5px 0;">${date}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
          <div>
            <h3 style="color: #374151; margin: 0 0 10px 0;">Bill To:</h3>
            <p style="margin: 5px 0;"><strong>${order.customerName || 'Customer'}</strong></p>
            <p style="margin: 5px 0; color: #6b7280;">${order.customerPhone || ''}</p>
            <p style="margin: 5px 0; color: #6b7280;">${order.customerAddress || ''}</p>
            <p style="margin: 5px 0; color: #6b7280;">${[order.customerArea, order.city, order.orderCountry].filter(Boolean).join(', ')}</p>
          </div>
          <div style="text-align: right;">
            <h3 style="color: #374151; margin: 0 0 10px 0;">From:</h3>
            <p style="margin: 5px 0;"><strong>VITALBLAZE Commerce</strong></p>
            <p style="margin: 5px 0; color: #6b7280;">Agent: ${order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : 'N/A'}</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
        
        <div style="text-align: right; margin-bottom: 30px;">
          <div style="display: inline-block; text-align: left; min-width: 300px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280;">Subtotal:</span>
              <span style="font-weight: 600;">${currency} ${subtotal.toFixed(2)}</span>
            </div>
            ${discount > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280;">Discount:</span>
              <span style="color: #059669;">-${currency} ${discount.toFixed(2)}</span>
            </div>
            ` : ''}
            ${shipping > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280;">Shipping:</span>
              <span>${currency} ${shipping.toFixed(2)}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #1f2937; margin-top: 8px;">
              <span style="font-size: 18px; font-weight: 700;">Total:</span>
              <span style="font-size: 18px; font-weight: 700; color: #059669;">${currency} ${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280;">
          <p style="margin: 5px 0;">Thank you for your business!</p>
          <p style="margin: 5px 0; font-size: 14px;">VITALBLAZE Commerce</p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Helper: Convert invoice to WhatsApp text format
function convertInvoiceToText(order) {
  const invoiceNumber = order.invoiceNumber || `ORD-${String(order._id).slice(-8).toUpperCase()}`
  const date = new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  
  const items = order.items && order.items.length > 0 
    ? order.items 
    : [{ productId: order.productId, quantity: order.quantity || 1 }]
  
  let itemsText = ''
  let subtotal = 0
  
  items.forEach(item => {
    const product = item.productId
    const qty = item.quantity || 1
    const price = Number(product?.price || 0)
    const amount = price * qty
    subtotal += amount
    
    itemsText += `\n• ${product?.name || 'Product'}\n  Qty: ${qty} × ${price.toFixed(2)} = ${amount.toFixed(2)}`
  })
  
  const discount = Number(order.discount || 0)
  const shipping = Number(order.shippingFee || 0)
  const total = Math.max(0, subtotal + shipping - discount)
  const currency = order.productId?.baseCurrency || 'SAR'
  
  return `🧾 *INVOICE*

*Invoice #:* ${invoiceNumber}
*Date:* ${date}

━━━━━━━━━━━━━━━━━━━━━

*BILL TO:*
${order.customerName || 'Customer'}
${order.customerPhone || ''}
${order.customerAddress || ''}
${[order.customerArea, order.city, order.orderCountry].filter(Boolean).join(', ')}

━━━━━━━━━━━━━━━━━━━━━

*ITEMS:*${itemsText}

━━━━━━━━━━━━━━━━━━━━━

*Subtotal:* ${currency} ${subtotal.toFixed(2)}${discount > 0 ? `\n*Discount:* -${currency} ${discount.toFixed(2)}` : ''}${shipping > 0 ? `\n*Shipping:* ${currency} ${shipping.toFixed(2)}` : ''}

*TOTAL:* ${currency} ${total.toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━

Thank you for your business!
_VITALBLAZE Commerce_
${order.createdBy ? `Agent: ${order.createdBy.firstName} ${order.createdBy.lastName}` : ''}`
}

export default router

// Analytics: last 7 days sales by country
router.get('/analytics/last7days', auth, allowRoles('admin','user'), async (req, res) => {
  try{
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 6) // include today + previous 6 days
    sevenDaysAgo.setHours(0,0,0,0)

    const docs = await Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $project: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orderCountry: { $ifNull: ['$orderCountry', ''] }
        }
      },
      { $group: { _id: { day: '$day', country: '$orderCountry' }, count: { $sum: 1 } } },
      { $project: { _id: 0, day: '$_id.day', country: '$_id.country', count: 1 } },
      { $sort: { day: 1 } }
    ])

    // Build a response with all 7 days and supported countries
    const countries = ['UAE','Oman','KSA','Bahrain','India','Kuwait','Qatar']
    const days = []
    for (let i=6;i>=0;i--){
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      d.setHours(0,0,0,0)
      const key = d.toISOString().slice(0,10)
      days.push(key)
    }

    const byDay = days.map(day => {
      const entry = { day }
      for (const c of countries) entry[c] = 0
      return entry
    })

    for (const row of docs){
      const idx = byDay.findIndex(x => x.day === row.day)
      if (idx >= 0){
        if (countries.includes(row.country)) byDay[idx][row.country] += row.count
      }
    }

    // Totals per country across 7 days
    const totals = Object.fromEntries(countries.map(c => [c, byDay.reduce((acc, d) => acc + (d[c]||0), 0)]))

    res.json({ days: byDay, totals })
  }catch(err){
    res.status(500).json({ message: 'Failed to load analytics', error: err?.message })
  }
})
