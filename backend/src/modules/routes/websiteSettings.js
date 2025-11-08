import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import Setting from '../models/Setting.js'
import { auth, allowRoles } from '../middleware/auth.js'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure multer for banner uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'banners')
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `banner-${uniqueSuffix}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

/**
 * Get all banners (public endpoint)
 * Query params: page (optional) - filter by page (e.g., 'catalog', 'product-detail', 'checkout')
 */
router.get('/banners', async (req, res) => {
  try {
    const { page } = req.query
    const bannersSetting = await Setting.findOne({ key: 'websiteBanners' })
    let banners = bannersSetting?.value || []
    
    // Filter only active banners for public access if not authenticated
    const isAuthenticated = req.headers.authorization
    if (!isAuthenticated) {
      banners = banners.filter(b => b.active)
    }
    
    // Filter by page if specified
    if (page) {
      banners = banners.filter(b => b.page === page)
    }
    
    return res.json({ banners })
  } catch (err) {
    return res.status(500).json({ message: err?.message || 'Failed to get banners' })
  }
})

/**
 * Upload a new banner (authenticated)
 */
router.post('/banners', auth, allowRoles('admin', 'user'), upload.single('banner'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }
    
    const { title, link, active, page } = req.body
    
    // Build image URL
    const imageUrl = `/uploads/banners/${req.file.filename}`
    
    // Get existing banners
    let bannersSetting = await Setting.findOne({ key: 'websiteBanners' })
    const banners = bannersSetting?.value || []
    
    // Create new banner object
    const newBanner = {
      _id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      imageUrl,
      title: title || '',
      link: link || '',
      page: page || 'catalog', // Default to catalog page
      active: active === 'true' || active === true,
      createdAt: new Date(),
      uploadedBy: req.user.id
    }
    
    banners.push(newBanner)
    
    // Save to database
    if (bannersSetting) {
      bannersSetting.value = banners
      await bannersSetting.save()
    } else {
      await Setting.create({
        key: 'websiteBanners',
        value: banners
      })
    }
    
    return res.json({ 
      ok: true, 
      message: 'Banner uploaded successfully',
      banner: newBanner
    })
  } catch (err) {
    console.error('Banner upload error:', err)
    return res.status(500).json({ message: err?.message || 'Failed to upload banner' })
  }
})

/**
 * Delete a banner (authenticated)
 */
router.get('/banners/:id/delete', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const { id } = req.params
    
    const bannersSetting = await Setting.findOne({ key: 'websiteBanners' })
    if (!bannersSetting) {
      return res.status(404).json({ message: 'No banners found' })
    }
    
    const banners = bannersSetting.value || []
    const bannerIndex = banners.findIndex(b => b._id === id)
    
    if (bannerIndex === -1) {
      return res.status(404).json({ message: 'Banner not found' })
    }
    
    // Delete file from filesystem
    const banner = banners[bannerIndex]
    if (banner.imageUrl) {
      try {
        const filePath = path.resolve(process.cwd(), banner.imageUrl.replace(/^\//, ''))
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (fileErr) {
        console.error('Failed to delete banner file:', fileErr)
      }
    }
    
    // Remove from array
    banners.splice(bannerIndex, 1)
    bannersSetting.value = banners
    await bannersSetting.save()
    
    return res.json({ ok: true, message: 'Banner deleted successfully' })
  } catch (err) {
    console.error('Banner delete error:', err)
    return res.status(500).json({ message: err?.message || 'Failed to delete banner' })
  }
})

/**
 * Toggle banner active status (authenticated)
 */
router.get('/banners/:id/toggle', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const { id } = req.params
    
    const bannersSetting = await Setting.findOne({ key: 'websiteBanners' })
    if (!bannersSetting) {
      return res.status(404).json({ message: 'No banners found' })
    }
    
    const banners = bannersSetting.value || []
    const banner = banners.find(b => b._id === id)
    
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' })
    }
    
    // Toggle active status
    banner.active = !banner.active
    bannersSetting.value = banners
    await bannersSetting.save()
    
    return res.json({ 
      ok: true, 
      message: `Banner ${banner.active ? 'activated' : 'deactivated'} successfully`,
      banner
    })
  } catch (err) {
    console.error('Banner toggle error:', err)
    return res.status(500).json({ message: err?.message || 'Failed to toggle banner' })
  }
})

/**
 * Update banner order (authenticated)
 */
router.post('/banners/reorder', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const { bannerIds } = req.body
    
    if (!Array.isArray(bannerIds)) {
      return res.status(400).json({ message: 'Invalid banner order' })
    }
    
    const bannersSetting = await Setting.findOne({ key: 'websiteBanners' })
    if (!bannersSetting) {
      return res.status(404).json({ message: 'No banners found' })
    }
    
    const banners = bannersSetting.value || []
    
    // Reorder banners based on provided IDs
    const reorderedBanners = []
    for (const id of bannerIds) {
      const banner = banners.find(b => b._id === id)
      if (banner) {
        reorderedBanners.push(banner)
      }
    }
    
    // Add any banners not in the provided order at the end
    for (const banner of banners) {
      if (!bannerIds.includes(banner._id)) {
        reorderedBanners.push(banner)
      }
    }
    
    bannersSetting.value = reorderedBanners
    await bannersSetting.save()
    
    return res.json({ ok: true, message: 'Banner order updated successfully' })
  } catch (err) {
    console.error('Banner reorder error:', err)
    return res.status(500).json({ message: err?.message || 'Failed to reorder banners' })
  }
})

/**
 * Get page content (public endpoint)
 * Query params: page (required) - page identifier (e.g., 'catalog', 'product-detail')
 */
router.get('/content', async (req, res) => {
  try {
    const { page } = req.query
    
    if (!page) {
      return res.status(400).json({ message: 'Page parameter is required' })
    }
    
    const contentSetting = await Setting.findOne({ key: `pageContent_${page}` })
    const content = contentSetting?.value || {}
    
    return res.json({ content })
  } catch (err) {
    return res.status(500).json({ message: err?.message || 'Failed to get page content' })
  }
})

/**
 * Save page content (authenticated)
 * Body: { page, elements: [{ id, text, styles }] }
 */
router.post('/content', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const { page, elements } = req.body
    
    if (!page) {
      return res.status(400).json({ message: 'Page parameter is required' })
    }
    
    if (!Array.isArray(elements)) {
      return res.status(400).json({ message: 'Elements must be an array' })
    }
    
    // Get or create content setting
    let contentSetting = await Setting.findOne({ key: `pageContent_${page}` })
    
    const contentData = {
      page,
      elements,
      lastUpdated: new Date(),
      updatedBy: req.user.id
    }
    
    if (contentSetting) {
      contentSetting.value = contentData
      await contentSetting.save()
    } else {
      await Setting.create({
        key: `pageContent_${page}`,
        value: contentData
      })
    }
    
    return res.json({ 
      ok: true, 
      message: 'Page content saved successfully',
      content: contentData
    })
  } catch (err) {
    console.error('Content save error:', err)
    return res.status(500).json({ message: err?.message || 'Failed to save page content' })
  }
})

/**
 * Delete page content (authenticated)
 */
router.delete('/content/:page', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const { page } = req.params
    
    await Setting.deleteOne({ key: `pageContent_${page}` })
    
    return res.json({ ok: true, message: 'Page content deleted successfully' })
  } catch (err) {
    console.error('Content delete error:', err)
    return res.status(500).json({ message: err?.message || 'Failed to delete page content' })
  }
})

export default router
