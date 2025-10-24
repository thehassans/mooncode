import mongoose from 'mongoose'
import Order from '../src/modules/models/Order.js'
import Product from '../src/modules/models/Product.js'
import dotenv from 'dotenv'

dotenv.config()

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/buysial')
    console.log('Connected to database')

    // Find all orders that were created but inventory was never adjusted
    const orders = await Order.find({ 
      inventoryAdjusted: { $ne: true },
      shipmentStatus: { $nin: ['cancelled', 'returned'] }
    }).sort({ createdAt: 1 })
    
    console.log(`Found ${orders.length} orders without inventory adjustment`)

    let adjusted = 0
    let skipped = 0

    for (const order of orders) {
      try {
        const country = order.orderCountry
        
        if (Array.isArray(order.items) && order.items.length > 0) {
          // Multi-item order
          console.log(`Processing multi-item order ${order._id} in ${country}`)
          
          for (const item of order.items) {
            const product = await Product.findById(item.productId)
            if (!product) {
              console.log(`  - Product ${item.productId} not found, skipping`)
              continue
            }
            
            const qty = Math.max(1, Number(item.quantity || 1))
            
            if (product.stockByCountry) {
              const byC = product.stockByCountry
              const countryKey = normalizeCountry(country)
              
              if (countryKey && byC[countryKey] !== undefined) {
                const before = byC[countryKey]
                byC[countryKey] = Math.max(0, (byC[countryKey] || 0) - qty)
                
                // Recalculate total stock
                const totalLeft = (byC.UAE||0) + (byC.Oman||0) + (byC.KSA||0) + 
                                  (byC.Bahrain||0) + (byC.India||0) + (byC.Kuwait||0) + (byC.Qatar||0)
                product.stockQty = totalLeft
                product.inStock = totalLeft > 0
                
                await product.save()
                console.log(`  - ${product.name}: ${countryKey} stock ${before} → ${byC[countryKey]}`)
              }
            }
          }
        } else if (order.productId) {
          // Single product order
          const product = await Product.findById(order.productId)
          if (!product) {
            console.log(`  - Product ${order.productId} not found, skipping`)
            skipped++
            continue
          }
          
          const qty = Math.max(1, Number(order.quantity || 1))
          console.log(`Processing single-item order ${order._id} for ${product.name} in ${country}`)
          
          if (product.stockByCountry) {
            const byC = product.stockByCountry
            const countryKey = normalizeCountry(country)
            
            if (countryKey && byC[countryKey] !== undefined) {
              const before = byC[countryKey]
              byC[countryKey] = Math.max(0, (byC[countryKey] || 0) - qty)
              
              // Recalculate total stock
              const totalLeft = (byC.UAE||0) + (byC.Oman||0) + (byC.KSA||0) + 
                                (byC.Bahrain||0) + (byC.India||0) + (byC.Kuwait||0) + (byC.Qatar||0)
              product.stockQty = totalLeft
              product.inStock = totalLeft > 0
              
              await product.save()
              console.log(`  - ${product.name}: ${countryKey} stock ${before} → ${byC[countryKey]}`)
            }
          }
        }
        
        // Mark order as inventory adjusted
        order.inventoryAdjusted = true
        order.inventoryAdjustedAt = new Date()
        await order.save()
        adjusted++
        
      } catch (orderError) {
        console.error(`Error processing order ${order._id}:`, orderError)
        skipped++
      }
    }

    console.log(`\nMigration complete!`)
    console.log(`- Orders adjusted: ${adjusted}`)
    console.log(`- Orders skipped: ${skipped}`)
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

function normalizeCountry(country) {
  const c = String(country || '').trim()
  if (c === 'UAE' || c === 'United Arab Emirates' || c === 'AE') return 'UAE'
  if (c === 'Oman' || c === 'OM') return 'Oman'
  if (c === 'KSA' || c === 'Saudi Arabia' || c === 'SA') return 'KSA'
  if (c === 'Bahrain' || c === 'BH') return 'Bahrain'
  if (c === 'India' || c === 'IN') return 'India'
  if (c === 'Kuwait' || c === 'KW') return 'Kuwait'
  if (c === 'Qatar' || c === 'QA') return 'Qatar'
  return null
}

migrate()
