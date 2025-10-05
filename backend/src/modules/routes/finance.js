import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { auth, allowRoles } from '../middleware/auth.js'
import Expense from '../models/Expense.js'
import Order from '../models/Order.js'
import Remittance from '../models/Remittance.js'
import AgentRemit from '../models/AgentRemit.js'
import User from '../models/User.js'
import { getIO } from '../config/socket.js'
import Setting from '../models/Setting.js'
import { generatePayoutReceiptPDF } from '../utils/payoutReceipt.js'

const router = express.Router()

// Multer config for receipt uploads (reuse uploads/ folder)
try{ fs.mkdirSync('uploads', { recursive: true }) }catch{}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    cb(null, `${name}-${Date.now()}${ext}`)
  }
})

// Reject remittance (manager)
router.post('/remittances/:id/reject', auth, allowRoles('user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const r = await Remittance.findById(id)
    if (!r) return res.status(404).json({ message: 'Remittance not found' })
    // Scope: manager assigned OR owner of workspace
    if (req.user.role === 'manager' && String(r.manager) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    if (req.user.role === 'user' && String(r.owner) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    if (r.status !== 'pending') return res.status(400).json({ message: 'Already processed' })
    r.status = 'rejected'
    r.acceptedAt = new Date()
    r.acceptedBy = req.user.id
    await r.save()
    try{ const io = getIO(); io.to(`user:${String(r.driver)}`).emit('remittance.rejected', { id: String(r._id) }) }catch{}
    return res.json({ message: 'Remittance rejected', remittance: r })
  }catch(err){
    return res.status(500).json({ message: 'Failed to reject remittance' })
  }
})

// Set proof verification (manager or owner)
router.post('/remittances/:id/proof', auth, allowRoles('user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const { ok } = req.body || {}
    const r = await Remittance.findById(id)
    if (!r) return res.status(404).json({ message: 'Remittance not found' })
    // Scope: manager assigned OR owner of workspace
    if (req.user.role === 'manager' && String(r.manager) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    if (req.user.role === 'user' && String(r.owner) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    r.proofOk = (ok === true || ok === 'true') ? true : (ok === false || ok === 'false') ? false : null
    await r.save()
    return res.json({ ok:true, remittance: r })
  }catch(err){
    return res.status(500).json({ message: 'Failed to set proof status' })
  }
})
const upload = multer({ storage })

// Create expense (admin, user, agent)
router.post('/expenses', auth, allowRoles('admin','user','agent'), async (req, res) => {
  const { title, category, amount, currency, notes, incurredAt } = req.body || {}
  if (!title || amount == null) return res.status(400).json({ message: 'Missing title or amount' })
  const doc = new Expense({
    title,
    category,
    amount: Math.max(0, Number(amount||0)),
    currency: currency||'SAR',
    notes,
    incurredAt: incurredAt ? new Date(incurredAt) : new Date(),
    createdBy: req.user.id,
  })
  await doc.save()
  return res.status(201).json({ message: 'Expense created', expense: doc })
})

// --- Agent Remittances (Agent -> Approver: user or manager) ---
// Create agent remit request (agent -> owner user)
router.post('/agent-remittances', auth, allowRoles('agent'), async (req, res) => {
  try{
    const { amount, note } = req.body || {}
    if (amount == null) return res.status(400).json({ message: 'amount is required' })
    const me = await User.findById(req.user.id).select('createdBy')
    const ownerId = me?.createdBy
    if (!ownerId) return res.status(400).json({ message: 'No workspace owner' })
    const approverId = ownerId
    const role = 'user'
    // Validate amount against available wallet (delivered commissions at 12% minus sent payouts)
    const fx = { AED: 76, OMR: 726, SAR: 72, BHD: 830, KWD: 880, QAR: 79, INR: 3.3 }
    const orders = await Order.find({ createdBy: req.user.id, shipmentStatus: 'delivered' }).populate('productId','price baseCurrency quantity')
    let deliveredCommissionPKR = 0
    for (const o of orders){
      if (o?.agentCommissionPKR && Number(o.agentCommissionPKR) > 0){
        deliveredCommissionPKR += Number(o.agentCommissionPKR)
        continue
      }
      const totalVal = (o.total!=null ? Number(o.total) : (Number(o?.productId?.price||0) * Math.max(1, Number(o?.quantity||1))))
      const cur = ['AED','OMR','SAR','BHD','KWD','QAR','INR'].includes(String(o?.productId?.baseCurrency)) ? o.productId.baseCurrency : 'SAR'
      const rate = fx[cur] || 0
      deliveredCommissionPKR += totalVal * 0.12 * rate
    }
    // Sum of already sent payouts
    const sentRows = await AgentRemit.aggregate([
      { $match: { agent: new (await import('mongoose')).default.Types.ObjectId(req.user.id), status: 'sent' } },
      { $group: { _id: '$currency', total: { $sum: { $ifNull: ['$amount', 0] } } } }
    ])
    const totalSentPKR = sentRows.reduce((s,r)=> s + (r?._id==='PKR' ? Number(r.total||0) : 0), 0)
    const available = Math.max(0, Math.round(deliveredCommissionPKR) - totalSentPKR)
    const amt = Math.max(0, Number(amount||0))
    if (amt < 10000){
      return res.status(400).json({ message: 'Minimum withdraw amount is PKR 10000' })
    }
    if (amt > available){
      return res.status(400).json({ message: `Amount exceeds available wallet. Available: PKR ${available}` })
    }
    const doc = new AgentRemit({
      agent: req.user.id,
      owner: ownerId,
      approver: approverId,
      approverRole: role,
      amount: amt,
      currency: 'PKR',
      note: note || '',
      status: 'pending',
    })
    await doc.save()
    try{ const io = getIO(); io.to(`user:${String(approverId)}`).emit('agentRemit.created', { id: String(doc._id) }) }catch{}
    return res.status(201).json({ message: 'Request submitted', remit: doc })
  }catch(err){
    return res.status(500).json({ message: 'Failed to submit request' })
  }
})

// List agent remittances
router.get('/agent-remittances', auth, allowRoles('agent','manager','user'), async (req, res) => {
  try{
    let match = {}
    if (req.user.role === 'agent') match.agent = req.user.id
    if (req.user.role === 'manager') match = { approver: req.user.id, approverRole: 'manager' }
    if (req.user.role === 'user') match = { approver: req.user.id, approverRole: 'user' }
    const page = Math.max(1, Number(req.query.page||1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit||20)))
    const skip = (page-1) * limit
    const total = await AgentRemit.countDocuments(match)
    const items = await AgentRemit
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('agent','firstName lastName email phone payoutProfile')
    const hasMore = skip + items.length < total
    return res.json({ remittances: items, page, limit, total, hasMore })
  }catch(err){
    return res.status(500).json({ message: 'Failed to load agent remittances' })
  }
})

// Approve agent remittance (user or manager)
router.post('/agent-remittances/:id/approve', auth, allowRoles('user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const r = await AgentRemit.findById(id)
    if (!r) return res.status(404).json({ message: 'Request not found' })
    if (String(r.approver) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    if (r.status !== 'pending') return res.status(400).json({ message: 'Already processed' })
    r.status = 'approved'
    r.approvedAt = new Date()
    r.approvedBy = req.user.id
    await r.save()
    try{ const io = getIO(); io.to(`user:${String(r.agent)}`).emit('agentRemit.approved', { id: String(r._id) }) }catch{}
    return res.json({ message: 'Approved', remit: r })
  }catch(err){
    return res.status(500).json({ message: 'Failed to approve' })
  }
})

// Mark agent remittance as sent (owner user). Allows sending directly from pending with custom amount.
router.post('/agent-remittances/:id/send', auth, allowRoles('user'), async (req, res) => {
  try{
    const { id } = req.params
    const r = await AgentRemit.findById(id)
    if (!r) return res.status(404).json({ message: 'Request not found' })
    if (String(r.approver) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    const bodyAmt = Number(req.body?.amount ?? r.amount)
    const amt = Math.max(0, bodyAmt)
    if (amt < 10000) return res.status(400).json({ message: 'Minimum amount to send is PKR 10000' })
    // Recompute available for the agent
    const fx = { AED: 76, OMR: 726, SAR: 72, BHD: 830, KWD: 880, QAR: 79, INR: 3.3 }
    const orders = await Order.find({ createdBy: r.agent, shipmentStatus: 'delivered' }).populate('productId','price baseCurrency quantity')
    let deliveredCommissionPKR = 0
    for (const o of orders){
      const totalVal = (o.total!=null ? Number(o.total) : (Number(o?.productId?.price||0) * Math.max(1, Number(o?.quantity||1))))
      const cur = ['AED','OMR','SAR','BHD'].includes(String(o?.productId?.baseCurrency)) ? o.productId.baseCurrency : 'SAR'
      const rate = fx[cur] || 0
      deliveredCommissionPKR += totalVal * 0.12 * rate
    }
    const sentRows = await AgentRemit.aggregate([
      { $match: { agent: new (await import('mongoose')).default.Types.ObjectId(r.agent), status: 'sent' } },
      { $group: { _id: '$currency', total: { $sum: { $ifNull: ['$amount', 0] } } } }
    ])
    const totalSentPKR = sentRows.reduce((s,rr)=> s + (rr?._id==='PKR' ? Number(rr.total||0) : 0), 0)
    const available = Math.max(0, Math.round(deliveredCommissionPKR) - totalSentPKR)
    if (amt > available) return res.status(400).json({ message: `Amount exceeds available wallet. Available: PKR ${available}` })
    // Update remit to sent with specified amount
    r.amount = amt
    r.status = 'sent'
    r.sentAt = new Date()
    r.sentBy = req.user.id
    await r.save()
    // Generate and send PDF receipt via WhatsApp
    try{
      const agent = await User.findById(r.agent).select('firstName lastName phone')
      const pdfPath = await generatePayoutReceiptPDF(agent, amt)
      // Lazy WA import (same pattern as users route)
      const getWA = async ()=>{
        const enabled = process.env.ENABLE_WA !== 'false'
        if (!enabled) return { sendDocument: async ()=> ({ ok:true }) }
        try{ const mod = await import('../services/whatsapp.js'); return mod?.default || mod }catch{ return { sendDocument: async ()=> ({ ok:true }) } }
      }
      const wa = await getWA()
      const digits = String(agent?.phone||'').replace(/\D/g,'')
      if (digits){ await wa.sendDocument(`${digits}@s.whatsapp.net`, pdfPath, 'receipt.pdf', 'Payout Receipt') }
    }catch(e){ try{ console.warn('payout receipt send failed', e?.message||e) }catch{} }
    try{ const io = getIO(); io.to(`user:${String(r.agent)}`).emit('agentRemit.sent', { id: String(r._id) }) }catch{}
    return res.json({ message: 'Sent', remit: r })
  }catch(err){
    return res.status(500).json({ message: 'Failed to mark as sent' })
  }
})

// Agent wallet summary (sum of sent remittances by currency)
router.get('/agent-remittances/wallet', auth, allowRoles('agent'), async (req, res) => {
  try{
    const rows = await AgentRemit.aggregate([
      { $match: { agent: new (await import('mongoose')).default.Types.ObjectId(req.user.id), status: 'sent' } },
      { $group: { _id: '$currency', total: { $sum: { $ifNull: ['$amount', 0] } } } }
    ])
    const byCurrency = {}
    for (const r of rows){ byCurrency[r._id || ''] = r.total }
    return res.json({ byCurrency })
  }catch(err){
    return res.status(500).json({ message: 'Failed to load wallet' })
  }
})
 

// List expenses (admin => all; user => own+agents; agent => own)
router.get('/expenses', auth, allowRoles('admin','user','agent'), async (req, res) => {
  let match = {}
  if (req.user.role === 'admin') {
    match = {}
  } else if (req.user.role === 'user'){
    const User = (await import('../models/User.js')).default
    const agents = await User.find({ role:'agent', createdBy: req.user.id }, { _id:1 }).lean()
    const ids = agents.map(a=>a._id.toString())
    match = { createdBy: { $in: [req.user.id, ...ids] } }
  } else {
    match = { createdBy: req.user.id }
  }
  const items = await Expense.find(match).sort({ incurredAt: -1 })
  const total = items.reduce((a,b)=> a + Number(b.amount||0), 0)
  res.json({ expenses: items, total })
})

// Transactions: derive from orders and expenses
router.get('/transactions', auth, allowRoles('admin','user'), async (req, res) => {
  // Optional: ?start=ISO&end=ISO
  const start = req.query.start ? new Date(req.query.start) : null
  const end = req.query.end ? new Date(req.query.end) : null

  // scope orders
  let matchOrders = {}
  if (start || end){ matchOrders.createdAt = {} ; if (start) matchOrders.createdAt.$gte = start ; if (end) matchOrders.createdAt.$lte = end }
  if (req.user.role === 'user'){
    const User = (await import('../models/User.js')).default
    const agents = await User.find({ role:'agent', createdBy: req.user.id }, { _id:1 }).lean()
    const ids = agents.map(a=>a._id)
    matchOrders.createdBy = { $in: [req.user.id, ...ids] }
  }
  const orders = await Order.find(matchOrders).lean()

  // scope expenses
  let matchExp = {}
  if (start || end){ matchExp.incurredAt = {} ; if (start) matchExp.incurredAt.$gte = start ; if (end) matchExp.incurredAt.$lte = end }
  if (req.user.role === 'user'){
    const User = (await import('../models/User.js')).default
    const agents = await User.find({ role:'agent', createdBy: req.user.id }, { _id:1 }).lean()
    const ids = agents.map(a=>a._id)
    matchExp.createdBy = { $in: [req.user.id, ...ids] }
  }
  const expenses = await Expense.find(matchExp).lean()

  // Build transactions
  const tx = []
  for (const o of orders){
    // credit: money received from courier on settlement OR collected cash on delivery
    if (o.settled && o.receivedFromCourier > 0){
      tx.push({ date: o.settledAt || o.updatedAt || o.createdAt, type:'credit', source:'settlement', ref:`ORD-${o._id}`, amount: Number(o.receivedFromCourier||0), currency:'SAR', notes:'Courier settlement' })
    } else if ((o.collectedAmount||0) > 0 && String(o.shipmentStatus||'').toLowerCase()==='delivered'){
      tx.push({ date: o.deliveredAt || o.updatedAt || o.createdAt, type:'credit', source:'delivery', ref:`ORD-${o._id}`, amount: Number(o.collectedAmount||0), currency:'SAR', notes:'COD collected' })
    }
    // debits: shipping fee
    if ((o.shippingFee||0) > 0){
      tx.push({ date: o.updatedAt || o.createdAt, type:'debit', source:'shipping', ref:`ORD-${o._id}`, amount: Number(o.shippingFee||0), currency:'SAR', notes:'Shipping cost' })
    }
  }
  for (const e of expenses){
    tx.push({ date: e.incurredAt || e.createdAt, type:'debit', source:'expense', ref:`EXP-${e._id}`, amount: Number(e.amount||0), currency: e.currency||'SAR', notes: e.title })
  }

  tx.sort((a,b)=> new Date(b.date) - new Date(a.date))

  const totals = tx.reduce((acc, t)=>{
    if (t.type==='credit') acc.credits += t.amount; else acc.debits += t.amount; acc.net = acc.credits - acc.debits; return acc
  }, { credits:0, debits:0, net:0 })

  res.json({ transactions: tx, totals })
})

// --- Remittances (Driver -> Manager) ---
// Helper: currency by country
function currencyFromCountry(country){
  const map = {
    'KSA':'SAR', 'Saudi Arabia':'SAR', 'SA':'SAR',
    'UAE':'AED', 'AE':'AED',
    'Oman':'OMR', 'OM':'OMR',
    'Bahrain':'BHD', 'BH':'BHD',
    'India':'INR', 'IN':'INR',
    'Kuwait':'KWD', 'KW':'KWD',
    'Qatar':'QAR', 'QA':'QAR'
  }
  const key = String(country||'').trim()
  return map[key] || ''
}

// List remittances in scope (Driver -> Manager)
router.get('/remittances', auth, allowRoles('admin','user','manager','driver'), async (req, res) => {
  try{
    let match = {}
    if (req.user.role === 'admin'){
      // no extra scoping
    } else if (req.user.role === 'user'){
      match.owner = req.user.id
    } else if (req.user.role === 'manager'){
      match.manager = req.user.id
    } else if (req.user.role === 'driver'){
      match.driver = req.user.id
    }
    const page = Math.max(1, Number(req.query.page||1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit||20)))
    const skip = (page-1) * limit
    const total = await Remittance.countDocuments(match)
    const items = await Remittance
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('driver','firstName lastName email country')
      .populate('manager','firstName lastName email country role')
    const hasMore = skip + items.length < total
    return res.json({ remittances: items, page, limit, total, hasMore })
  }catch(err){
    return res.status(500).json({ message: 'Failed to list remittances' })
  }
})

// Create remittance (driver)
router.post('/remittances', auth, allowRoles('driver'), upload.any(), async (req, res) => {
  try{
    const { managerId = '', amount, fromDate, toDate, note = '', method = 'hand', paidToName = '' } = req.body || {}
    if (amount == null) return res.status(400).json({ message: 'amount is required' })
    const me = await User.findById(req.user.id).select('createdBy country')
    const ownerId = String(me?.createdBy || '')
    if (!ownerId) return res.status(400).json({ message: 'No workspace owner' })
    // Determine approver: manager if provided and valid, else owner
    let managerRef = ownerId
    let mgrDoc = null
    if (managerId){
      const mgr = await User.findById(managerId)
      if (!mgr || mgr.role !== 'manager') return res.status(400).json({ message: 'Manager not found' })
      if (String(mgr.createdBy) !== ownerId){ return res.status(403).json({ message: 'Manager not in your workspace' }) }
      managerRef = String(mgr._id)
      mgrDoc = mgr
    }
    // Do not allow submitting a new remittance while another one is pending
    const existingPending = await Remittance.findOne({ driver: req.user.id, status: 'pending' }).select('_id amount createdAt')
    if (existingPending){
      return res.status(400).json({ 
        message: 'You already have a pending remittance awaiting approval. Please wait until it is accepted or rejected.',
        pending: { id: String(existingPending._id), amount: Number(existingPending.amount||0), createdAt: existingPending.createdAt }
      })
    }
    // Validate available pending amount: COLLECTED amounts - accepted remittances
    // Compute delivered collected amount for this driver (prefer collectedAmount, fallback to totals/prices)
    const deliveredOrders = await Order
      .find({ deliveryBoy: req.user.id, shipmentStatus: 'delivered' })
      .select('total collectedAmount productId quantity items')
      .populate('productId','price')
      .populate('items.productId','price')
    const totalCollectedAmount = deliveredOrders.reduce((sum, o)=>{
      let val = 0
      if (o?.collectedAmount != null && Number(o.collectedAmount) > 0){
        val = Number(o.collectedAmount)||0
      } else if (o?.total != null){
        val = Number(o.total)||0
      } else if (Array.isArray(o?.items) && o.items.length){
        val = o.items.reduce((s,it)=> s + (Number(it?.productId?.price||0) * Math.max(1, Number(it?.quantity||1))), 0)
      } else {
        const unit = Number(o?.productId?.price||0)
        const qty = Math.max(1, Number(o?.quantity||1))
        val = unit * qty
      }
      return sum + val
    }, 0)
    const M = (await import('mongoose')).default
    const remitRows = await Remittance.aggregate([
      { $match: { driver: new M.Types.ObjectId(req.user.id), status: 'accepted' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } }
    ])
    const deliveredToCompany = remitRows && remitRows[0] ? Number(remitRows[0].total||0) : 0
    const pendingToCompany = Math.max(0, totalCollectedAmount - deliveredToCompany)
    const amt = Math.max(0, Number(amount||0))
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'Invalid amount' })
    if (amt > pendingToCompany) return res.status(400).json({ message: `Amount exceeds pending. Pending: ${pendingToCompany.toFixed(2)}` })
    // Optional country match
    if (mgrDoc && me?.country && mgrDoc?.country && String(me.country) !== String(mgrDoc.country)){
      return res.status(400).json({ message: 'Manager country must match your country' })
    }
    // Compute delivered orders count in range for this driver
    const matchOrders = { deliveryBoy: req.user.id, shipmentStatus: 'delivered' }
    if (fromDate || toDate){
      matchOrders.deliveredAt = {}
      if (fromDate) matchOrders.deliveredAt.$gte = new Date(fromDate)
      if (toDate) matchOrders.deliveredAt.$lte = new Date(toDate)
    }
    const totalDeliveredOrders = await Order.countDocuments(matchOrders)
    // Extract receipt file (any image)
    const files = Array.isArray(req.files) ? req.files : []
    const receiptFile = files.find(f=> ['receipt','proof','screenshot','file','image'].includes(String(f.fieldname||'').toLowerCase())) || files[0]
    const receiptPath = receiptFile ? `/uploads/${receiptFile.filename}` : ''
    if (String(method||'').toLowerCase() === 'transfer' && !receiptPath){
      return res.status(400).json({ message: 'Proof image is required for transfer method' })
    }

    const doc = new Remittance({
      driver: req.user.id,
      manager: managerRef,
      owner: ownerId,
      country: me?.country || '',
      currency: currencyFromCountry(me?.country || ''),
      amount: Math.max(0, Number(amount||0)),
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      totalDeliveredOrders,
      note: note || '',
      method: (String(method||'hand').toLowerCase()==='transfer' ? 'transfer' : 'hand'),
      paidToName: String(paidToName||'').trim(),
      receiptPath,
      status: 'pending',
    })
    await doc.save()
    try{ const io = getIO(); io.to(`user:${String(managerRef)}`).emit('remittance.created', { id: String(doc._id) }) }catch{}
    return res.status(201).json({ message: 'Remittance submitted', remittance: doc })
  }catch(err){
    return res.status(500).json({ message: 'Failed to submit remittance' })
  }
})

// Accept remittance (manager)
router.post('/remittances/:id/accept', auth, allowRoles('user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const r = await Remittance.findById(id)
    if (!r) return res.status(404).json({ message: 'Remittance not found' })
    // Scope: manager assigned OR owner of workspace
    if (req.user.role === 'manager' && String(r.manager) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    if (req.user.role === 'user' && String(r.owner) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    if (r.status !== 'pending') return res.status(400).json({ message: 'Already processed' })
    r.status = 'accepted'
    r.acceptedAt = new Date()
    r.acceptedBy = req.user.id
    await r.save()
    try{ const io = getIO(); io.to(`user:${String(r.driver)}`).emit('remittance.accepted', { id: String(r._id) }) }catch{}
    return res.json({ message: 'Remittance accepted', remittance: r })
  }catch(err){
    return res.status(500).json({ message: 'Failed to accept remittance' })
  }
})

// Summary for driver: total delivered and collected in period
router.get('/remittances/summary', auth, allowRoles('driver'), async (req, res) => {
  try{
    const { fromDate = '', toDate = '' } = req.query || {}
    const M = (await import('mongoose')).default
    const match = { deliveryBoy: new M.Types.ObjectId(req.user.id), shipmentStatus: 'delivered' }
    if (fromDate || toDate){
      match.deliveredAt = {}
      if (fromDate) match.deliveredAt.$gte = new Date(fromDate)
      if (toDate) match.deliveredAt.$lte = new Date(toDate)
    }
    const deliveredOrders2 = await Order
      .find(match)
      .select('collectedAmount total productId quantity items')
      .populate('productId','price')
      .populate('items.productId','price')
    const totalDeliveredOrders = deliveredOrders2.length
    const totalDeliveredValue = deliveredOrders2.reduce((sum, o)=>{
      let val = 0
      if (o?.collectedAmount != null && Number(o.collectedAmount) > 0){
        val = Number(o.collectedAmount)||0
      } else if (o?.total != null){
        val = Number(o.total)||0
      } else if (Array.isArray(o?.items) && o.items.length){
        val = o.items.reduce((s,it)=> s + (Number(it?.productId?.price||0) * Math.max(1, Number(it?.quantity||1))), 0)
      } else {
        const unit = Number(o?.productId?.price||0)
        const qty = Math.max(1, Number(o?.quantity||1))
        val = unit * qty
      }
      return sum + val
    }, 0)
    const me = await User.findById(req.user.id).select('country')
    const currency = currencyFromCountry(me?.country || '')
    const out = { totalDeliveredOrders, totalCollectedAmount: totalDeliveredValue }
    // Sum of remittances already accepted (delivered to company)
    const remitRows = await Remittance.aggregate([
      { $match: { driver: new M.Types.ObjectId(req.user.id), status: 'accepted' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } }
    ])
    const deliveredToCompany = remitRows && remitRows[0] ? Number(remitRows[0].total||0) : 0
    const pendingToCompany = Math.max(0, Number(out.totalCollectedAmount||0) - deliveredToCompany)
    // Cancelled count
    const totalCancelledOrders = await Order.countDocuments({ deliveryBoy: new M.Types.ObjectId(req.user.id), shipmentStatus: 'cancelled' })
    return res.json({ ...out, currency, deliveredToCompany, pendingToCompany, totalCancelledOrders })
  }catch(err){
    return res.status(500).json({ message: 'Failed to load summary' })
  }
})

// Commission summary per agent for owner (admin/user)
router.get('/agents/commission', auth, allowRoles('admin','user'), async (req, res) => {
  try{
    // Find agents under this owner (or all if admin)
    let agentCond = { role: 'agent' }
    if (req.user.role !== 'admin') agentCond.createdBy = req.user.id
    const agents = await User.find(agentCond, 'firstName lastName phone _id payoutProfile').lean()
    const fx = { AED: 76, OMR: 726, SAR: 72, BHD: 830, KWD: 880, QAR: 79, INR: 3.3 }
    const out = []
    for (const a of agents){
      const orders = await Order.find({ createdBy: a._id }).populate('productId','price baseCurrency quantity')
      let deliveredCommissionPKR = 0
      let upcomingCommissionPKR = 0
      for (const o of orders){
        const isDelivered = String(o?.shipmentStatus||'').toLowerCase() === 'delivered'
        const isCancelled = ['cancelled','returned'].includes(String(o?.shipmentStatus||'').toLowerCase())
        if (isCancelled) continue
        let pkr = 0
        if (isDelivered && o?.agentCommissionPKR && Number(o.agentCommissionPKR) > 0){
          pkr = Number(o.agentCommissionPKR)
        } else {
          const totalVal = (o.total!=null ? Number(o.total) : (Number(o?.productId?.price||0) * Math.max(1, Number(o?.quantity||1))))
          const cur = ['AED','OMR','SAR','BHD','KWD','QAR','INR'].includes(String(o?.productId?.baseCurrency)) ? o.productId.baseCurrency : 'SAR'
          const rate = fx[cur] || 0
          pkr = totalVal * 0.12 * rate
        }
        if (isDelivered) deliveredCommissionPKR += pkr; else upcomingCommissionPKR += pkr
      }
      deliveredCommissionPKR = Math.round(deliveredCommissionPKR)
      upcomingCommissionPKR = Math.round(upcomingCommissionPKR)
      // Sent (withdrawn)
      const sentRows = await AgentRemit.aggregate([
        { $match: { agent: new (await import('mongoose')).default.Types.ObjectId(a._id), status: 'sent' } },
        { $group: { _id: '$currency', total: { $sum: { $ifNull: ['$amount', 0] } } } }
      ])
      const withdrawnPKR = sentRows.reduce((s,r)=> s + (r?._id==='PKR' ? Number(r.total||0) : 0), 0)
      // Pending requests amount
      const pendRows = await AgentRemit.aggregate([
        { $match: { agent: new (await import('mongoose')).default.Types.ObjectId(a._id), status: 'pending' } },
        { $group: { _id: '$currency', total: { $sum: { $ifNull: ['$amount', 0] } } } }
      ])
      const pendingPKR = pendRows.reduce((s,r)=> s + (r?._id==='PKR' ? Number(r.total||0) : 0), 0)
      out.push({
        id: String(a._id),
        name: `${a.firstName||''} ${a.lastName||''}`.trim(),
        phone: a.phone||'',
        payoutProfile: a.payoutProfile || {},
        deliveredCommissionPKR,
        upcomingCommissionPKR,
        withdrawnPKR,
        pendingPKR,
      })
    }
    return res.json({ agents: out })
  }catch(err){
    return res.status(500).json({ message: 'Failed to compute commission' })
  }
})

// Send a manual payout receipt PDF to an agent (owner). Does not alter balances.
router.post('/agents/:id/send-manual-receipt', auth, allowRoles('user','admin'), async (req, res) => {
  try{
    const { id } = req.params
    const { amount, note } = req.body || {}
    const agent = await User.findById(id).select('firstName lastName phone createdBy')
    if (!agent || agent.role !== 'agent') return res.status(404).json({ message: 'Agent not found' })
    if (req.user.role !== 'admin' && String(agent.createdBy) !== String(req.user.id)){
      return res.status(403).json({ message: 'Not allowed' })
    }
    const amt = Math.max(0, Number(amount||0))
    if (!Number.isFinite(amt) || amt <= 0){
      return res.status(400).json({ message: 'Invalid amount' })
    }
    // Generate PDF
    const pdfPath = await generatePayoutReceiptPDF(agent, amt)
    // Send via WhatsApp
    try{
      const getWA = async () => {
        const enabled = process.env.ENABLE_WA !== 'false'
        if (!enabled) return { sendDocument: async ()=> ({ ok:true }), sendText: async ()=> ({ ok:true }) }
        try{ const mod = await import('../services/whatsapp.js'); return mod?.default || mod }catch{ return { sendDocument: async ()=> ({ ok:true }), sendText: async ()=> ({ ok:true }) } }
      }
      const wa = await getWA()
      const digits = String(agent?.phone||'').replace(/\D/g,'')
      if (digits){
        const jid = `${digits}@s.whatsapp.net`
        if ((note||'').trim()){
          try{ await wa.sendText(jid, `Manual payout receipt\nAmount: PKR ${amt.toLocaleString()}\n${note}`) }catch{}
        }
        await wa.sendDocument(jid, pdfPath, 'receipt.pdf', 'Manual Payout Receipt')
      }
    }catch(e){ try{ console.warn('manual receipt send failed', e?.message||e) }catch{} }
    return res.json({ ok:true, message: 'Manual receipt sent' })
  }catch(err){
    return res.status(500).json({ message: 'Failed to send manual receipt' })
  }
})

export default router

// --- Compatibility alias endpoints expected by frontend ---
// GET /api/finance/drivers/summary — owner/manager overview per driver
router.get('/drivers/summary', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try{
    // Scope drivers by workspace (owner)
    let driverCond = { role: 'driver' }
    if (req.user.role === 'user') driverCond.createdBy = req.user.id
    if (req.user.role === 'manager') driverCond.createdBy = req.user.createdBy || req.user.id
    const page = Math.max(1, Number(req.query.page||1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit||20)))
    const skip = (page-1) * limit
    const total = await User.countDocuments(driverCond)
    const drivers = await User.find(driverCond, 'firstName lastName phone _id country').skip(skip).limit(limit).lean()

    // Aggregate basic stats from orders and remittances per driver in their local currency
    const out = []
    const M = (await import('mongoose')).default
    for (const d of drivers){
      const currency = currencyFromCountry(d?.country || '') || 'SAR'
      const matchBase = { deliveryBoy: d._id }
      const assigned = await Order.countDocuments(matchBase)
      const canceled = await Order.countDocuments({ ...matchBase, shipmentStatus: 'cancelled' })
      const deliveredCount = await Order.countDocuments({ ...matchBase, shipmentStatus: 'delivered' })
      // Delivered total value (not collectedAmount)
      const deliveredOrders3 = await Order
        .find({ ...matchBase, shipmentStatus: 'delivered' })
        .select('collectedAmount total productId quantity items')
        .populate('productId','price')
        .populate('items.productId','price')
      const collected = deliveredOrders3.reduce((sum, o)=>{
        let val = 0
        if (o?.collectedAmount != null && Number(o.collectedAmount) > 0){
          val = Number(o.collectedAmount)||0
        } else if (o?.total != null){
          val = Number(o.total)||0
        } else if (Array.isArray(o?.items) && o.items.length){
          val = o.items.reduce((s,it)=> s + (Number(it?.productId?.price||0) * Math.max(1, Number(it?.quantity||1))), 0)
        } else {
          const unit = Number(o?.productId?.price||0)
          const qty = Math.max(1, Number(o?.quantity||1))
          val = unit * qty
        }
        return sum + val
      }, 0)
      // Delivered to company comes from accepted remittances
      const remitRows = await Remittance.aggregate([
        { $match: { driver: new M.Types.ObjectId(d._id), status: 'accepted' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } }
      ])
      const deliveredToCompany = remitRows && remitRows[0] ? Number(remitRows[0].total||0) : 0
      const pendingToCompany = Math.max(0, collected - deliveredToCompany)
      out.push({
        id: String(d._id),
        name: `${d.firstName||''} ${d.lastName||''}`.trim(),
        phone: d.phone||'',
        currency,
        assigned,
        canceled,
        deliveredCount,
        collected: Math.round(collected),
        deliveredToCompany: Math.round(deliveredToCompany),
        pendingToCompany: Math.round(pendingToCompany),
      })
    }
    const hasMore = skip + drivers.length < total
    return res.json({ drivers: out, page, limit, total, hasMore })
  }catch(err){
    return res.status(500).json({ message: 'Failed to compute drivers summary' })
  }
})

// GET /api/finance/driver-remittances — alias to remittances list within scope
router.get('/driver-remittances', auth, allowRoles('admin','user','manager','driver'), async (req, res) => {
  try{
    let match = {}
    if (req.user.role === 'user') match.owner = req.user.id
    if (req.user.role === 'manager') match.manager = req.user.id
    if (req.user.role === 'driver') match.driver = req.user.id
    const page = Math.max(1, Number(req.query.page||1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit||20)))
    const skip = (page-1) * limit
    const total = await Remittance.countDocuments(match)
    const items = await Remittance
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('driver','firstName lastName phone country payoutProfile')
      .populate('manager','firstName lastName email')
    const hasMore = skip + items.length < total
    return res.json({ remittances: items, page, limit, total, hasMore })
  }catch(err){
    return res.status(500).json({ message: 'Failed to load driver remittances' })
  }
})

// POST /api/finance/driver-remittances/:id/send — mark as accepted and (optionally) adjust amount
router.post('/driver-remittances/:id/send', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const r = await Remittance.findById(id)
    if (!r) return res.status(404).json({ message: 'Remittance not found' })
    // Owner or manager in scope
    if (req.user.role === 'user' && String(r.owner) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    if (req.user.role === 'manager' && String(r.manager) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    const bodyAmt = Number(req.body?.amount ?? r.amount)
    const amt = Math.max(0, bodyAmt)
    r.amount = amt
    r.status = 'accepted'
    r.acceptedAt = new Date()
    r.acceptedBy = req.user.id
    await r.save()
    return res.json({ ok:true, remit: r })
  }catch(err){
    return res.status(500).json({ message: 'Failed to send to driver' })
  }
})

// Company payout profile (visible to drivers). Global setting for now.
router.get('/company/payout-profile', auth, allowRoles('admin','user','manager','driver'), async (req, res) => {
  try{
    const doc = await Setting.findOne({ key: 'companyPayout' }).lean()
    const value = (doc && doc.value) || null
    return res.json({ profile: value })
  }catch(err){
    return res.status(500).json({ message: 'Failed to load company profile' })
  }
})

router.post('/company/payout-profile', auth, allowRoles('admin','user'), async (req, res) => {
  try{
    const { method='bank', accountName='', bankName='', iban='', accountNumber='', phoneNumber='' } = req.body || {}
    let doc = await Setting.findOne({ key: 'companyPayout' })
    if (!doc) doc = new Setting({ key: 'companyPayout', value: {} })
    doc.value = { method, accountName, bankName, iban, accountNumber, phoneNumber }
    await doc.save()
    return res.json({ ok:true })
  }catch(err){
    return res.status(500).json({ message: 'Failed to save company profile' })
  }
})
