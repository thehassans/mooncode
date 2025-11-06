import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { auth, allowRoles } from '../middleware/auth.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import { createNotification } from './notifications.js'
import geminiService from '../services/geminiService.js'
import imageGenService from '../services/imageGenService.js'

const router = express.Router()

// Resolve an uploads directory robustly across Plesk/PM2/systemd contexts
function resolveUploadsDir(){
  try{
    const here = path.dirname(fileURLToPath(import.meta.url))
    const candidates = [
      path.resolve(process.cwd(), 'uploads'),
      path.resolve(here, '../../../uploads'),
      path.resolve(here, '../../uploads'),
      path.resolve('/httpdocs/uploads'),
    ]
    for (const c of candidates){
      try{ if (!fs.existsSync(c)) fs.mkdirSync(c, { recursive: true }); return c }catch{}
    }
  }catch{}
  // Last resort
  try{ fs.mkdirSync('uploads', { recursive: true }) }catch{}
  return path.resolve('uploads')
}
const UPLOADS_DIR = resolveUploadsDir()

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext)
    const safeBase = String(base)
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
    cb(null, `${safeBase || 'image'}-${Date.now()}${ext.toLowerCase()}`)
  }
})

// Public: return category usage counts for visible products
router.get('/public/categories-usage', async (req, res) => {
  try{
    const rows = await Product.aggregate([
      { $match: { displayOnWebsite: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
      { $sort: { category: 1 } }
    ])
    const counts = Object.fromEntries(rows.map(r => [String(r.category||'Other'), Number(r.count||0)]))
    const total = Object.values(counts).reduce((a,b)=>a+b,0)
    return res.json({ counts, total })
  }catch(err){
    console.error('categories-usage error:', err)
    return res.status(500).json({ message: 'Failed to fetch category usage' })
  }
})
const upload = multer({ storage })

// Create product (admin; user; manager with permission)
router.post('/', auth, allowRoles('admin','user','manager'), upload.any(), async (req, res) => {
  const { name, price, stockQty, purchasePrice, category, madeInCountry, description, stockUAE, stockOman, stockKSA, stockBahrain, stockIndia, stockKuwait, stockQatar } = req.body || {}
  if (!name || price == null) return res.status(400).json({ message: 'Name and price are required' })
  
  let ownerId = req.user.id
  if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('managerPermissions createdBy')
    if (!mgr || !mgr.managerPermissions?.canManageProducts){ return res.status(403).json({ message: 'Manager not allowed to manage products' }) }
    ownerId = String(mgr.createdBy || req.user.id)
  }
  
  const files = Array.isArray(req.files) ? req.files : []
  // Accept any file with an image mimetype or fieldname starting with 'image'
  const imageFiles = files.filter(f => (String(f?.mimetype||'').startsWith('image/') || String(f?.fieldname||'').toLowerCase().startsWith('image')))
  const limitedFiles = imageFiles.slice(0, 5)
  const imagePaths = limitedFiles.map(f => `/uploads/${f.filename}`)
  
  // per-country stock
  const sbc = { UAE:0, Oman:0, KSA:0, Bahrain:0, India:0, Kuwait:0, Qatar:0 }
  if (stockUAE != null) sbc.UAE = Math.max(0, Number(stockUAE))
  if (stockOman != null) sbc.Oman = Math.max(0, Number(stockOman))
  if (stockKSA != null) sbc.KSA = Math.max(0, Number(stockKSA))
  if (stockBahrain != null) sbc.Bahrain = Math.max(0, Number(stockBahrain))
  if (stockIndia != null) sbc.India = Math.max(0, Number(stockIndia))
  if (stockKuwait != null) sbc.Kuwait = Math.max(0, Number(stockKuwait))
  if (stockQatar != null) sbc.Qatar = Math.max(0, Number(stockQatar))
  
  // if stockQty not provided, sum from per-country
  let finalStockQty = stockQty != null ? Number(stockQty) : (sbc.UAE + sbc.Oman + sbc.KSA + sbc.Bahrain + sbc.India + sbc.Kuwait + sbc.Qatar)
  
  // availableCountries may be sent as comma-separated string or array
  let availableCountries = []
  try{
    const raw = req.body?.availableCountries
    if (Array.isArray(raw)) availableCountries = raw.filter(Boolean)
    else if (typeof raw === 'string') availableCountries = raw.split(',').map(s=>s.trim()).filter(Boolean)
  }catch{}
  const displayOnWebsite = String(req.body?.displayOnWebsite||'').toLowerCase() === 'true' || req.body?.displayOnWebsite === true
  const isForMobile = String(req.body?.isForMobile||'').toLowerCase() === 'true' || req.body?.isForMobile === true
  const displayOnShopify = String(req.body?.displayOnShopify||'').toLowerCase() === 'true' || req.body?.displayOnShopify === true

  let actorName = ''
  try{
    const actor = await User.findById(req.user.id).select('firstName lastName role').lean()
    if (actor){ actorName = [actor.firstName||'', actor.lastName||''].join(' ').trim() }
  }catch{}
  const doc = new Product({
    name: String(name).trim(),
    price: Number(price),
    stockQty: finalStockQty,
    stockByCountry: sbc,
    totalPurchased: finalStockQty, // Initial inventory purchased
    imagePath: imagePaths[0] || '',
    images: imagePaths,
    purchasePrice: purchasePrice != null ? Number(purchasePrice) : 0,
    category: ['Skincare','Haircare','Bodycare','Other'].includes(category) ? category : 'Other',
    madeInCountry: madeInCountry || '',
    description: description || '',
    availableCountries,
    displayOnWebsite,
    isForMobile,
    displayOnShopify,
    createdBy: ownerId,
    createdByRole: String(req.user.role||''),
    createdByActor: req.user.id,
    createdByActorName: actorName,
  })
  await doc.save()
  
  // Create notification for product creation
  try {
    // If product was created by manager, notify the owner (user) as well
    if (req.user.role === 'manager') {
      const creator = await User.findById(req.user.id).select('createdBy role').lean()
      if (creator?.createdBy) {
        // Notify the owner (user who created this manager)
        await createNotification({
          userId: creator.createdBy,
          type: 'product_created',
          title: 'New Product Added',
          message: `Product "${doc.name}" added by ${req.user.firstName} ${req.user.lastName} (${req.user.role})`,
          relatedId: doc._id,
          relatedType: 'product',
          triggeredBy: req.user.id,
          triggeredByRole: req.user.role,
          metadata: {
            productName: doc.name,
            price: doc.price,
            category: doc.category,
            stockQty: doc.stockQty
          }
        })
      }
    }
    
    // Always notify the product creator
    await createNotification({
      userId: ownerId,
      type: 'product_created',
      title: 'Product Created Successfully',
      message: `Your product "${doc.name}" has been created successfully`,
      relatedId: doc._id,
      relatedType: 'product',
      triggeredBy: req.user.id,
      triggeredByRole: req.user.role,
      metadata: {
        productName: doc.name,
        price: doc.price,
        category: doc.category,
        stockQty: doc.stockQty
      }
    })
  } catch (notificationError) {
    console.warn('Failed to create product notification:', notificationError?.message || notificationError)
  }
  
  res.status(201).json({ message: 'Product created', product: doc })
})

// Get single product by ID (public endpoint)
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params
    const product = await Product.findById(id).select('-createdBy -updatedAt -__v')
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    
    // Ensure totalPurchased is set
    const prod = product.toObject()
    if (prod.totalPurchased == null || prod.totalPurchased === 0) {
      let totalFromHistory = 0
      if (Array.isArray(prod.stockHistory) && prod.stockHistory.length > 0) {
        totalFromHistory = prod.stockHistory.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0)
      }
      prod.totalPurchased = totalFromHistory > 0 ? totalFromHistory : (prod.stockQty || 0)
    }
    
    res.json({ product: prod })
  } catch (error) {
    console.error('Get product error:', error)
    res.status(500).json({ message: 'Failed to fetch product' })
  }
})

// Public products endpoint (no authentication required)
router.get('/public', async (req, res) => {
  try {
    const { category, search, sort, limit = 50, page = 1 } = req.query
    
    let query = { 
      displayOnWebsite: true,
      stockQty: { $gt: 0 }  // Only show products with stock > 0
    }
    
    // Category filter
    if (category && category !== 'all') {
      query.category = category
    }
    
    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i')
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { category: searchRegex }
      ]
    }
    
    // Build sort object
    let sortObj = { createdAt: -1 } // default: newest first
    if (sort) {
      switch (sort) {
        case 'name':
          sortObj = { name: 1 }
          break
        case 'name-desc':
          sortObj = { name: -1 }
          break
        case 'price':
          sortObj = { price: 1 }
          break
        case 'price-desc':
          sortObj = { price: -1 }
          break
        case 'rating':
          sortObj = { rating: -1 }
          break
        case 'featured':
          sortObj = { featured: -1, createdAt: -1 }
          break
        case 'newest':
        default:
          sortObj = { createdAt: -1 }
          break
      }
    }
    
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum
    
    const products = await Product.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .select('-createdBy -updatedAt -__v')
    
    // Ensure totalPurchased is set for all products
    const productsWithTotal = products.map(p => {
      const prod = p.toObject()
      if (prod.totalPurchased == null || prod.totalPurchased === 0) {
        let totalFromHistory = 0
        if (Array.isArray(prod.stockHistory) && prod.stockHistory.length > 0) {
          totalFromHistory = prod.stockHistory.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0)
        }
        prod.totalPurchased = totalFromHistory > 0 ? totalFromHistory : (prod.stockQty || 0)
      }
      return prod
    })
    
    const total = await Product.countDocuments(query)
    
    res.json({
      products: productsWithTotal,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Public products error:', error)
    res.status(500).json({ message: 'Failed to fetch products' })
  }
})

// Mobile products endpoint (no authentication required) - Only products marked for mobile app
router.get('/mobile', async (req, res) => {
  try {
    const { category, search, sort, limit = 50, page = 1 } = req.query
    
    let query = { isForMobile: true }
    
    // Category filter
    if (category && category !== 'all') {
      query.category = category
    }
    
    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i')
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { category: searchRegex }
      ]
    }
    
    // Build sort object
    let sortObj = { createdAt: -1 } // default: newest first
    if (sort) {
      switch (sort) {
        case 'name':
          sortObj = { name: 1 }
          break
        case 'name-desc':
          sortObj = { name: -1 }
          break
        case 'price':
          sortObj = { price: 1 }
          break
        case 'price-desc':
          sortObj = { price: -1 }
          break
        case 'rating':
          sortObj = { rating: -1 }
          break
        case 'featured':
          sortObj = { featured: -1, createdAt: -1 }
          break
        case 'newest':
        default:
          sortObj = { createdAt: -1 }
          break
      }
    }
    
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum
    
    const products = await Product.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .select('-createdBy -updatedAt -__v')
    
    // Ensure totalPurchased is set for all products
    const productsWithTotal = products.map(p => {
      const prod = p.toObject()
      if (prod.totalPurchased == null || prod.totalPurchased === 0) {
        let totalFromHistory = 0
        if (Array.isArray(prod.stockHistory) && prod.stockHistory.length > 0) {
          totalFromHistory = prod.stockHistory.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0)
        }
        prod.totalPurchased = totalFromHistory > 0 ? totalFromHistory : (prod.stockQty || 0)
      }
      return prod
    })
    
    const total = await Product.countDocuments(query)
    
    res.json({
      products: productsWithTotal,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Mobile products error:', error)
    res.status(500).json({ message: 'Failed to fetch products' })
  }
})

// List products (admin => all; agent => all; user => own; manager => owner's; customer => all public)
router.get('/', auth, allowRoles('admin','user','agent','manager','customer'), async (req, res) => {
  let base = {}
  if (req.user.role === 'admin' || req.user.role === 'agent' || req.user.role === 'customer') base = {}
  else if (req.user.role === 'user') base = { createdBy: req.user.id }
  else if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('createdBy')
    base = { createdBy: mgr?.createdBy || '__none__' }
  }
  const products = await Product.find(base).sort({ createdAt: -1 })
  
  // Ensure totalPurchased is set (calculate from stockHistory or stockQty if missing)
  const productsWithTotal = products.map(p => {
    const prod = p.toObject()
    if (prod.totalPurchased == null || prod.totalPurchased === 0) {
      // Calculate from stockHistory if available
      let totalFromHistory = 0
      if (Array.isArray(prod.stockHistory) && prod.stockHistory.length > 0) {
        totalFromHistory = prod.stockHistory.reduce((sum, entry) => {
          return sum + (Number(entry.quantity) || 0)
        }, 0)
      }
      // Use stockHistory total or current stockQty
      prod.totalPurchased = totalFromHistory > 0 ? totalFromHistory : (prod.stockQty || 0)
    }
    return prod
  })
  
  res.json({ products: productsWithTotal })
})

// Get single product by ID (authenticated)
router.get('/:id', auth, allowRoles('admin','user','agent','manager','customer'), async (req, res) => {
  try {
    const { id } = req.params
    const product = await Product.findById(id)
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    
    // Permission check
    if (req.user.role === 'user') {
      // User can only view their own products
      if (String(product.createdBy) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Not allowed' })
      }
    } else if (req.user.role === 'manager') {
      // Manager can view owner's products
      const mgr = await User.findById(req.user.id).select('createdBy')
      if (String(product.createdBy) !== String(mgr?.createdBy || '__none__')) {
        return res.status(403).json({ message: 'Not allowed' })
      }
    }
    // Admin, agent, customer can view all
    
    // Ensure totalPurchased is set (calculate from stockHistory or stockQty if missing)
    const prod = product.toObject()
    if (prod.totalPurchased == null || prod.totalPurchased === 0) {
      // Calculate from stockHistory if available
      let totalFromHistory = 0
      if (Array.isArray(prod.stockHistory) && prod.stockHistory.length > 0) {
        totalFromHistory = prod.stockHistory.reduce((sum, entry) => {
          return sum + (Number(entry.quantity) || 0)
        }, 0)
      }
      // Use stockHistory total or current stockQty
      prod.totalPurchased = totalFromHistory > 0 ? totalFromHistory : (prod.stockQty || 0)
    }
    
    res.json({ product: prod })
  } catch (error) {
    console.error('Get product error:', error)
    res.status(500).json({ message: 'Failed to fetch product' })
  }
})

// Update product (admin; user owner; manager with permission on owner's products)
router.patch('/:id', auth, allowRoles('admin','user','manager'), upload.any(), async (req, res) => {
  const { id } = req.params
  const prod = await Product.findById(id)
  if (!prod) return res.status(404).json({ message: 'Product not found' })
  if (req.user.role !== 'admin'){
    let ownerId = req.user.id
    if (req.user.role === 'manager'){
      const mgr = await User.findById(req.user.id).select('managerPermissions createdBy')
      if (!mgr || !mgr.managerPermissions?.canManageProducts){ return res.status(403).json({ message: 'Manager not allowed to manage products' }) }
      ownerId = String(mgr.createdBy || req.user.id)
    }
    if (String(prod.createdBy) !== String(ownerId)) return res.status(403).json({ message: 'Not allowed' })
  }
  const { name, price, stockQty, purchasePrice, category, madeInCountry, description, inStock, stockUAE, stockOman, stockKSA, stockBahrain, stockIndia, stockKuwait, stockQatar } = req.body || {}
  if (name != null) prod.name = String(name).trim()
  if (price != null) prod.price = Number(price)
  if (stockQty != null) prod.stockQty = Math.max(0, Number(stockQty))
  if (purchasePrice != null) prod.purchasePrice = Number(purchasePrice)
  if (category != null) prod.category = ['Skincare','Haircare','Bodycare','Other'].includes(category) ? category : 'Other'
  if (inStock != null) prod.inStock = Boolean(inStock)
  if (madeInCountry != null) prod.madeInCountry = String(madeInCountry)
  if (description != null) prod.description = String(description)
  // Update availableCountries if provided
  if (req.body?.availableCountries != null){
    try{
      const raw = req.body.availableCountries
      if (Array.isArray(raw)) prod.availableCountries = raw.filter(Boolean)
      else if (typeof raw === 'string') prod.availableCountries = raw.split(',').map(s=>s.trim()).filter(Boolean)
    }catch{}
  }
  // Update displayOnWebsite if provided
  if (req.body?.displayOnWebsite != null){
    prod.displayOnWebsite = (req.body.displayOnWebsite === true || String(req.body.displayOnWebsite).toLowerCase() === 'true')
  }
  // Update isForMobile if provided
  if (req.body?.isForMobile != null){
    prod.isForMobile = (req.body.isForMobile === true || String(req.body.isForMobile).toLowerCase() === 'true')
  }
  // Update displayOnShopify if provided
  if (req.body?.displayOnShopify != null){
    prod.displayOnShopify = (req.body.displayOnShopify === true || String(req.body.displayOnShopify).toLowerCase() === 'true')
  }
  // per-country stock updates
  const sbc = { ...(prod.stockByCountry || { UAE:0, Oman:0, KSA:0, Bahrain:0, India:0, Kuwait:0, Qatar:0 }) }
  if (stockUAE != null) sbc.UAE = Math.max(0, Number(stockUAE))
  if (stockOman != null) sbc.Oman = Math.max(0, Number(stockOman))
  if (stockKSA != null) sbc.KSA = Math.max(0, Number(stockKSA))
  if (stockBahrain != null) sbc.Bahrain = Math.max(0, Number(stockBahrain))
  if (stockIndia != null) sbc.India = Math.max(0, Number(stockIndia))
  if (stockKuwait != null) sbc.Kuwait = Math.max(0, Number(stockKuwait))
  if (stockQatar != null) sbc.Qatar = Math.max(0, Number(stockQatar))
  prod.stockByCountry = sbc
  // if client didn't send stockQty explicitly, recompute from per-country
  if (stockQty == null && (stockUAE != null || stockOman != null || stockKSA != null || stockBahrain != null || stockIndia != null || stockKuwait != null || stockQatar != null)){
    prod.stockQty = (sbc.UAE + sbc.Oman + sbc.KSA + sbc.Bahrain + sbc.India + sbc.Kuwait + sbc.Qatar)
  }
  const files = Array.isArray(req.files) ? req.files : []
  const imageFiles = files.filter(f => (String(f?.mimetype||'').startsWith('image/') || String(f?.fieldname||'').toLowerCase().startsWith('image')))
  if (imageFiles.length){
    const limitedFiles = imageFiles.slice(0, 5)
    const imagePaths = limitedFiles.map(f => `/uploads/${f.filename}`)
    const doAppend = (String(req.query.append||'').toLowerCase()==='true') || (String(req.body?.appendImages||'').toLowerCase()==='true')
    if (doAppend){
      const next = Array.from(new Set([...(prod.images||[]), ...imagePaths]))
      prod.images = next
      if (!prod.imagePath && next.length) prod.imagePath = next[0]
    } else {
      prod.imagePath = imagePaths[0]
      prod.images = imagePaths
    }
  }
  await prod.save()
  res.json({ message: 'Updated', product: prod })
})

// Generate additional product images via AI and append to product
router.post('/:id/images/ai', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const { prompt = '', count = 2 } = req.body || {}
    const prod = await Product.findById(id)
    if (!prod) return res.status(404).json({ message: 'Product not found' })
    // Permission: managers can operate only on owner's products
    if (req.user.role !== 'admin'){
      let ownerId = req.user.id
      if (req.user.role === 'manager'){
        const mgr = await User.findById(req.user.id).select('managerPermissions createdBy')
        if (!mgr || !mgr.managerPermissions?.canManageProducts){ return res.status(403).json({ message: 'Manager not allowed to manage products' }) }
        ownerId = String(mgr.createdBy || req.user.id)
      }
      if (String(prod.createdBy) !== String(ownerId)) return res.status(403).json({ message: 'Not allowed' })
    }
    // Load config from Settings if necessary
    if (!(await imageGenService.ensureConfig())) return res.status(503).json({ message: 'Image generation API not configured' })
    const defaultAngles = `High quality studio photos of ${prod.name}, category ${prod.category||''}. Clean white background, professional e-commerce shots from multiple angles (front, back, left, right, top-down, 45-degree), plus 1-2 close-up detail shots. Consistent lighting, no text overlay, no watermark.`
    const basePrompt = String(prompt || imageGenService.defaultPrompt || defaultAngles)
    const imgs = await imageGenService.generateImages(basePrompt, Number(count)||2)
    const savedPaths = await imageGenService.persistToUploads(imgs, `prod-${String(prod._id).slice(-6)}`)
    if (!savedPaths.length) return res.status(500).json({ message: 'Failed to generate images' })
    const next = Array.from(new Set([...(prod.images||[]), ...savedPaths]))
    prod.images = next
    if (!prod.imagePath && next.length) prod.imagePath = next[0]
    await prod.save()
    return res.json({ success:true, product: prod, added: savedPaths.length, images: savedPaths })
  }catch(err){
    console.error('AI image gen error:', err)
    return res.status(500).json({ message: err?.message || 'Failed to generate images' })
  }
})

// Delete product (admin; user owner; manager with permission on owner's products)
router.delete('/:id', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { id } = req.params
  const prod = await Product.findById(id)
  if (!prod) return res.status(404).json({ message: 'Product not found' })
  if (req.user.role !== 'admin'){
    let ownerId = req.user.id
    if (req.user.role === 'manager'){
      const mgr = await User.findById(req.user.id).select('managerPermissions createdBy')
      if (!mgr || !mgr.managerPermissions?.canManageProducts){ return res.status(403).json({ message: 'Manager not allowed to manage products' }) }
      ownerId = String(mgr.createdBy || req.user.id)
    }
    if (String(prod.createdBy) !== String(ownerId)) return res.status(403).json({ message: 'Not allowed' })
  }
  await Product.deleteOne({ _id: id })
  res.json({ message: 'Deleted' })
})

// Generate product description using Gemini AI
router.post('/generate-description', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try {
    const { productName, category, additionalInfo } = req.body

    if (!productName || !category) {
      return res.status(400).json({ 
        message: 'Product name and category are required' 
      })
    }

    // Ensure Gemini can initialize from Settings if not yet initialized
    if (!(await geminiService.ensureInitialized())) {
      return res.status(503).json({ 
        message: 'AI service is not available. Please configure API key in Settings.' 
      })
    }

    const description = await geminiService.generateProductDescription(
      productName, 
      category, 
      additionalInfo || ''
    )

    const tags = await geminiService.generateProductTags(
      productName, 
      category, 
      description.description
    )

    res.json({
      success: true,
      data: {
        ...description,
        tags
      }
    })
  } catch (error) {
    console.error('Generate description error:', error)
    res.status(500).json({ 
      message: error.message || 'Failed to generate product description' 
    })
  }
})

// Get available product categories
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      'Skincare',
      'Haircare', 
      'Bodycare',
      'Makeup',
      'Fragrance',
      'Health & Wellness',
      'Baby Care',
      'Men\'s Grooming',
      'Tools & Accessories',
      'Gift Sets',
      'Other'
    ]

    res.json({
      success: true,
      categories
    })
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ 
      message: 'Failed to fetch categories' 
    })
  }
})

// Add stock to product (User/Manager)
router.post('/:id/stock/add', auth, allowRoles('user', 'manager'), async (req, res) => {
  try {
    const { id } = req.params
    const { country, quantity, notes } = req.body

    if (!country || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Country and valid quantity are required' })
    }

    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Initialize stockByCountry if not exists
    if (!product.stockByCountry) {
      product.stockByCountry = {}
    }

    // Add to existing stock
    const currentStock = product.stockByCountry[country] || 0
    const addedQuantity = Number(quantity)
    product.stockByCountry[country] = currentStock + addedQuantity

    // Update stockQty (total across all countries)
    let totalStock = 0
    Object.values(product.stockByCountry).forEach(val => {
      totalStock += Number(val || 0)
    })
    product.stockQty = totalStock
    product.inStock = totalStock > 0

    // Update totalPurchased (cumulative inventory added)
    product.totalPurchased = (product.totalPurchased || 0) + addedQuantity

    // Add to stock history
    if (!product.stockHistory) {
      product.stockHistory = []
    }

    product.stockHistory.push({
      country,
      quantity: addedQuantity,
      notes: notes || '',
      addedBy: req.user.id,
      date: new Date()
    })

    await product.save()

    res.json({
      message: 'Stock added successfully',
      product,
      newStock: product.stockByCountry[country],
      totalStock: product.stockQty
    })
  } catch (error) {
    console.error('Add stock error:', error)
    res.status(500).json({ message: error.message || 'Failed to add stock' })
  }
})

// Get stock history for a product
router.get('/:id/stock/history', auth, async (req, res) => {
  try {
    const { id } = req.params

    const product = await Product.findById(id)
      .populate('stockHistory.addedBy', 'firstName lastName email')
      .lean()

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const history = product.stockHistory || []

    // Sort by date descending (most recent first)
    history.sort((a, b) => new Date(b.date) - new Date(a.date))

    res.json({
      success: true,
      history
    })
  } catch (error) {
    console.error('Get stock history error:', error)
    res.status(500).json({ message: 'Failed to fetch stock history' })
  }
})

// Migration endpoint: Set totalPurchased for all products (admin only)
router.post('/migrate/total-purchased', auth, allowRoles('admin'), async (req, res) => {
  try {
    const products = await Product.find({})
    let updated = 0

    for (const product of products) {
      // Calculate totalPurchased from stockHistory if available
      let totalFromHistory = 0
      if (Array.isArray(product.stockHistory) && product.stockHistory.length > 0) {
        totalFromHistory = product.stockHistory.reduce((sum, entry) => {
          return sum + (Number(entry.quantity) || 0)
        }, 0)
      }

      // If we have stockHistory, use that as totalPurchased
      // Otherwise, use current stockQty as initial purchase
      const totalPurchased = totalFromHistory > 0 ? totalFromHistory : (product.stockQty || 0)

      if (totalPurchased > 0 || product.totalPurchased == null) {
        product.totalPurchased = totalPurchased
        await product.save()
        updated++
      }
    }

    res.json({
      success: true,
      message: `Migration complete! Updated ${updated} products.`,
      totalProducts: products.length,
      updated
    })
  } catch (error) {
    console.error('Migration error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Migration failed', 
      error: error.message 
    })
  }
})

export default router
