import mongoose from 'mongoose';
import User from '../src/modules/models/User.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/buysial';

async function migrateDriverProfiles() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all drivers that don't have driverProfile or have empty driverProfile
    const drivers = await User.find({ 
      role: 'driver',
      $or: [
        { driverProfile: { $exists: false } },
        { 'driverProfile.commissionPerOrder': { $exists: false } }
      ]
    });

    console.log(`📋 Found ${drivers.length} drivers needing driverProfile initialization`);

    if (drivers.length === 0) {
      console.log('✨ All drivers already have driverProfile configured!');
      process.exit(0);
    }

    // Update each driver
    let updated = 0;
    for (const driver of drivers) {
      const countryToCurrency = {
        'UAE': 'AED',
        'Oman': 'OMR', 
        'KSA': 'SAR',
        'Saudi Arabia': 'SAR',
        'Bahrain': 'BHD',
        'India': 'INR',
        'Kuwait': 'KWD',
        'Qatar': 'QAR'
      };

      driver.driverProfile = {
        commissionPerOrder: 0,
        commissionCurrency: countryToCurrency[driver.country] || 'SAR',
        commissionRate: 8
      };

      await driver.save();
      updated++;
      console.log(`✅ Updated driver: ${driver.firstName} ${driver.lastName} - ${driver.email}`);
    }

    console.log(`\n🎉 Successfully initialized driverProfile for ${updated} drivers!`);
    console.log('💡 You can now edit each driver to set their commission rates.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

migrateDriverProfiles();
