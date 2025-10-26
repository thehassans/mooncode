// This script creates sample test notifications for the current logged-in user
// Run with: node create-test-notifications.js <userId>

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { createNotification } from './src/modules/routes/notifications.js'
import Notification from './src/modules/models/Notification.js'

// Load environment variables
dotenv.config()

// Get userId from command line arguments
const userId = process.argv[2]

if (!userId) {
  console.error('Usage: node create-test-notifications.js <userId>')
  process.exit(1)
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/buysial')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  })

// Sample notification data
const sampleNotifications = [
  {
    type: 'order_created',
    title: 'New Order Received',
    message: 'Order #ORD-4872 has been created and is pending review.',
    relatedType: 'Order',
    relatedId: new mongoose.Types.ObjectId(),
    triggeredByRole: 'agent'
  },
  {
    type: 'expense_added',
    title: 'Driver Settlement Approval',
    message: 'Driver John has submitted AED 1,200 settlement for approval.',
    relatedType: 'Expense',
    relatedId: new mongoose.Types.ObjectId(),
    triggeredByRole: 'driver'
  },
  {
    type: 'product_updated',
    title: 'Product Stock Updated',
    message: 'Inventory for "Premium Watch" has been updated to 24 units.',
    relatedType: 'Product',
    relatedId: new mongoose.Types.ObjectId(),
    triggeredByRole: 'manager'
  },
  {
    type: 'other',
    title: 'Manager Remittance',
    message: 'Manager Sarah has sent AED 5,000 to company account for approval.',
    relatedType: 'Other',
    relatedId: new mongoose.Types.ObjectId(),
    triggeredByRole: 'manager'
  },
  {
    type: 'other',
    title: 'Order Return Request',
    message: 'Driver Ali has submitted a return request for order #ORD-4651.',
    relatedType: 'Order',
    relatedId: new mongoose.Types.ObjectId(),
    triggeredByRole: 'driver'
  }
]

// Create notifications with timestamps spread across last 24 hours
async function createTestNotifications() {
  try {
    // Clear existing test notifications for this user
    await Notification.deleteMany({ 
      userId: userId,
      message: { $regex: /test notification/i }
    })
    
    console.log(`Creating ${sampleNotifications.length} test notifications for user ${userId}...`)
    
    const now = Date.now()
    const promises = sampleNotifications.map(async (notification, index) => {
      // Spread notifications over the last 24 hours
      const hoursAgo = index * 3
      const timestamp = new Date(now - (hoursAgo * 60 * 60 * 1000))
      
      const notificationData = {
        ...notification,
        userId: userId,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      
      // Add the triggerer if provided
      if (notification.triggeredByRole) {
        notificationData.triggeredBy = new mongoose.Types.ObjectId()
      }
      
      return await createNotification(notificationData)
    })
    
    await Promise.all(promises)
    console.log('Test notifications created successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Error creating test notifications:', error)
    process.exit(1)
  }
}

createTestNotifications()
