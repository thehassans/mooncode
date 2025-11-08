import Setting from '../models/Setting.js'

class GoogleMapsService {
  constructor() {
    this.apiKey = null
    this.baseUrl = 'https://maps.googleapis.com/maps/api'
  }

  /**
   * Get API key from database or environment variable
   */
  async getApiKey() {
    try {
      // Try to get from database first
      const doc = await Setting.findOne({ key: 'ai' }).lean()
      const dbKey = doc?.value?.googleMapsApiKey
      
      if (dbKey) {
        this.apiKey = dbKey
        return dbKey
      }
      
      // Fall back to environment variable
      const envKey = process.env.GOOGLE_MAPS_API_KEY
      if (envKey) {
        this.apiKey = envKey
        return envKey
      }
      
      throw new Error('Google Maps API key not configured')
    } catch (err) {
      console.error('Error getting Google Maps API key:', err.message)
      throw err
    }
  }

  /**
   * Geocode an address to coordinates
   * @param {string} address - Address to geocode
   * @returns {Promise<Object>} - { lat, lng, formatted_address, address_components }
   */
  async geocode(address) {
    try {
      const apiKey = await this.getApiKey()
      const url = `${this.baseUrl}/geocode/json?address=${encodeURIComponent(address)}&language=en&key=${encodeURIComponent(apiKey)}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0]
        return {
          success: true,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formatted_address: result.formatted_address,
          address_components: result.address_components,
          place_id: result.place_id,
          raw: result
        }
      } else if (data.status === 'ZERO_RESULTS') {
        return {
          success: false,
          error: 'Location not found',
          status: data.status
        }
      } else if (data.status === 'REQUEST_DENIED') {
        return {
          success: false,
          error: 'API key invalid or Geocoding API not enabled',
          status: data.status
        }
      } else {
        return {
          success: false,
          error: data.error_message || `Geocoding failed: ${data.status}`,
          status: data.status
        }
      }
    } catch (err) {
      console.error('Google Maps geocode error:', err)
      return {
        success: false,
        error: err.message || 'Geocoding request failed'
      }
    }
  }

  /**
   * Reverse geocode coordinates to address
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<Object>} - { formatted_address, city, area, address_components }
   */
  async reverseGeocode(lat, lng) {
    try {
      const apiKey = await this.getApiKey()
      const url = `${this.baseUrl}/geocode/json?latlng=${lat},${lng}&language=en&key=${encodeURIComponent(apiKey)}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0]
        
        // Extract city and area from address components
        let city = ''
        let area = ''
        let country = ''
        
        for (const component of result.address_components || []) {
          if (component.types.includes('locality')) {
            city = component.long_name
          } else if (component.types.includes('sublocality') || component.types.includes('sublocality_level_1')) {
            area = component.long_name
          } else if (!area && component.types.includes('neighborhood')) {
            area = component.long_name
          } else if (component.types.includes('country')) {
            country = component.long_name
          }
        }
        
        return {
          success: true,
          formatted_address: result.formatted_address,
          city,
          area,
          country,
          address_components: result.address_components,
          place_id: result.place_id,
          raw: result
        }
      } else if (data.status === 'ZERO_RESULTS') {
        return {
          success: false,
          error: 'No address found for these coordinates',
          status: data.status
        }
      } else if (data.status === 'REQUEST_DENIED') {
        return {
          success: false,
          error: 'API key invalid or Geocoding API not enabled',
          status: data.status
        }
      } else {
        return {
          success: false,
          error: data.error_message || `Reverse geocoding failed: ${data.status}`,
          status: data.status
        }
      }
    } catch (err) {
      console.error('Google Maps reverse geocode error:', err)
      return {
        success: false,
        error: err.message || 'Reverse geocoding request failed'
      }
    }
  }

  /**
   * Resolve WhatsApp location code (Plus Code or address)
   * @param {string} locationCode - Plus code or address string
   * @returns {Promise<Object>} - Complete location data
   */
  async resolveWhatsAppLocation(locationCode) {
    try {
      const result = await this.geocode(locationCode)
      
      if (result.success) {
        // Get detailed address info via reverse geocoding
        // This ensures we get the actual street address, not the Plus Code
        const reverseResult = await this.reverseGeocode(result.lat, result.lng)
        
        if (reverseResult.success) {
          return {
            success: true,
            lat: result.lat,
            lng: result.lng,
            // Use reverse geocoded address (actual street address) instead of geocoded one (Plus Code)
            formatted_address: reverseResult.formatted_address,
            city: reverseResult.city || '',
            area: reverseResult.area || '',
            country: reverseResult.country || '',
            address_components: reverseResult.address_components
          }
        } else {
          // Fallback to geocode result if reverse geocoding fails
          return {
            success: true,
            lat: result.lat,
            lng: result.lng,
            formatted_address: result.formatted_address,
            city: '',
            area: '',
            country: '',
            address_components: result.address_components
          }
        }
      }
      
      return result
    } catch (err) {
      console.error('WhatsApp location resolution error:', err)
      return {
        success: false,
        error: err.message || 'Failed to resolve WhatsApp location'
      }
    }
  }

  /**
   * Validate address and check if it's in allowed city
   * @param {string} address - Address to validate
   * @param {string} expectedCity - Expected city name
   * @returns {Promise<Object>} - Validation result
   */
  async validateAddress(address, expectedCity = null) {
    try {
      const result = await this.geocode(address)
      
      if (!result.success) {
        return {
          valid: false,
          error: result.error
        }
      }
      
      // Extract city from result
      let city = ''
      for (const component of result.address_components || []) {
        if (component.types.includes('locality')) {
          city = component.long_name
          break
        }
      }
      
      // Validate against expected city if provided
      if (expectedCity) {
        const normalizedCity = city.toLowerCase().trim()
        const normalizedExpected = expectedCity.toLowerCase().trim()
        
        if (normalizedCity !== normalizedExpected) {
          return {
            valid: false,
            error: `Address is in ${city}, but order is for ${expectedCity}`,
            resolvedCity: city,
            expectedCity: expectedCity
          }
        }
      }
      
      return {
        valid: true,
        lat: result.lat,
        lng: result.lng,
        formatted_address: result.formatted_address,
        city,
        address_components: result.address_components
      }
    } catch (err) {
      return {
        valid: false,
        error: err.message || 'Address validation failed'
      }
    }
  }

  /**
   * Get distance between two locations
   * @param {Object} origin - { lat, lng } or address string
   * @param {Object} destination - { lat, lng } or address string
   * @returns {Promise<Object>} - Distance and duration
   */
  async getDistance(origin, destination) {
    try {
      const apiKey = await this.getApiKey()
      
      // Format origins and destinations
      const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`
      const destStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`
      
      const url = `${this.baseUrl}/distancematrix/json?origins=${encodeURIComponent(originStr)}&destinations=${encodeURIComponent(destStr)}&key=${encodeURIComponent(apiKey)}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'OK' && data.rows && data.rows[0]?.elements?.[0]) {
        const element = data.rows[0].elements[0]
        
        if (element.status === 'OK') {
          return {
            success: true,
            distance: {
              text: element.distance.text,
              value: element.distance.value // in meters
            },
            duration: {
              text: element.duration.text,
              value: element.duration.value // in seconds
            }
          }
        }
      }
      
      return {
        success: false,
        error: 'Could not calculate distance'
      }
    } catch (err) {
      console.error('Distance calculation error:', err)
      return {
        success: false,
        error: err.message || 'Distance calculation failed'
      }
    }
  }

  /**
   * Test API connection
   * @returns {Promise<Object>} - Test result
   */
  async testConnection() {
    try {
      const apiKey = await this.getApiKey()
      
      // Test with a known location (Dubai coordinates)
      const testLat = 25.2048
      const testLng = 55.2708
      const url = `${this.baseUrl}/geocode/json?latlng=${testLat},${testLng}&key=${encodeURIComponent(apiKey)}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'OK') {
        return {
          ok: true,
          message: 'Connection successful'
        }
      } else if (data.status === 'REQUEST_DENIED') {
        return {
          ok: false,
          message: 'API key invalid or Geocoding API not enabled'
        }
      } else {
        return {
          ok: false,
          message: data.error_message || `Test failed: ${data.status}`
        }
      }
    } catch (err) {
      return {
        ok: false,
        message: err.message || 'Connection test failed'
      }
    }
  }
}

// Export singleton instance
export default new GoogleMapsService()
