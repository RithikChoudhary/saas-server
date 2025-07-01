import mongoose from 'mongoose';
import { GoogleWorkspaceGroup } from '../database/models/GoogleWorkspaceGroup';

async function fixGoogleWorkspaceGroupIndexes() {
  try {
    console.log('🔧 Starting Google Workspace Group indexes fix...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/saas-management');
    console.log('✅ Connected to MongoDB');

    const dbName = mongoose.connection.db!.databaseName;
    console.log(`📊 Connected to database: ${dbName}`);
    
    const collection = mongoose.connection.db!.collection('google_workspace_groups');

    // Check if collection exists
    const collections = await mongoose.connection.db!.listCollections({ name: 'google_workspace_groups' }).toArray();
    
    if (collections.length === 0) {
      console.log('ℹ️ google_workspace_groups collection does not exist yet');
      console.log('✅ No indexes to fix - collection will be created with correct indexes on first use');
      return;
    }

    // Check existing indexes
    const existingIndexes = await collection.indexes();
    console.log('📋 Existing indexes:');
    existingIndexes.forEach(index => {
      console.log(`   ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Drop the problematic global email index if it exists
    try {
      const emailIndexExists = existingIndexes.some(index => 
        index.name === 'email_1' || 
        (index.key && index.key.email === 1 && Object.keys(index.key).length === 1)
      );
      
      if (emailIndexExists) {
        console.log('🗑️ Dropping global email index...');
        await collection.dropIndex('email_1');
        console.log('✅ Global email index dropped');
      } else {
        console.log('ℹ️ Global email index not found, skipping drop');
      }
    } catch (error) {
      console.log('ℹ️ Global email index might not exist or already dropped:', (error as Error).message);
    }

    // Find and handle duplicate groups by email within the same company
    console.log('🔍 Looking for duplicate groups...');
    
    const duplicates = await GoogleWorkspaceGroup.aggregate([
      {
        $group: {
          _id: { companyId: '$companyId', email: '$email' },
          count: { $sum: 1 },
          docs: { $push: '$$ROOT' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);

    console.log(`🔍 Found ${duplicates.length} duplicate group sets`);

    let removedGroups = 0;

    // For each duplicate set, keep the most recent one and remove others
    for (const duplicate of duplicates) {
      const docs = duplicate.docs.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Keep the first (most recent) and remove the rest
      const toKeep = docs[0];
      const toRemove = docs.slice(1);

      console.log(`📋 For company ${duplicate._id.companyId} and email ${duplicate._id.email}:`);
      console.log(`   Keeping group: ${toKeep._id} (created: ${toKeep.createdAt})`);

      for (const group of toRemove) {
        console.log(`   Removing group: ${group._id} (created: ${group.createdAt})`);
        await GoogleWorkspaceGroup.findByIdAndDelete(group._id);
        removedGroups++;
      }
    }

    // Create the new compound unique index for companyId + email
    try {
      console.log('🔧 Creating compound unique index for companyId + email...');
      await collection.createIndex(
        { companyId: 1, email: 1 }, 
        { unique: true, name: 'companyId_1_email_1_unique' }
      );
      console.log('✅ Compound unique index created');
    } catch (error) {
      console.log('ℹ️ Compound unique index might already exist:', (error as Error).message);
    }

    // Final statistics
    const remainingGroups = await GoogleWorkspaceGroup.countDocuments();
    const finalIndexes = await collection.indexes();

    console.log('\n📊 Fix Summary:');
    console.log(`   Removed duplicate groups: ${removedGroups}`);
    console.log(`   Remaining groups: ${remainingGroups}`);
    
    console.log('\n📋 Final indexes:');
    finalIndexes.forEach(index => {
      console.log(`   ${index.name}: ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''}`);
    });

    console.log('\n✅ Google Workspace Group indexes fix completed successfully!');

  } catch (error) {
    console.error('❌ Error during fix:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixGoogleWorkspaceGroupIndexes()
    .then(() => {
      console.log('🎉 Fix script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fix script failed:', error);
      process.exit(1);
    });
}

export { fixGoogleWorkspaceGroupIndexes };
