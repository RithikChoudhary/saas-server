import mongoose from 'mongoose';
import { GoogleWorkspaceUser } from '../database/models/GoogleWorkspaceUser';
import connectDB from '../shared/database';

async function cleanupGoogleWorkspaceUsers() {
  try {
    console.log('🔧 Starting Google Workspace users cleanup...');
    
    // Connect to database
    await connectDB();
    
    // Find and remove users with null or undefined googleUserId
    const result = await GoogleWorkspaceUser.deleteMany({
      $or: [
        { googleUserId: null },
        { googleUserId: undefined },
        { googleUserId: '' },
        { googleUserId: { $exists: false } }
      ]
    });
    
    console.log(`🗑️ Removed ${result.deletedCount} users with invalid googleUserId`);
    
    // Find users with duplicate googleUserId (keeping the most recent one)
    const duplicates = await GoogleWorkspaceUser.aggregate([
      {
        $match: {
          googleUserId: { $exists: true, $ne: null, $nin: ['', null] }
        }
      },
      {
        $group: {
          _id: '$googleUserId',
          count: { $sum: 1 },
          docs: { $push: { id: '$_id', updatedAt: '$updatedAt' } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    let duplicatesRemoved = 0;
    
    for (const duplicate of duplicates) {
      // Sort by updatedAt descending and keep the first (most recent)
      const sortedDocs = duplicate.docs.sort((a: any, b: any) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      
      // Remove all but the most recent
      const toRemove = sortedDocs.slice(1);
      
      for (const doc of toRemove) {
        await GoogleWorkspaceUser.findByIdAndDelete(doc.id);
        duplicatesRemoved++;
      }
      
      console.log(`🔄 Cleaned up ${toRemove.length} duplicate records for googleUserId: ${duplicate._id}`);
    }
    
    console.log(`✅ Cleanup completed - removed ${duplicatesRemoved} duplicate records`);
    
    // Show final stats
    const totalUsers = await GoogleWorkspaceUser.countDocuments();
    const validUsers = await GoogleWorkspaceUser.countDocuments({
      googleUserId: { $exists: true, $nin: [null, ''] }
    });
    
    console.log(`📊 Final stats: ${totalUsers} total users, ${validUsers} with valid googleUserId`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
  }
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupGoogleWorkspaceUsers()
    .then(() => {
      console.log('✅ Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup script failed:', error);
      process.exit(1);
    });
}

export { cleanupGoogleWorkspaceUsers };
