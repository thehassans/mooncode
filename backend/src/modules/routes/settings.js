import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import Setting from '../models/Setting.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { auth, allowRoles } from '../middleware/auth.js'
import mime from 'mime-types'
import googleMapsService from '../services/googleMapsService.js'

const router = express.Router()

// Ensure uploads/branding directory exists
const BRANDING_DIR = path.resolve(process.cwd(), 'uploads', 'branding')
try { fs.mkdirSync(BRANDING_DIR, { recursive: true }) } catch {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BRANDING_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now()
    const safe = String(file.originalname || 'logo').replace(/[^a-zA-Z0-9_.-]/g, '_')
    cb(null, `${ts}_${safe}`)
  }
})

// Currency conversion settings
function defaultCurrencyConfig(){
  // Store SAR-per-unit for UI conversions, and PKR-per-unit for finance
  return {
    anchor: 'SAR',
    sarPerUnit: {
      SAR: 1,
      AED: 1.02,
      OMR: 9.78,
      BHD: 9.94,
      INR: 0.046,
      KWD: 12.2,
      QAR: 1.03,
      USD: 3.75,
      CNY: 0.52,
    },
    pkrPerUnit: {
      AED: 76,
      OMR: 726,
      SAR: 72,
      BHD: 830,
      KWD: 880,
      QAR: 79,
      INR: 3.3,
      USD: 278,
      CNY: 39,
    },
    enabled: ['AED','OMR','SAR','BHD','INR','KWD','QAR','USD','CNY'],
    updatedAt: new Date(),
  }
}

// GET /api/settings/currency
router.get('/currency', auth, allowRoles('admin','user','manager'), async (_req, res) => {
  try{
    const doc = await Setting.findOne({ key: 'currency' }).lean()
    const val = (doc && doc.value) || defaultCurrencyConfig()
    // Ensure reasonable structure
    const cfg = { ...defaultCurrencyConfig(), ...(val||{}) }
    res.json({ success:true, ...cfg })
  }catch(e){ res.status(500).json({ success:false, error: e?.message || 'failed' }) }
})

// POST /api/settings/currency
router.post('/currency', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try{
    const body = req.body || {}
    let doc = await Setting.findOne({ key: 'currency' })
    if (!doc) doc = new Setting({ key: 'currency', value: defaultCurrencyConfig() })
    const cur = (doc.value && typeof doc.value === 'object') ? doc.value : defaultCurrencyConfig()
    const out = { ...defaultCurrencyConfig(), ...cur }

    // Accept partial updates
    if (typeof body.anchor === 'string' && body.anchor.trim()) out.anchor = body.anchor.trim().toUpperCase()
    if (body.sarPerUnit && typeof body.sarPerUnit === 'object'){
      out.sarPerUnit = { ...out.sarPerUnit }
      for (const [k,v] of Object.entries(body.sarPerUnit)){
        const key = String(k).toUpperCase()
        const num = Number(v)
        if (Number.isFinite(num) && num > 0) out.sarPerUnit[key] = num
      }
    }
    if (body.pkrPerUnit && typeof body.pkrPerUnit === 'object'){
      out.pkrPerUnit = { ...out.pkrPerUnit }
      for (const [k,v] of Object.entries(body.pkrPerUnit)){
        const key = String(k).toUpperCase()
        const num = Number(v)
        if (Number.isFinite(num) && num > 0) out.pkrPerUnit[key] = num
      }
    }
    if (Array.isArray(body.enabled)){
      out.enabled = Array.from(new Set(body.enabled.map(c=> String(c).toUpperCase()).filter(Boolean)))
    }
    out.updatedAt = new Date()
    doc.value = out
    await doc.save()
    res.json({ success:true })
  }catch(e){ res.status(500).json({ success:false, error: e?.message || 'failed' }) }
})

// POST /api/settings/ai/test (admin) — does not persist; validates credentials/connectivity
router.post('/ai/test', auth, allowRoles('admin','user'), async (req, res) => {
  const tests = { gemini: { ok:false, message:'' }, googleMaps: { ok:false, message:'' } }
  try{
    // Load existing settings for defaults
    const doc = await Setting.findOne({ key: 'ai' }).lean().catch(()=>null)
    const cur = (doc && doc.value) || {}
    const body = req.body || {}

    // Test Gemini
    try{
      const key = body.geminiApiKey || cur.geminiApiKey || process.env.GEMINI_API_KEY || ''
      if (!key) throw new Error('Missing Gemini API key')
      const genAI = new GoogleGenerativeAI(key)
      const descModel = body.geminiDescModel || cur.geminiDescModel || 'gemini-1.5-pro'
      const model = genAI.getGenerativeModel({ model: descModel })
      // Tiny prompt
      const r = await model.generateContent('ping')
      const t = await r.response.text()
      tests.gemini.ok = true
      tests.gemini.message = t ? 'OK' : 'OK (empty response)'
    }catch(e){
      tests.gemini.ok = false
      tests.gemini.message = e?.message || 'Failed'
    }

    // Test Google Maps API
    try{
      const mapsResult = await googleMapsService.testConnection()
      tests.googleMaps.ok = mapsResult.ok
      tests.googleMaps.message = mapsResult.message
    }catch(e){
      tests.googleMaps.ok = false
      tests.googleMaps.message = e?.message || 'Failed'
    }

    res.json({ success:true, tests })
  }catch(e){
    res.status(500).json({ success:false, error: e?.message || 'failed', tests })
  }
})
const upload = multer({ storage })

function toPublicPath(absFilename){
  // Map absolute path in uploads/branding to public /uploads/branding path
  const base = path.basename(absFilename)
  return `/uploads/branding/${encodeURIComponent(base)}`
}

// GET current branding (public)
router.get('/branding', async (_req, res) => {
  try{
    const doc = await Setting.findOne({ key: 'branding' }).lean()
    const val = (doc && doc.value) || {}
    const headerLogo = typeof val.headerLogo === 'string' ? val.headerLogo : null
    const loginLogo = typeof val.loginLogo === 'string' ? val.loginLogo : null
    const favicon = typeof val.favicon === 'string' ? val.favicon : null
    const title = typeof val.title === 'string' ? val.title : null
    const appName = typeof val.appName === 'string' ? val.appName : null
    res.json({ headerLogo, loginLogo, favicon, title, appName })
  }catch(e){ res.status(500).json({ error: e?.message || 'failed' }) }
})

// POST upload branding assets (admin)
router.post('/branding', auth, allowRoles('admin'), upload.fields([
  { name: 'header', maxCount: 1 },
  { name: 'login', maxCount: 1 },
  { name: 'favicon', maxCount: 1 },
]), async (req, res) => {
  try{
    const headerFile = req.files?.header?.[0]
    const loginFile = req.files?.login?.[0]
    const faviconFile = req.files?.favicon?.[0]

    let doc = await Setting.findOne({ key: 'branding' })
    if (!doc) doc = new Setting({ key: 'branding', value: {} })

    const value = (doc.value && typeof doc.value === 'object') ? doc.value : {}
    if (headerFile) value.headerLogo = toPublicPath(headerFile.path)
    if (loginFile) value.loginLogo = toPublicPath(loginFile.path)
    if (faviconFile) value.favicon = toPublicPath(faviconFile.path)
    if (typeof req.body?.title === 'string') value.title = req.body.title
    if (typeof req.body?.appName === 'string') value.appName = req.body.appName
    doc.value = value
    await doc.save()

    res.json({
      headerLogo: value.headerLogo || null,
      loginLogo: value.loginLogo || null,
      favicon: value.favicon || null,
      title: value.title || null,
      appName: value.appName || null,
    })
  }catch(e){ res.status(500).json({ error: e?.message || 'failed' }) }
})

// Dynamic PWA manifest using saved branding
router.get('/manifest', async (req, res) => {
  try{
    const doc = await Setting.findOne({ key: 'branding' }).lean()
    const val = (doc && doc.value) || {}
    const name = (typeof val.title === 'string' && val.title.trim()) ? val.title.trim() : 'BuySial Commerce'
    const shortName = (typeof val.appName === 'string' && val.appName.trim()) ? val.appName.trim() : name
    const themeColor = '#0f172a'

    // Use same favicon path for icons; browsers will scale. Recommended to upload a 512x512 PNG as favicon.
    const iconSrc = (typeof val.favicon === 'string' && val.favicon) ? val.favicon : null
    const iconType = iconSrc ? (mime.lookup(iconSrc) || 'image/png') : 'image/png'

    const icons = iconSrc ? [
      { src: iconSrc, sizes: '192x192', type: iconType, purpose: 'any maskable' },
      { src: iconSrc, sizes: '512x512', type: iconType, purpose: 'any maskable' },
    ] : [
      { src: '/BuySial2.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/BuySial2.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ]

    const manifest = {
      name,
      short_name: shortName,
      start_url: '/',
      display: 'standalone',
      background_color: themeColor,
      theme_color: themeColor,
      icons,
    }
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
    res.json(manifest)
  }catch(e){ res.status(500).json({ error: e?.message || 'failed' }) }
})

// Facebook settings: store/retrieve Access Token and App ID (owner user)
// GET /api/settings/facebook
router.get('/facebook', auth, allowRoles('admin','user'), async (req, res) => {
  try{
    const doc = await Setting.findOne({ key: 'facebook' }).lean()
    const val = (doc && doc.value) || {}
    const mask = (s)=> typeof s === 'string' && s ? s.slice(0,4) + '••••' + s.slice(-2) : null
    res.json({ accessToken: val.accessToken ? mask(val.accessToken) : null, appId: val.appId || null })
  }catch(e){ res.status(500).json({ error: e?.message || 'failed' }) }
})

// POST /api/settings/facebook
router.post('/facebook', auth, allowRoles('admin','user'), async (req, res) => {
  try{
    const { accessToken, appId } = req.body || {}
    let doc = await Setting.findOne({ key: 'facebook' })
    if (!doc) doc = new Setting({ key: 'facebook', value: {} })
    const value = (doc.value && typeof doc.value === 'object') ? doc.value : {}
    if (typeof accessToken === 'string') value.accessToken = accessToken.trim()
    if (typeof appId === 'string') value.appId = appId.trim()
    doc.value = value
    await doc.save()
    res.json({ success:true })
  }catch(e){ res.status(500).json({ error: e?.message || 'failed' }) }
})

export default router

// AI settings: store/retrieve keys for Gemini and Image Generation
// GET /api/settings/ai (admin)
router.get('/ai', auth, allowRoles('admin','user'), async (_req, res) => {
  try{
    const doc = await Setting.findOne({ key: 'ai' }).lean()
    const val = (doc && doc.value) || {}
    // Mask secrets when returning
    const mask = (s)=> typeof s === 'string' && s ? s.slice(0,4) + '••••' + s.slice(-2) : null
    res.json({
      geminiApiKey: val.geminiApiKey ? mask(val.geminiApiKey) : null,
      googleMapsApiKey: val.googleMapsApiKey ? mask(val.googleMapsApiKey) : null,
      geminiDescModel: val.geminiDescModel || 'gemini-1.5-pro',
      geminiImageModel: val.geminiImageModel || 'imagen-3.0-generate-001',
      imageGenApiKey: val.imageGenApiKey ? mask(val.imageGenApiKey) : null,
      imageGenApiUrl: val.imageGenApiUrl || null,
      defaultImagePrompt: val.defaultImagePrompt || null,
    })
  }catch(e){ res.status(500).json({ error: e?.message || 'failed' }) }
})

// POST /api/settings/ai (admin)
router.post('/ai', auth, allowRoles('admin','user'), async (req, res) => {
  try{
    const { geminiApiKey, googleMapsApiKey, geminiDescModel, geminiImageModel, imageGenApiKey, imageGenApiUrl, defaultImagePrompt } = req.body || {}
    console.log('Saving AI settings:', { 
      hasGeminiKey: !!geminiApiKey, 
      hasGoogleMapsKey: !!googleMapsApiKey,
      googleMapsKeyValue: googleMapsApiKey ? googleMapsApiKey.substring(0, 10) + '...' : 'none',
      geminiDescModel, 
      geminiImageModel 
    })
    let doc = await Setting.findOne({ key: 'ai' })
    if (!doc) doc = new Setting({ key: 'ai', value: {} })
    const value = (doc.value && typeof doc.value === 'object') ? doc.value : {}
    if (typeof geminiApiKey === 'string' && geminiApiKey.trim()) value.geminiApiKey = geminiApiKey.trim()
    if (typeof googleMapsApiKey === 'string' && googleMapsApiKey.trim()) value.googleMapsApiKey = googleMapsApiKey.trim()
    if (typeof geminiDescModel === 'string' && geminiDescModel.trim()) value.geminiDescModel = geminiDescModel.trim()
    if (typeof geminiImageModel === 'string' && geminiImageModel.trim()) value.geminiImageModel = geminiImageModel.trim()
    if (typeof imageGenApiKey === 'string' && imageGenApiKey.trim()) value.imageGenApiKey = imageGenApiKey.trim()
    if (typeof imageGenApiUrl === 'string' && imageGenApiUrl.trim()) value.imageGenApiUrl = imageGenApiUrl.trim()
    if (typeof defaultImagePrompt === 'string') value.defaultImagePrompt = defaultImagePrompt
    doc.value = value
    await doc.save()
    console.log('AI settings saved successfully:', { googleMapsApiKey: value.googleMapsApiKey ? 'saved' : 'not saved' })
    res.json({ success:true })
  }catch(e){ 
    console.error('Error saving AI settings:', e)
    res.status(500).json({ error: e?.message || 'failed' }) 
  }
})

// GET /api/settings/api-keys - Simplified API keys for profile settings
router.get('/api-keys', auth, allowRoles('admin','user'), async (_req, res) => {
  try {
    const doc = await Setting.findOne({ key: 'ai' }).lean()
    const val = (doc && doc.value) || {}
    
    // Mask secrets when returning
    const mask = (s) => typeof s === 'string' && s ? s.slice(0, 4) + '••••' + s.slice(-2) : ''
    
    res.json({
      geminiKey: val.geminiApiKey ? mask(val.geminiApiKey) : '',
      openaiKey: val.openaiApiKey ? mask(val.openaiApiKey) : '',
      mapsKey: val.googleMapsApiKey ? mask(val.googleMapsApiKey) : ''
    })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'failed' })
  }
})

// POST /api/settings/api-keys - Save API keys from profile settings
router.post('/api-keys', auth, allowRoles('admin','user'), async (req, res) => {
  try {
    const { geminiKey, openaiKey, mapsKey } = req.body || {}
    
    let doc = await Setting.findOne({ key: 'ai' })
    if (!doc) doc = new Setting({ key: 'ai', value: {} })
    
    const value = (doc.value && typeof doc.value === 'object') ? doc.value : {}
    
    // Only update if provided and not masked
    if (typeof geminiKey === 'string' && geminiKey.trim() && !geminiKey.includes('••')) {
      value.geminiApiKey = geminiKey.trim()
    }
    if (typeof openaiKey === 'string' && openaiKey.trim() && !openaiKey.includes('••')) {
      value.openaiApiKey = openaiKey.trim()
    }
    if (typeof mapsKey === 'string' && mapsKey.trim() && !mapsKey.includes('••')) {
      value.googleMapsApiKey = mapsKey.trim()
    }
    
    doc.value = value
    await doc.save()
    
    res.json({ success: true })
  } catch (e) {
    console.error('Error saving API keys:', e)
    res.status(500).json({ error: e?.message || 'failed' })
  }
})
