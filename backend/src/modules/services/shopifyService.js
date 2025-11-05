import axios from 'axios'
import Product from '../models/Product.js'
import Setting from '../models/Setting.js'

/**
 * Get Shopify configuration from settings
 */
async function getShopifyConfig() {
  const shopifyStore = await Setting.findOne({ key: 'shopifyStore' })
  const shopifyAccessToken = await Setting.findOne({ key: 'shopifyAccessToken' })
  const shopifyApiVersion = await Setting.findOne({ key: 'shopifyApiVersion' })
  
  if (!shopifyStore?.value || !shopifyAccessToken?.value) {
    throw new Error('Shopify configuration missing. Please configure Shopify settings first.')
  }
  
  return {
    store: shopifyStore.value, // e.g., 'your-store.myshopify.com'
    accessToken: shopifyAccessToken.value,
    apiVersion: shopifyApiVersion?.value || '2024-01'
  }
}

/**
 * Make authenticated API request to Shopify
 */
async function shopifyRequest(method, endpoint, data = null) {
  const config = await getShopifyConfig()
  const url = `https://${config.store}/admin/api/${config.apiVersion}${endpoint}`
  
  try {
    const response = await axios({
      method,
      url,
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json'
      },
      data
    })
    return response.data
  } catch (error) {
    console.error('Shopify API Error:', error.response?.data || error.message)
    throw new Error(error.response?.data?.errors || error.message)
  }
}

/**
 * Convert product to Shopify format
 */
function convertProductToShopifyFormat(product, imagePath) {
  // Build absolute image URL
  let imageUrl = null
  if (product.imagePath) {
    // Assuming images are served at https://yourdomain.com/uploads/...
    const baseUrl = process.env.BASE_URL || 'https://web.buysial.com'
    imageUrl = `${baseUrl}${product.imagePath}`
  }
  
  return {
    product: {
      title: product.name,
      body_html: product.description || '',
      vendor: product.brand || 'BuySial',
      product_type: product.category || 'Other',
      tags: (product.tags || []).join(','),
      published: true,
      variants: [
        {
          price: product.onSale ? product.salePrice : product.price,
          compare_at_price: product.onSale ? product.price : null,
          sku: product.sku || product._id.toString(),
          inventory_management: 'shopify',
          inventory_policy: 'deny', // Don't allow overselling
          requires_shipping: true,
          weight: product.weight || 0,
          weight_unit: 'kg'
        }
      ],
      images: imageUrl ? [{ src: imageUrl }] : []
    }
  }
}

/**
 * Sync a product to Shopify (create or update)
 */
export async function syncProductToShopify(productId) {
  try {
    const product = await Product.findById(productId)
    if (!product) {
      throw new Error('Product not found')
    }
    
    const shopifyProduct = convertProductToShopifyFormat(product)
    
    if (product.shopifyProductId) {
      // Update existing product
      const data = await shopifyRequest(
        'PUT',
        `/products/${product.shopifyProductId}.json`,
        shopifyProduct
      )
      
      // Update sync timestamp
      product.lastShopifySync = new Date()
      await product.save()
      
      return {
        success: true,
        action: 'updated',
        shopifyProductId: data.product.id,
        shopifyVariantId: data.product.variants[0].id
      }
    } else {
      // Create new product
      const data = await shopifyRequest('POST', '/products.json', shopifyProduct)
      
      // Save Shopify IDs back to our product
      product.shopifyProductId = data.product.id.toString()
      product.shopifyVariantId = data.product.variants[0].id.toString()
      product.shopifyInventoryItemId = data.product.variants[0].inventory_item_id?.toString() || ''
      product.lastShopifySync = new Date()
      await product.save()
      
      return {
        success: true,
        action: 'created',
        shopifyProductId: data.product.id,
        shopifyVariantId: data.product.variants[0].id
      }
    }
  } catch (error) {
    console.error('Error syncing product to Shopify:', error)
    throw error
  }
}

/**
 * Update Shopify product inventory
 */
export async function updateShopifyInventory(productId, quantity) {
  try {
    const product = await Product.findById(productId)
    if (!product || !product.shopifyInventoryItemId) {
      throw new Error('Product not synced to Shopify')
    }
    
    // First, get the inventory level location
    const locations = await shopifyRequest('GET', '/locations.json')
    const locationId = locations.locations[0]?.id
    
    if (!locationId) {
      throw new Error('No Shopify location found')
    }
    
    // Update inventory level
    const data = await shopifyRequest('POST', '/inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: product.shopifyInventoryItemId,
      available: quantity
    })
    
    return { success: true, data }
  } catch (error) {
    console.error('Error updating Shopify inventory:', error)
    throw error
  }
}

/**
 * Delete a product from Shopify
 */
export async function deleteProductFromShopify(productId) {
  try {
    const product = await Product.findById(productId)
    if (!product || !product.shopifyProductId) {
      return { success: true, message: 'Product not synced to Shopify' }
    }
    
    await shopifyRequest('DELETE', `/products/${product.shopifyProductId}.json`)
    
    // Clear Shopify IDs from our product
    product.shopifyProductId = ''
    product.shopifyVariantId = ''
    product.shopifyInventoryItemId = ''
    product.displayOnShopify = false
    await product.save()
    
    return { success: true, message: 'Product deleted from Shopify' }
  } catch (error) {
    console.error('Error deleting product from Shopify:', error)
    throw error
  }
}

/**
 * Create fulfillment for a Shopify order
 */
export async function createShopifyFulfillment(orderId, trackingNumber, courierName) {
  try {
    const Order = (await import('../models/Order.js')).default
    const order = await Order.findById(orderId)
    
    if (!order || !order.shopifyOrderId) {
      throw new Error('Order not from Shopify')
    }
    
    const fulfillmentData = {
      fulfillment: {
        location_id: null, // Will use default location
        tracking_number: trackingNumber || '',
        tracking_company: courierName || '',
        notify_customer: true
      }
    }
    
    const data = await shopifyRequest(
      'POST',
      `/orders/${order.shopifyOrderId}/fulfillments.json`,
      fulfillmentData
    )
    
    // Save fulfillment ID
    order.shopifyFulfillmentId = data.fulfillment.id.toString()
    await order.save()
    
    return { success: true, fulfillmentId: data.fulfillment.id }
  } catch (error) {
    console.error('Error creating Shopify fulfillment:', error)
    throw error
  }
}

/**
 * Sync all products marked for Shopify display
 */
export async function syncAllProductsToShopify() {
  try {
    const products = await Product.find({ displayOnShopify: true })
    const results = []
    
    for (const product of products) {
      try {
        const result = await syncProductToShopify(product._id)
        results.push({ productId: product._id, productName: product.name, ...result })
      } catch (error) {
        results.push({
          productId: product._id,
          productName: product.name,
          success: false,
          error: error.message
        })
      }
    }
    
    return { success: true, results }
  } catch (error) {
    console.error('Error syncing all products:', error)
    throw error
  }
}
