import { Router } from 'express';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { auth, allowRoles } from '../middleware/auth.js';
import { getIO } from '../config/socket.js';
// Lazy WhatsApp import to avoid startup crashes when WA is disabled or deps missing
async function getWA(){
  const enabled = process.env.ENABLE_WA !== 'false'
  if (!enabled) return { sendText: async ()=> ({ ok:true }) }
  try{
    const mod = await import('../services/whatsapp.js')
    return mod?.default || mod
  }catch(_e){
    return { sendText: async ()=> ({ ok:true }) }
  }
}
import ChatAssignment from '../models/ChatAssignment.js'
import Order from '../models/Order.js'
import mongoose from 'mongoose'
import { createNotification } from '../routes/notifications.js';

const router = Router();

// Generate a reasonably strong temporary password for resend flows
function generateTempPassword(len = 10){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#'
  let out = ''
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)]
  return out
}

// List users (admin)
router.get('/', auth, allowRoles('admin'), async (req, res) => {
  const users = await User.find({}, '-password').sort({ createdAt: -1 });
  res.json({ users });
});

// Create user (admin)
router.post('/', auth, allowRoles('admin'), async (req, res) => {
  const { firstName, lastName, email, phone, country, password, role = 'user' } = req.body;
  if (!firstName || !lastName || !email || !password) return res.status(400).json({ message: 'Missing required fields' });
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already in use' });
  const createdBy = req.user?.id;
  const user = new User({ firstName, lastName, email, phone, country, password, role, createdBy });
  await user.save();
  res.status(201).json({ message: 'User created', user: { id: user._id, firstName, lastName, email, phone, country, role } });
});

// Create agent (admin, user, manager with permission)
router.post('/agents', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { firstName, lastName, email, phone, password } = req.body || {}
  if (!firstName || !lastName || !email || !password) return res.status(400).json({ message: 'Missing required fields' })
  // Phone is required and must be from allowed countries (UAE, Oman, KSA, Bahrain)
  if (!phone || !String(phone).trim()){
    return res.status(400).json({ message: 'Phone number is required' })
  }
  {
    const allowedCodes = ['+971', '+968', '+966', '+973', '+92', '+965', '+974', '+91']
    const phoneClean = String(phone).replace(/\s/g, '')
    const isAllowedCountry = allowedCodes.some(code => phoneClean.startsWith(code))
    if (!isAllowedCountry) {
      return res.status(400).json({ message: 'Phone number must be from UAE (+971), Oman (+968), KSA (+966), Bahrain (+973), Pakistan (+92), Kuwait (+965), Qatar (+974), or India (+91)' })
    }
  }
  const exists = await User.findOne({ email })
  if (exists) return res.status(400).json({ message: 'Email already in use' })
  let createdBy = req.user?.id
  if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('managerPermissions createdBy')
    if (!mgr || !mgr.managerPermissions?.canCreateAgents){
      return res.status(403).json({ message: 'Manager not allowed to create agents' })
    }
    // Attribute agents to the owner so they appear under the user workspace
    createdBy = mgr.createdBy || req.user.id
  }
  const agent = new User({ firstName, lastName, email, phone, password, role: 'agent', createdBy })
  await agent.save()
  
  // Create notification for agent creation
  try {
    await createNotification({
      userId: createdBy,
      type: 'user_created',
      title: 'New Agent Created',
      message: `Agent ${firstName} ${lastName} (${email}) has been created`,
      relatedId: agent._id,
      relatedType: 'User',
      triggeredBy: req.user.id,
      triggeredByRole: req.user.role
    });
  } catch (err) {
    console.error('Failed to create agent notification:', err);
  }
  
  // Try to send WhatsApp welcome message (non-blocking)
  ;(async ()=>{
    try{
      const digits = String(phone||'').replace(/\D/g,'')
      if (digits) {
        const jid = `${digits}@s.whatsapp.net`
        const text = `🌟 Welcome to VITALBLAZE Commerce!\n\nDear ${firstName} ${lastName},\n\nWe’re excited to have you on board as part of our growing community. Your account has been successfully created. Please find your login details below:\n\n🌐 Login URL: https://web.buysial.com/login\n\n👤 Email: ${email}\n🔑 Password: ${password}\n\nOnce logged in, you’ll be able to access all features of VITALBLAZE Commerce and benefit from the exclusive opportunities available through our platform.\n\n🚀 Get ready — tutorials and guides will be shared with you soon to help you launch your business and maximize results.\n\nIf you face any issues signing in, please reach out to our support team.\n\nWelcome to the future of smart commerce with VITALBLAZE!`
        const wa = await getWA()
        try{
          await wa.sendText(jid, text)
          try{ await User.updateOne({ _id: agent._id }, { $set: { welcomeSent: true, welcomeSentAt: new Date(), welcomeError: '' } }) }catch{}
        }catch(e){
          const msg = e?.message || 'send-failed'
          try{ await User.updateOne({ _id: agent._id }, { $set: { welcomeSent: false, welcomeError: String(msg).slice(0,300) } }) }catch{}
          throw e
        }
      } else {
        try{ await User.updateOne({ _id: agent._id }, { $set: { welcomeSent: false, welcomeError: 'no-phone' } }) }catch{}
      }
    }catch(err){
      try { console.error('[agents] failed to send welcome WA', err?.message||err) } catch {}
    }
  })()
  res.status(201).json({ message: 'Agent created', user: { id: agent._id, firstName, lastName, email, phone, role: 'agent' } })
})

// List agents (admin => all, user => own, manager => owner's agents)
router.get('/agents', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { q = '' } = req.query || {}
  const base = { role: 'agent' }
  if (req.user.role === 'admin'){
    // no scoping
  } else if (req.user.role === 'user'){
    base.createdBy = req.user.id
  } else if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('createdBy')
    base.createdBy = mgr?.createdBy || '__none__'
  }
  const text = q.trim()
  const cond = text ? { ...base, $or: [
    { firstName: { $regex: text, $options: 'i' } },
    { lastName: { $regex: text, $options: 'i' } },
    { email: { $regex: text, $options: 'i' } },
    { phone: { $regex: text, $options: 'i' } },
  ] } : base
  const users = await User.find(cond, '-password').sort({ createdAt: -1 })
  res.json({ users })
})

// Resend welcome WhatsApp message for an agent (admin/user/manager within scope)
router.post('/agents/:id/resend-welcome', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const agent = await User.findOne({ _id: id, role: 'agent' })
    if (!agent) return res.status(404).json({ message: 'Agent not found' })
    if (req.user.role !== 'admin'){
      let ownerId = req.user.id
      if (req.user.role === 'manager'){
        const mgr = await User.findById(req.user.id).select('managerPermissions createdBy')
        if (!mgr?.managerPermissions?.canCreateAgents){
          return res.status(403).json({ message: 'Manager not allowed' })
        }
        ownerId = String(mgr.createdBy || req.user.id)
      }
      if (String(agent.createdBy) !== String(ownerId)){
        return res.status(403).json({ message: 'Not allowed' })
      }
    }
    const digits = String(agent.phone||'').replace(/\D/g,'')
    if (!digits){
      try{ await User.updateOne({ _id: agent._id }, { $set: { welcomeSent: false, welcomeError: 'no-phone' } }) }catch{}
      return res.status(400).json({ ok:false, message: 'no-phone' })
    }
    // Regenerate a new temporary password for secure resend
    const fresh = await User.findById(agent._id)
    const tempPassword = generateTempPassword(10)
    fresh.password = tempPassword
    await fresh.save()
    const jid = `${digits}@s.whatsapp.net`
    const text = `🌟 Welcome to VITALBLAZE Commerce!\n\nDear ${fresh.firstName} ${fresh.lastName},\n\nYour account details have been updated. Please find your login details below:\n\n🌐 Login URL: https://web.buysial.com/login\n\n👤 Email: ${fresh.email}\n🔑 Password: ${tempPassword}\n\nOnce logged in, you’ll be able to access all features of VITALBLAZE Commerce and benefit from the exclusive opportunities available through our platform.\n\nIf you face any issues signing in, please reach out to our support team.`
    const wa = await getWA()
    try{
      await wa.sendText(jid, text)
      try{ await User.updateOne({ _id: agent._id }, { $set: { welcomeSent: true, welcomeSentAt: new Date(), welcomeError: '' } }) }catch{}
      const sansPassword = await User.findById(agent._id, '-password')
      return res.json({ ok:true, user: sansPassword })
    }catch(e){
      const msg = e?.message || 'send-failed'
      try{ await User.updateOne({ _id: agent._id }, { $set: { welcomeSent: false, welcomeError: String(msg).slice(0,300) } }) }catch{}
      return res.status(500).json({ ok:false, message: msg })
    }
  }catch(err){
    return res.status(500).json({ message: err?.message || 'failed' })
  }
})

// Agents performance metrics
router.get('/agents/performance', auth, allowRoles('admin','user','manager'), async (req, res) => {
  // Scope to caller
  const agentFilter = { role: 'agent' }
  if (req.user.role === 'admin'){
    // no scoping
  } else if (req.user.role === 'user'){
    agentFilter.createdBy = req.user.id
  } else if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('createdBy')
    agentFilter.createdBy = mgr?.createdBy || '__none__'
  }
  const agents = await User.find(agentFilter, '-password').sort({ createdAt: -1 })
  const agentIds = agents.map(a => a._id)

  // Assigned chats per agent
  const assignments = await ChatAssignment.aggregate([
    { $match: { assignedTo: { $in: agentIds } } },
    { $group: { _id: '$assignedTo', assigned: { $sum: 1 },
      avgResponseMs: { $avg: { $cond: [ { $and: ['$firstMessageAt', '$firstResponseAt'] }, { $subtract: ['$firstResponseAt', '$firstMessageAt'] }, null ] } } } }
  ])

  // Orders done per agent
  const ordersDone = await Order.aggregate([
    { $match: { createdBy: { $in: agentIds }, createdByRole: 'agent', status: 'shipped' } },
    { $group: { _id: '$createdBy', done: { $sum: 1 } } }
  ])

  const assignMap = new Map(assignments.map(a => [String(a._id), a]))
  const doneMap = new Map(ordersDone.map(o => [String(o._id), o]))

  const metrics = agents.map(a => {
    const asn = assignMap.get(String(a._id))
    const dn = doneMap.get(String(a._id))
    const avgMs = (asn && asn.avgResponseMs) || null
    return {
      id: a._id,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      phone: a.phone,
      assigned: asn ? asn.assigned : 0,
      done: dn ? dn.done : 0,
      avgResponseSeconds: avgMs != null ? Math.round(avgMs / 1000) : null,
    }
  })

  res.json({ metrics })
})

// Delete agent (admin => any, user => own only, manager => owner's agents only)
router.delete('/agents/:id', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { id } = req.params
  const agent = await User.findOne({ _id: id, role: 'agent' })
  if (!agent) return res.status(404).json({ message: 'Agent not found' })
  if (req.user.role !== 'admin'){
    let ownerId = req.user.id
    if (req.user.role === 'manager'){
      const mgr = await User.findById(req.user.id).select('createdBy')
      ownerId = String(mgr?.createdBy || req.user.id)
    }
    if (String(agent.createdBy) !== String(ownerId)){
      return res.status(403).json({ message: 'Not allowed' })
    }
  }
  // Best-effort cleanup of related data (assignments etc.)
  try{ await ChatAssignment.deleteMany({ assignedTo: id }) }catch{}
  // Remove the agent user record (credentials removed with it)
  await User.deleteOne({ _id: id })
  // Notify workspace for live refresh
  try{
    const io = getIO()
    let ownerId = String(agent.createdBy || '')
    if (!ownerId){
      if (req.user.role === 'manager'){
        const mgr = await User.findById(req.user.id).select('createdBy')
        ownerId = String(mgr?.createdBy || req.user.id)
      } else {
        ownerId = String(req.user.id)
      }
    }
    if (ownerId) io.to(`workspace:${ownerId}`).emit('agent.deleted', { id: String(id) })
  }catch{}
  res.json({ message: 'Agent deleted' })
})

// Current user profile
router.get('/me', auth, async (req, res) => {
  const u = await User.findById(req.user.id, '-password')
  if (!u) return res.status(404).json({ message: 'User not found' })
  res.json({ user: u })
})

// Update current user's settings (e.g., auto invoice toggle)
router.patch('/me/settings', auth, async (req, res) => {
  try{
    const { autoSendInvoice } = req.body || {}
    const update = {}
    if (autoSendInvoice !== undefined) update['settings.autoSendInvoice'] = !!autoSendInvoice
    if (Object.keys(update).length === 0){
      return res.status(400).json({ message: 'No valid settings provided' })
    }
    const u = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, projection: '-password' }
    )
    if (!u) return res.status(404).json({ message: 'User not found' })
    try{ const io = getIO(); io.to(`user:${String(u._id)}`).emit('me.updated', { settings: u.settings }) }catch{}
    return res.json({ ok:true, user: u })
  }catch(err){
    return res.status(500).json({ message: err?.message || 'failed' })
  }
})

// Update current agent availability (Available / Away / Busy)
router.patch('/me/availability', auth, allowRoles('agent'), async (req, res) => {
  try{
    const { availability } = req.body || {}
    const allowed = ['available','away','busy','offline']
    const val = String(availability || '').toLowerCase()
    if (!allowed.includes(val)){
      return res.status(400).json({ message: 'Invalid availability' })
    }
    const u = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { availability: val } },
      { new: true, projection: '-password' }
    )
    if (!u) return res.status(404).json({ message: 'User not found' })
    // Broadcast to workspace so owner/user assign modals refresh live
    try{
      const io = getIO()
      const ownerId = String(u.createdBy || '')
      if (ownerId){ io.to(`workspace:${ownerId}`).emit('agent.updated', { id: String(u._id), availability: u.availability }) }
      // Also notify the agent's own room
      io.to(`user:${String(u._id)}`).emit('me.updated', { availability: u.availability })
    }catch{}
    return res.json({ ok: true, user: u })
  }catch(err){
    return res.status(500).json({ message: err?.message || 'failed' })
  }
})

// Change own password (all authenticated roles)
router.patch('/me/password', auth, async (req, res) => {
  try{
    const { currentPassword = '', newPassword = '' } = req.body || {}
    const cur = String(currentPassword||'').trim()
    const next = String(newPassword||'').trim()
    if (!cur || !next || next.length < 6){
      return res.status(400).json({ message: 'Invalid password' })
    }
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    const ok = await user.comparePassword(cur)
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' })
    user.password = next
    await user.save()
    return res.json({ ok: true, message: 'Password updated successfully' })
  }catch(err){
    return res.status(500).json({ message: err?.message || 'failed' })
  }
})

// Update payout profile (agent and driver)
router.patch('/me/payout-profile', auth, allowRoles('agent','driver'), async (req, res) => {
  try{
    const { method, accountName, bankName, iban, accountNumber, phoneNumber } = req.body || {}
    const allowed = ['bank','jazzcash','easypaisa','nayapay','sadapay']
    const m = String(method||'').toLowerCase()
    if (!allowed.includes(m)) return res.status(400).json({ message: 'Invalid payout method' })
    // Basic validations
    if (m === 'bank'){
      if (!accountName || !(iban || accountNumber) || !bankName){
        return res.status(400).json({ message: 'Bank method requires accountName, bankName and IBAN or Account Number' })
      }
    } else {
      if (!accountName || !phoneNumber){
        return res.status(400).json({ message: 'Wallet method requires accountName and phoneNumber' })
      }
    }
    const update = {
      'payoutProfile.method': m,
      'payoutProfile.accountName': accountName||'',
      'payoutProfile.bankName': bankName||'',
      'payoutProfile.iban': iban||'',
      'payoutProfile.accountNumber': accountNumber||'',
      'payoutProfile.phoneNumber': phoneNumber||'',
    }
    const u = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true, projection: '-password' })
    if (!u) return res.status(404).json({ message: 'User not found' })
    return res.json({ ok:true, user: u })
  }catch(err){
    return res.status(500).json({ message: err?.message || 'failed' })
  }
})

// Agent self performance: avg response time and quick counts
router.get('/agents/me/performance', auth, async (req, res) => {
  const userId = req.user.id
  // If caller is not agent, still allow to query own if they are a user/admin; scope remains to their id
  try{
    // Average response time from ChatAssignment
    const agg = await ChatAssignment.aggregate([
      { $match: { assignedTo: new mongoose.Types.ObjectId(userId) } },
      { $project: {
          diff: { $cond: [ { $and: ['$firstMessageAt', '$firstResponseAt'] }, { $subtract: ['$firstResponseAt', '$firstMessageAt'] }, null ] }
        }
      },
      { $group: { _id: null, avgMs: { $avg: '$diff' } } }
    ])
    const avgMs = (agg && agg[0] && agg[0].avgMs) || null

    // Orders quick counts for this agent
    const all = await Order.countDocuments({ createdBy: userId, createdByRole: 'agent' })
    const shipped = await Order.countDocuments({ createdBy: userId, createdByRole: 'agent', status: 'shipped' })

    res.json({ avgResponseSeconds: avgMs != null ? Math.round(avgMs/1000) : null, ordersSubmitted: all, ordersShipped: shipped })
  }catch(err){
    res.status(500).json({ error: err?.message || 'failed' })
  }
})

export default router;

// Managers CRUD
// List managers (admin => all, user => own)
router.get('/managers', auth, allowRoles('admin','user'), async (req, res) => {
  const { q = '' } = req.query || {}
  const base = { role: 'manager' }
  if (req.user.role !== 'admin') base.createdBy = req.user.id
  const text = q.trim()
  const cond = text ? { ...base, $or: [
    { firstName: { $regex: text, $options: 'i' } },
    { lastName: { $regex: text, $options: 'i' } },
    { email: { $regex: text, $options: 'i' } },
  ] } : base
  const users = await User.find(cond, '-password').sort({ createdAt: -1 })
  res.json({ users })
})

// Driver/Agent: list managers in my workspace (optionally same country)
router.get('/my-managers', auth, allowRoles('driver','agent'), async (req, res) => {
  try{
    const me = await User.findById(req.user.id).select('createdBy country')
    const ownerId = me?.createdBy
    if (!ownerId) return res.json({ users: [] })
    const base = { role: 'manager', createdBy: ownerId }
    const same = String(req.query.sameCountry || 'true').toLowerCase() === 'true'
    if (same && me?.country) base.country = me.country
    const users = await User.find(base, '-password').sort({ firstName: 1, lastName: 1 })
    return res.json({ users })
  }catch(err){
    return res.status(500).json({ message: 'Failed to load managers' })
  }
})

// Create manager (admin, user)
router.post('/managers', auth, allowRoles('admin','user'), async (req, res) => {
  const { firstName, lastName, email, password, phone, country='', assignedCountry='', canCreateAgents=false, canManageProducts=false, canCreateOrders=false, canCreateDrivers=false } = req.body || {}
  if (!firstName || !lastName || !email || !password) return res.status(400).json({ message: 'Missing required fields' })
  const exists = await User.findOne({ email })
  if (exists) return res.status(400).json({ message: 'Email already in use' })
  const createdBy = req.user?.id
  const ALLOWED = new Set(['UAE','Oman','KSA','Bahrain','India','Kuwait','Qatar'])
  const ctry = ALLOWED.has(String(country)) ? String(country) : ''
  const ALLOWED_ASSIGNED = new Set(['UAE','Saudi Arabia','Oman','Bahrain','India','Kuwait','Qatar'])
  const assignedCtry = ALLOWED_ASSIGNED.has(String(assignedCountry)) ? String(assignedCountry) : ''
  const manager = new User({ 
    firstName, 
    lastName, 
    email, 
    password, 
    phone, 
    country: ctry, 
    assignedCountry: assignedCtry,
    role: 'manager', 
    createdBy, 
    managerPermissions: { canCreateAgents: !!canCreateAgents, canManageProducts: !!canManageProducts, canCreateOrders: !!canCreateOrders, canCreateDrivers: !!canCreateDrivers } 
  })
  await manager.save()
  
  // Create notification for manager creation
  try {
    await createNotification({
      userId: createdBy,
      type: 'user_created',
      title: 'New Manager Created',
      message: `Manager ${firstName} ${lastName} (${email}) has been created with permissions: ${canCreateAgents ? 'Create Agents, ' : ''}${canManageProducts ? 'Manage Products, ' : ''}${canCreateOrders ? 'Create Orders' : ''}`.replace(/, $/, ''),
      relatedId: manager._id,
      relatedType: 'User',
      triggeredBy: req.user.id,
      triggeredByRole: req.user.role
    });
  } catch (err) {
    console.error('Failed to create manager notification:', err);
  }
  
  // Broadcast to workspace for real-time coordination
  try{ const io = getIO(); const ownerId = req.user.id; io.to(`workspace:${ownerId}`).emit('manager.created', { id: String(manager._id) }) }catch{}
  // Try to send WhatsApp welcome message (non-blocking)
  ;(async ()=>{
    try{
      const digits = String(phone||'').replace(/\D/g,'')
      if (digits) {
        const jid = `${digits}@s.whatsapp.net`
        const text = `Welcome to the team, ${firstName} ${lastName}!\nWe're excited to have you with us. You can log in to access your dashboard at web.buysial.com/login.\nHere are your login credentials: Email: ${email} Password: ${password}`
        const wa = await getWA()
        await wa.sendText(jid, text)
      }
    }catch(err){
      try { console.error('[managers] failed to send welcome WA', err?.message||err) } catch {}
    }
  })()
  res.status(201).json({ message: 'Manager created', user: { id: manager._id, firstName, lastName, email, role: 'manager', managerPermissions: manager.managerPermissions } })
})

// Delete manager (admin => any, user => own)
router.delete('/managers/:id', auth, allowRoles('admin','user'), async (req, res) => {
  const { id } = req.params
  const mgr = await User.findOne({ _id: id, role: 'manager' })
  if (!mgr) return res.status(404).json({ message: 'Manager not found' })
  if (req.user.role !== 'admin' && String(mgr.createdBy) !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  await User.deleteOne({ _id: id })
  try{
    const io = getIO()
    const ownerId = String(mgr.createdBy || req.user.id)
    if (ownerId) io.to(`workspace:${ownerId}`).emit('manager.deleted', { id: String(id) })
  }catch{}
  res.json({ message: 'Manager deleted' })
})

// Investors CRUD
// List investors (admin => all, user => own)
router.get('/investors', auth, allowRoles('admin','user'), async (req, res) => {
  const { q = '' } = req.query || {}
  const base = { role: 'investor' }
  if (req.user.role !== 'admin') base.createdBy = req.user.id
  const text = q.trim()
  const cond = text ? { ...base, $or: [
    { firstName: { $regex: text, $options: 'i' } },
    { lastName: { $regex: text, $options: 'i' } },
    { email: { $regex: text, $options: 'i' } },
    { phone: { $regex: text, $options: 'i' } },
  ] } : base
  const users = await User.find(cond, '-password').populate('investorProfile.assignedProducts.product', 'name baseCurrency price').sort({ createdAt: -1 })
  res.json({ users })
})

// Create investor (admin, user)
router.post('/investors', auth, allowRoles('admin','user'), async (req, res) => {
  const { firstName, lastName, email, password, phone, investmentAmount, currency, assignments } = req.body || {}
  if (!firstName || !lastName || !email || !password) return res.status(400).json({ message: 'Missing required fields' })
  const exists = await User.findOne({ email })
  if (exists) return res.status(400).json({ message: 'Email already in use' })
  // Validate currency
  const CUR = ['AED','SAR','OMR','BHD']
  const cur = CUR.includes(currency) ? currency : 'SAR'
  // Validate products list
  const assignedProducts = []
  if (Array.isArray(assignments)){
    for (const it of assignments){
      const pid = it?.productId || it?.product
      if (!pid) continue
      const prod = await Product.findById(pid).select('_id')
      if (!prod) continue
      const ppu = Number(it?.profitPerUnit || 0)
      assignedProducts.push({ product: prod._id, profitPerUnit: Math.max(0, ppu) })
    }
  }
  const createdBy = req.user?.id
  const investor = new User({
    firstName, lastName, email, password, phone, role: 'investor', createdBy,
    investorProfile: { investmentAmount: Math.max(0, Number(investmentAmount||0)), currency: cur, assignedProducts }
  })
  await investor.save()
  // Broadcast: owner workspace should refresh investors; investor self can refresh dashboard
  try{ const io = getIO(); io.to(`workspace:${createdBy}`).emit('investor.created', { id: String(investor._id) }); io.to(`user:${String(investor._id)}`).emit('investor.updated', { id: String(investor._id) }) }catch{}
  // Try to send WhatsApp welcome message (non-blocking)
  ;(async ()=>{
    try{
      const digits = String(phone||'').replace(/\D/g,'')
      if (digits) {
        const jid = `${digits}@s.whatsapp.net`
        const text = `Welcome to the team, ${firstName} ${lastName}!\nWe're excited to have you with us. You can log in to access your dashboard at web.buysial.com/login.\nHere are your login credentials: Email: ${email} Password: ${password}`
        const wa = await getWA()
        await wa.sendText(jid, text)
      }
    }catch(err){
      try { console.error('[investors] failed to send welcome WA', err?.message||err) } catch {}
    }
  })()
  const populated = await User.findById(investor._id, '-password').populate('investorProfile.assignedProducts.product', 'name')
  res.status(201).json({ message: 'Investor created', user: populated })
})

// Delete investor (admin => any, user => own)
router.delete('/investors/:id', auth, allowRoles('admin','user'), async (req, res) => {
  const { id } = req.params
  const inv = await User.findOne({ _id: id, role: 'investor' })
  if (!inv) return res.status(404).json({ message: 'Investor not found' })
  if (req.user.role !== 'admin' && String(inv.createdBy) !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  await User.deleteOne({ _id: id })
  try{
    const io = getIO()
    const ownerId = String(inv.createdBy || req.user.id)
    if (ownerId) io.to(`workspace:${ownerId}`).emit('investor.deleted', { id: String(id) })
  }catch{}
  res.json({ message: 'Investor deleted' })
})

// Investor metrics for owner (admin, user)
router.get('/investors/:id/metrics', auth, allowRoles('admin','user'), async (req, res) => {
  const { id } = req.params
  const inv = await User.findById(id).populate('investorProfile.assignedProducts.product', 'name price baseCurrency')
  if (!inv || inv.role !== 'investor') return res.status(404).json({ message: 'Investor not found' })
  if (req.user.role !== 'admin' && String(inv.createdBy) !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  const ownerId = inv.createdBy
  const assigned = inv.investorProfile?.assignedProducts || []
  const productIds = assigned.map(a => a.product?._id || a.product).filter(Boolean)
  if (productIds.length === 0){
    return res.json({
      currency: inv.investorProfile?.currency || 'SAR',
      investmentAmount: inv.investorProfile?.investmentAmount || 0,
      unitsSold: 0,
      totalProfit: 0,
      totalSaleValue: 0,
      breakdown: []
    })
  }
  const RATES = {
    SAR: { SAR: 1, AED: 0.98, OMR: 0.10, BHD: 0.10 },
    AED: { SAR: 1.02, AED: 1, OMR: 0.10, BHD: 0.10 },
    OMR: { SAR: 9.78, AED: 9.58, OMR: 1, BHD: 0.98 },
    BHD: { SAR: 9.94, AED: 9.74, OMR: 1.02, BHD: 1 },
  }
  function convertPrice(val, from, to){ const r = RATES?.[from]?.[to]; return r ? (Number(val||0) * r) : Number(val||0) }
  const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
  const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
  const creatorIds = [ ownerId, ...agents.map(a=>a._id), ...managers.map(m=>m._id) ]
  const orders = await Order.aggregate([
    { $match: { productId: { $in: productIds }, createdBy: { $in: creatorIds }, $or: [ { status: 'shipped' }, { shipmentStatus: 'delivered' } ] } },
    { $group: { _id: '$productId', unitsSold: { $sum: '$quantity' } } }
  ])
  const unitsMap = new Map(orders.map(o => [ String(o._id), o.unitsSold ]))
  let totalUnits = 0
  let totalProfit = 0
  let totalSaleValue = 0
  const breakdown = assigned.map(a => {
    const pid = String(a.product?._id || a.product)
    const units = Number(unitsMap.get(pid) || 0)
    totalUnits += units
    const profit = units * Number(a.profitPerUnit || 0)
    totalProfit += profit
    const base = a.product?.baseCurrency || 'SAR'
    const price = Number(a.product?.price || 0)
    const invCur = inv.investorProfile?.currency || 'SAR'
    const convertedUnitPrice = convertPrice(price, base, invCur)
    const saleValue = units * convertedUnitPrice
    totalSaleValue += saleValue
    return { productId: pid, productName: a.product?.name || '', unitsSold: units, profit, saleValue }
  })
  res.json({ currency: inv.investorProfile?.currency || 'SAR', investmentAmount: inv.investorProfile?.investmentAmount || 0, unitsSold: totalUnits, totalProfit, totalSaleValue, breakdown })
})

// Drivers CRUD
// List drivers (admin => all, user => own, manager => owner's drivers)
router.get('/drivers', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { q = '', country = '' } = req.query || {}
  const base = { role: 'driver' }
  if (req.user.role === 'admin'){
    // no extra scoping
  } else if (req.user.role === 'user'){
    base.createdBy = req.user.id
  } else if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('createdBy assignedCountry')
    base.createdBy = mgr?.createdBy || '__none__'
    
    // Filter by manager's assigned country if they have one
    if (mgr?.assignedCountry) {
      base.country = mgr.assignedCountry
    }
  }
  
  // Filter by country if provided (case-insensitive) - unless manager has assigned country
  if (country && country.trim() && req.user.role !== 'manager') {
    base.country = { $regex: country.trim(), $options: 'i' }
  }
  
  const text = q.trim()
  const cond = text ? { ...base, $or: [
    { firstName: { $regex: text, $options: 'i' } },
    { lastName: { $regex: text, $options: 'i' } },
    { email: { $regex: text, $options: 'i' } },
    { phone: { $regex: text, $options: 'i' } },
    { country: { $regex: text, $options: 'i' } },
    { city: { $regex: text, $options: 'i' } },
  ] } : base
  const users = await User.find(cond, '-password').sort({ createdAt: -1 })
  res.json({ users })
})

// Create driver (admin, user, manager with permission)
router.post('/drivers', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { firstName, lastName, email, password, phone, country='', city='' } = req.body || {}
  if (!firstName || !lastName || !email || !password) return res.status(400).json({ message: 'Missing required fields' })
  
  // Validate phone number is from allowed countries
  if (phone) {
    const allowedCodes = ['+971', '+968', '+966', '+973', '+965', '+974', '+91'] // UAE, Oman, KSA, Bahrain, Kuwait, Qatar, India
    const phoneClean = String(phone).replace(/\s/g, '')
    const isAllowedCountry = allowedCodes.some(code => phoneClean.startsWith(code))
    
    if (!isAllowedCountry) {
      return res.status(400).json({ message: 'Phone number must be from UAE (+971), Oman (+968), KSA (+966), Bahrain (+973), Kuwait (+965), Qatar (+974) or India (+91)' })
    }
  }
  
  const exists = await User.findOne({ email })
  if (exists) return res.status(400).json({ message: 'Email already in use' })
  const createdBy = req.user?.id
  const driver = new User({ firstName, lastName, email, password, phone, country, city, role: 'driver', createdBy })
  await driver.save()
  // Broadcast to workspace so managers/owners can see the new driver immediately
  try{ const io = getIO(); io.to(`workspace:${createdBy}`).emit('driver.created', { id: String(driver._id) }) }catch{}
  // Try to send WhatsApp welcome message (non-blocking, same as agent)
  ;(async ()=>{
    try{
      const digits = String(phone||'').replace(/\D/g,'')
      if (digits) {
        const jid = `${digits}@s.whatsapp.net`
        const text = `🌟 Welcome to VITALBLAZE Commerce!\n\nDear ${firstName} ${lastName},\n\nWe're excited to have you on board as a delivery driver for our growing business. Your account has been successfully created. Please find your login details below:\n\n🌐 Login URL: https://web.buysial.com/login\n\n👤 Email: ${email}\n🔑 Password: ${password}\n\nOnce logged in, you'll be able to view your assigned deliveries, update delivery statuses, and manage your delivery operations.\n\n🚀 Get ready to start delivering! Instructions and guides will be shared with you soon to help you get started.\n\nIf you face any issues signing in, please reach out to our support team.\n\nWelcome to the VITALBLAZE delivery team!`
        const wa = await getWA()
        try{
          await wa.sendText(jid, text)
          try{ await User.updateOne({ _id: driver._id }, { $set: { welcomeSent: true, welcomeSentAt: new Date(), welcomeError: '' } }) }catch{}
        }catch(e){
          const msg = e?.message || 'send-failed'
          try{ await User.updateOne({ _id: driver._id }, { $set: { welcomeSent: false, welcomeError: String(msg).slice(0,300) } }) }catch{}
          throw e
        }
      } else {
        try{ await User.updateOne({ _id: driver._id }, { $set: { welcomeSent: false, welcomeError: 'no-phone' } }) }catch{}
      }
    }catch(err){
      try { console.error('[drivers] failed to send welcome WA', err?.message||err) } catch {}
    }
  })()
  res.status(201).json({ message: 'Driver created', user: { id: driver._id, firstName, lastName, email, phone, country, city, role: 'driver' } })
})

// Delete driver (admin => any, user => own)
router.delete('/drivers/:id', auth, allowRoles('admin','user'), async (req, res) => {
  const { id } = req.params
  const driver = await User.findOne({ _id: id, role: 'driver' })
  if (!driver) return res.status(404).json({ message: 'Driver not found' })
  if (req.user.role !== 'admin' && String(driver.createdBy) !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  await User.deleteOne({ _id: id })
  try{
    const io = getIO()
    const ownerId = String(driver.createdBy || req.user.id)
    if (ownerId) io.to(`workspace:${ownerId}`).emit('driver.deleted', { id: String(id) })
  }catch{}
  res.json({ message: 'Driver deleted' })
})
// Investor self metrics (investor)
router.get('/investors/me/metrics', auth, allowRoles('investor'), async (req, res) => {
  const inv = await User.findById(req.user.id).populate('investorProfile.assignedProducts.product', 'name price baseCurrency')
  if (!inv || inv.role !== 'investor') return res.status(404).json({ message: 'Investor not found' })
  const ownerId = inv.createdBy
  const assigned = inv.investorProfile?.assignedProducts || []
  const productIds = assigned.map(a => a.product?._id || a.product).filter(Boolean)
  if (productIds.length === 0){
    return res.json({ currency: inv.investorProfile?.currency || 'SAR', investmentAmount: inv.investorProfile?.investmentAmount || 0, unitsSold: 0, totalProfit: 0, totalSaleValue: 0, breakdown: [] })
  }
  const RATES = {
    SAR: { SAR: 1, AED: 0.98, OMR: 0.10, BHD: 0.10 },
    AED: { SAR: 1.02, AED: 1, OMR: 0.10, BHD: 0.10 },
    OMR: { SAR: 9.78, AED: 9.58, OMR: 1, BHD: 0.98 },
    BHD: { SAR: 9.94, AED: 9.74, OMR: 1.02, BHD: 1 },
  }
  function convertPrice(val, from, to){ const r = RATES?.[from]?.[to]; return r ? (Number(val||0) * r) : Number(val||0) }
  const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
  const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
  const creatorIds = [ ownerId, ...agents.map(a=>a._id), ...managers.map(m=>m._id) ]
  const orders = await Order.aggregate([
    { $match: { productId: { $in: productIds }, createdBy: { $in: creatorIds }, $or: [ { status: 'shipped' }, { shipmentStatus: 'delivered' } ] } },
    { $group: { _id: '$productId', unitsSold: { $sum: '$quantity' } } }
  ])
  const unitsMap = new Map(orders.map(o => [ String(o._id), o.unitsSold ]))
  let totalUnits = 0
  let totalProfit = 0
  let totalSaleValue = 0
  const breakdown = assigned.map(a => {
    const pid = String(a.product?._id || a.product)
    const units = Number(unitsMap.get(pid) || 0)
    totalUnits += units
    const profit = units * Number(a.profitPerUnit || 0)
    totalProfit += profit
    const base = a.product?.baseCurrency || 'SAR'
    const price = Number(a.product?.price || 0)
    const invCur = inv.investorProfile?.currency || 'SAR'
    const convertedUnitPrice = convertPrice(price, base, invCur)
    const saleValue = units * convertedUnitPrice
    totalSaleValue += saleValue
    return { productId: pid, productName: a.product?.name || '', unitsSold: units, profit, saleValue }
  })
  res.json({ currency: inv.investorProfile?.currency || 'SAR', investmentAmount: inv.investorProfile?.investmentAmount || 0, unitsSold: totalUnits, totalProfit, totalSaleValue, breakdown })
})

// Get investor performance by ID (admin, manager)
router.get('/:id/investor-performance', auth, allowRoles('admin', 'manager'), async (req, res) => {
  try {
    const { id } = req.params
    const inv = await User.findById(id).populate('investorProfile.assignedProducts.product', 'name price baseCurrency')
    if (!inv || inv.role !== 'investor') return res.status(404).json({ message: 'Investor not found' })
    
    const ownerId = inv.createdBy
    const assigned = inv.investorProfile?.assignedProducts || []
    const productIds = assigned.map(a => a.product?._id || a.product).filter(Boolean)
    
    if (productIds.length === 0){
      return res.json({ 
        currency: inv.investorProfile?.currency || 'SAR', 
        investmentAmount: inv.investorProfile?.investmentAmount || 0, 
        unitsSold: 0, 
        totalProfit: 0, 
        totalSaleValue: 0, 
        breakdown: [] 
      })
    }
    
    const RATES = {
      SAR: { SAR: 1, AED: 0.98, OMR: 0.10, BHD: 0.10 },
      AED: { SAR: 1.02, AED: 1, OMR: 0.10, BHD: 0.10 },
      OMR: { SAR: 9.78, AED: 9.58, OMR: 1, BHD: 0.98 },
      BHD: { SAR: 9.94, AED: 9.74, OMR: 1.02, BHD: 1 },
    }
    
    function convertPrice(val, from, to){ 
      const r = RATES?.[from]?.[to]; 
      return r ? (Number(val||0) * r) : Number(val||0) 
    }
    
    const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
    const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
    const creatorIds = [ ownerId, ...agents.map(a=>a._id), ...managers.map(m=>m._id) ]
    
    const orders = await Order.aggregate([
      { $match: { productId: { $in: productIds }, createdBy: { $in: creatorIds }, $or: [ { status: 'shipped' }, { shipmentStatus: 'delivered' } ] } },
      { $group: { _id: '$productId', unitsSold: { $sum: '$quantity' } } }
    ])
    
    const unitsMap = new Map(orders.map(o => [ String(o._id), o.unitsSold ]))
    let totalUnits = 0
    let totalProfit = 0
    let totalSaleValue = 0
    
    const breakdown = assigned.map(a => {
      const pid = String(a.product?._id || a.product)
      const units = Number(unitsMap.get(pid) || 0)
      totalUnits += units
      const profit = units * Number(a.profitPerUnit || 0)
      totalProfit += profit
      const base = a.product?.baseCurrency || 'SAR'
      const price = Number(a.product?.price || 0)
      const invCur = inv.investorProfile?.currency || 'SAR'
      const convertedUnitPrice = convertPrice(price, base, invCur)
      const saleValue = units * convertedUnitPrice
      totalSaleValue += saleValue
      return { productId: pid, productName: a.product?.name || '', unitsSold: units, profit, saleValue }
    })
    
    res.json({ 
      currency: inv.investorProfile?.currency || 'SAR', 
      investmentAmount: inv.investorProfile?.investmentAmount || 0, 
      unitsSold: totalUnits, 
      totalProfit, 
      totalSaleValue, 
      breakdown 
    })
  } catch (error) {
    console.error('Error fetching investor performance:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})
