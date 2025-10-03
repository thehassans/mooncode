import express from 'express'
import { auth } from '../middleware/auth.js'
import googleMapsService from '../services/googleMapsService.js'

const router = express.Router()

// POST /api/geocode - Geocode an address to coordinates
router.post('/', auth, async (req, res) => {
  try {
    const { address } = req.body
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Address is required' 
      })
    }
    
    const result = await googleMapsService.geocode(address)
    res.json(result)
  } catch (err) {
    console.error('Geocode API error:', err)
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Geocoding failed' 
    })
  }
})

// POST /api/geocode/reverse - Reverse geocode coordinates to address
router.post('/reverse', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        error: 'Latitude and longitude are required' 
      })
    }
    
    const result = await googleMapsService.reverseGeocode(lat, lng)
    res.json(result)
  } catch (err) {
    console.error('Reverse geocode API error:', err)
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Reverse geocoding failed' 
    })
  }
})

// POST /api/geocode/whatsapp - Resolve WhatsApp location code
router.post('/whatsapp', auth, async (req, res) => {
  try {
    const { locationCode } = req.body
    
    if (!locationCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Location code is required' 
      })
    }
    
    const result = await googleMapsService.resolveWhatsAppLocation(locationCode)
    res.json(result)
  } catch (err) {
    console.error('WhatsApp location resolution error:', err)
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Location resolution failed' 
    })
  }
})

// POST /api/geocode/validate - Validate address
router.post('/validate', auth, async (req, res) => {
  try {
    const { address, expectedCity } = req.body
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Address is required' 
      })
    }
    
    const result = await googleMapsService.validateAddress(address, expectedCity)
    res.json(result)
  } catch (err) {
    console.error('Address validation error:', err)
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Address validation failed' 
    })
  }
})

// POST /api/geocode/distance - Calculate distance between two points
router.post('/distance', auth, async (req, res) => {
  try {
    const { origin, destination } = req.body
    
    if (!origin || !destination) {
      return res.status(400).json({ 
        success: false, 
        error: 'Origin and destination are required' 
      })
    }
    
    const result = await googleMapsService.getDistance(origin, destination)
    res.json(result)
  } catch (err) {
    console.error('Distance calculation error:', err)
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Distance calculation failed' 
    })
  }
})

export default router
