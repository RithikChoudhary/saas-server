const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
async function clearCorruptedCredentials() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the AppCredentials model
    const AppCredentials = mongoose.model('AppCredentials', new mongoose.Schema({
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true },
      appType: { type: String, required: true },
      appName: { type: String, required: true },
      credentials: { type: Object, required: true },
      isActive: { type: Boolean, default: true },
      createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }));

    console.log('🔍 Finding all credential records...');
    const allCredentials = await AppCredentials.find({});
    console.log(`📊 Found ${allCredentials.length} credential records`);

    if (allCredentials.length > 0) {
      console.log('🗑️  Clearing all credential records due to encryption key change...');
      const result = await AppCredentials.deleteMany({});
      console.log(`✅ Cleared ${result.deletedCount} credential records`);
    } else {
      console.log('ℹ️  No credential records found to clear');
    }

    console.log('✅ Cleanup complete');
  } catch (error) {
    console.error('❌ Error clearing credentials:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

clearCorruptedCredentials();
