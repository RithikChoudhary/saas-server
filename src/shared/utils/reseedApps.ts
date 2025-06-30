import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { App } from '../../database/models';
import { seedApps } from './seedApps';

// Load environment variables
dotenv.config();

const reseedApps = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/saas-manager');
    console.log('📦 Connected to MongoDB');

    // Clear existing apps
    const deletedCount = await App.deleteMany({});
    console.log(`🗑️  Deleted ${deletedCount.deletedCount} existing apps`);

    // Reseed apps
    await seedApps();
    console.log('✅ Apps reseeded successfully');

    // Close connection
    await mongoose.connection.close();
    console.log('📦 MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error reseeding apps:', error);
    process.exit(1);
  }
};

reseedApps();
