import mongoose from 'mongoose'
import Product from '../src/modules/models/Product.js'
import dotenv from 'dotenv'

dotenv.config()

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/buysial')
    console.log('Connected to database')

    const products = await Product.find({})
    console.log(`Found ${products.length} products`)

    let updated = 0
    for (const product of products) {
      // Calculate totalPurchased from stockHistory if available
      let totalFromHistory = 0
      if (Array.isArray(product.stockHistory)) {
        totalFromHistory = product.stockHistory.reduce((sum, entry) => {
          return sum + (Number(entry.quantity) || 0)
        }, 0)
      }

      // If we have stockHistory, use that as totalPurchased
      // Otherwise, use current stockQty as initial purchase
      const totalPurchased = totalFromHistory > 0 ? totalFromHistory : (product.stockQty || 0)

      if (totalPurchased > 0 || !product.totalPurchased) {
        product.totalPurchased = totalPurchased
        await product.save()
        updated++
        console.log(`Updated ${product.name}: totalPurchased = ${totalPurchased}`)
      }
    }

    console.log(`\nMigration complete! Updated ${updated} products.`)
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

migrate()
