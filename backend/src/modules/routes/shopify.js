import express from 'express'
import crypto from 'crypto'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Setting from '../models/Setting.js'
import User from '../models/User.js'
import { auth, allowRoles } from '../middleware/auth.js'
import * as shopifyService from '../services/shopifyService.js'

const router = express.Router()

/**
 * Get Shopify settings
 */
router.get('/settings', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const shopifyStore = await Setting.findOne({ key: 'shopifyStore' })
    const shopifyAccessToken = await Setting.findOne({ key: 'shopifyAccessToken' })
    const shopifyWebhookSecret = await Setting.findOne({ key: 'shopifyWebhookSecret' })
    const shopifyApiVersion = await Setting.findOne({ key: 'shopifyApiVersion' })
    
    return res.json({
      shopifyStore: shopifyStore?.value || '',
      shopifyAccessToken: shopifyAccessToken?.value ? '***' + shopifyAccessToken.value.slice(-4) : '',
      shopifyAccessTokenFull: shopifyAccessToken?.value || '',
      shopifyWebhookSecret: shopifyWebhookSecret?.value || '',
      shopifyApiVersion: shopifyApiVersion?.value || '2024-01'
    })
  } catch (err) {
    return res.status(500).json({ message: err?.message || 'Failed to get Shopify settings' })
  }
})

/**
 * Save Shopify settings
 */
router.post('/settings', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const { shopifyStore, shopifyAccessToken, shopifyWebhookSecret, shopifyApiVersion } = req.body
    
    // Save or update settings
    await Setting.findOneAndUpdate(
      { key: 'shopifyStore' },
      { value: shopifyStore || '' },
      { upsert: true }
    )
    
    if (shopifyAccessToken && shopifyAccessToken !== '***') {
      await Setting.findOneAndUpdate(
        { key: 'shopifyAccessToken' },
        { value: shopifyAccessToken },
        { upsert: true }
      )
    }
    
    await Setting.findOneAndUpdate(
      { key: 'shopifyWebhookSecret' },
      { value: shopifyWebhookSecret || '' },
      { upsert: true }
    )
    
    await Setting.findOneAndUpdate(
      { key: 'shopifyApiVersion' },
      { value: shopifyApiVersion || '2024-01' },
      { upsert: true }
    )
    
    return res.json({ ok: true, message: 'Shopify settings saved successfully' })
  } catch (err) {
    return res.status(500).json({ message: err?.message || 'Failed to save Shopify settings' })
  }
})

/**
 * Sync a specific product to Shopify
 */
router.post('/products/:id/sync', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    
    const result = await shopifyService.syncProductToShopify(req.params.id)
    return res.json({ ok: true, ...result })
  } catch (err) {
    return res.status(500).json({ message: err?.message || 'Failed to sync product to Shopify' })
  }
})

/**
 * Sync all products to Shopify
 */
router.post('/products/sync-all', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const result = await shopifyService.syncAllProductsToShopify()
    return res.json({ ok: true, ...result })
  } catch (err) {
    return res.status(500).json({ message: err?.message || 'Failed to sync products to Shopify' })
  }
})

/**
 * Delete product from Shopify
 */
router.delete('/products/:id', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const result = await shopifyService.deleteProductFromShopify(req.params.id)
    return res.json({ ok: true, ...result })
  } catch (err) {
    return res.status(500).json({ message: err?.message || 'Failed to delete product from Shopify' })
  }
})

/**
 * Update Shopify inventory for a product
 */
router.post('/products/:id/inventory', auth, allowRoles('admin', 'user'), async (req, res) => {
  try {
    const { quantity } = req.body
    const result = await shopifyService.updateShopifyInventory(req.params.id, quantity)
    return res.json({ ok: true, ...result })
  } catch (err) {
    return res.status(500).json({ message: err?.message || 'Failed to update Shopify inventory' })
  }
})

/**
 * Verify Shopify webhook signature
 */
function verifyShopifyWebhook(req, secret) {
  const hmac = req.get('X-Shopify-Hmac-Sha256')
  if (!hmac) return false
  
  const body = req.rawBody || JSON.stringify(req.body)
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64')
  
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash))
}

/**
 * Shopify webhook: Order created
 * This webhook is called when a new order is placed on Shopify
 */
router.post('/webhooks/orders/create', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature
    const webhookSecret = await Setting.findOne({ key: 'shopifyWebhookSecret' })
    if (webhookSecret?.value && !verifyShopifyWebhook(req, webhookSecret.value)) {
      return res.status(401).json({ message: 'Invalid webhook signature' })
    }
    
    // Parse the body
    const orderData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    
    // Check if order already exists
    const existingOrder = await Order.findOne({ shopifyOrderId: orderData.id.toString() })
    if (existingOrder) {
      return res.json({ ok: true, message: 'Order already exists' })
    }
    
    // Get the admin/user who set up Shopify (default creator)
    const adminUser = await User.findOne({ role: 'user' }).sort({ createdAt: 1 })
    if (!adminUser) {
      return res.status(500).json({ message: 'No admin user found' })
    }
    
    // Extract line items and create order items
    const items = []
    for (const lineItem of orderData.line_items || []) {
      // Try to find product by SKU or Shopify product ID
      const product = await Product.findOne({
        $or: [
          { sku: lineItem.sku },
          { shopifyVariantId: lineItem.variant_id?.toString() }
        ]
      })
      
      if (product) {
        items.push({
          productId: product._id,
          quantity: lineItem.quantity
        })
      }
    }
    
    // Calculate total from Shopify order
    const total = parseFloat(orderData.total_price) || 0
    const shippingFee = parseFloat(orderData.total_shipping_price_set?.shop_money?.amount) || 0
    
    // Extract customer info
    const customer = orderData.customer || {}
    const shippingAddress = orderData.shipping_address || {}
    
    // Create order in our system
    const newOrder = new Order({
      customerName: `${shippingAddress.first_name || customer.first_name || ''} ${shippingAddress.last_name || customer.last_name || ''}`.trim() || 'Shopify Customer',
      customerPhone: shippingAddress.phone || customer.phone || customer.default_address?.phone || '',
      phoneCountryCode: shippingAddress.country_code || '',
      orderCountry: shippingAddress.country || '',
      city: shippingAddress.city || '',
      customerArea: shippingAddress.province || '',
      customerAddress: `${shippingAddress.address1 || ''} ${shippingAddress.address2 || ''}`.trim(),
      details: `Shopify Order: ${orderData.name || ''}`,
      items,
      createdBy: adminUser._id,
      createdByRole: 'user',
      orderSource: 'shopify',
      shopifyOrderId: orderData.id.toString(),
      shopifyOrderNumber: orderData.order_number?.toString() || '',
      shopifyOrderName: orderData.name || '',
      total,
      shippingFee,
      codAmount: total, // Assume COD for dropshipping
      status: 'pending',
      shipmentStatus: 'pending'
    })
    
    await newOrder.save()
    
    return res.json({ ok: true, orderId: newOrder._id, message: 'Order created from Shopify' })
  } catch (err) {
    console.error('Shopify webhook error:', err)
    return res.status(500).json({ message: err?.message || 'Failed to process webhook' })
  }
})

/**
 * Shopify webhook: Order fulfilled
 * Called when an order is marked as fulfilled on Shopify
 */
router.post('/webhooks/orders/fulfilled', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSecret = await Setting.findOne({ key: 'shopifyWebhookSecret' })
    if (webhookSecret?.value && !verifyShopifyWebhook(req, webhookSecret.value)) {
      return res.status(401).json({ message: 'Invalid webhook signature' })
    }
    
    const orderData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    
    // Find the order
    const order = await Order.findOne({ shopifyOrderId: orderData.id.toString() })
    if (order) {
      order.status = 'shipped'
      order.shipmentStatus = 'in_transit'
      order.shippedAt = new Date()
      await order.save()
    }
    
    return res.json({ ok: true })
  } catch (err) {
    console.error('Shopify webhook error:', err)
    return res.status(500).json({ message: err?.message || 'Failed to process webhook' })
  }
})

/**
 * Shopify webhook: Order cancelled
 */
router.post('/webhooks/orders/cancelled', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSecret = await Setting.findOne({ key: 'shopifyWebhookSecret' })
    if (webhookSecret?.value && !verifyShopifyWebhook(req, webhookSecret.value)) {
      return res.status(401).json({ message: 'Invalid webhook signature' })
    }
    
    const orderData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    
    // Find the order
    const order = await Order.findOne({ shopifyOrderId: orderData.id.toString() })
    if (order) {
      order.status = 'cancelled'
      order.shipmentStatus = 'cancelled'
      await order.save()
    }
    
    return res.json({ ok: true })
  } catch (err) {
    console.error('Shopify webhook error:', err)
    return res.status(500).json({ message: err?.message || 'Failed to process webhook' })
  }
})

export default router
