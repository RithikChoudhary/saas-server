import mongoose from 'mongoose';
import { GoogleWorkspaceConnection } from '../database/models/GoogleWorkspaceConnection';
import { GoogleWorkspaceUser } from '../database/models/GoogleWorkspaceUser';
import { GoogleWorkspaceGroup } from '../database/models/GoogleWorkspaceGroup';
import { GoogleWorkspaceOrgUnit } from '../database/models/GoogleWorkspaceOrgUnit';

async function cleanupGoogleWorkspaceConnections() {
  try {
    console.log('🧹 Starting Google Workspace connections cleanup...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/saas-management');
    console.log('✅ Connected to MongoDB');

    // Find duplicate connections (same companyId and domain)
    const duplicates = await GoogleWorkspaceConnection.aggregate([
      {
        $group: {
          _id: { companyId: '$companyId', domain: '$domain' },
          count: { $sum: 1 },
          docs: { $push: '$$ROOT' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);

    console.log(`🔍 Found ${duplicates.length} duplicate connection groups`);

    let removedConnections = 0;
    let cleanedUsers = 0;
    let cleanedGroups = 0;
    let cleanedOrgUnits = 0;

    // For each duplicate group, keep the most recent one and remove others
    for (const duplicate of duplicates) {
      const docs = duplicate.docs.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Keep the first (most recent) and remove the rest
      const toKeep = docs[0];
      const toRemove = docs.slice(1);

      console.log(`📋 For company ${duplicate._id.companyId} and domain ${duplicate._id.domain}:`);
      console.log(`   Keeping connection: ${toKeep._id} (created: ${toKeep.createdAt})`);

      for (const conn of toRemove) {
        console.log(`   Removing connection: ${conn._id} (created: ${conn.createdAt})`);
        
        // Remove the connection
        await GoogleWorkspaceConnection.findByIdAndDelete(conn._id);
        removedConnections++;

        // Clean up related data for this connection
        const usersDeleted = await GoogleWorkspaceUser.deleteMany({ 
          connectionId: conn._id 
        });
        cleanedUsers += usersDeleted.deletedCount || 0;

        const groupsDeleted = await GoogleWorkspaceGroup.deleteMany({ 
          connectionId: conn._id 
        });
        cleanedGroups += groupsDeleted.deletedCount || 0;

        const orgUnitsDeleted = await GoogleWorkspaceOrgUnit.deleteMany({ 
          connectionId: conn._id 
        });
        cleanedOrgUnits += orgUnitsDeleted.deletedCount || 0;
      }
    }

    // Also clean up any orphaned data (users/groups/orgunits without valid connections)
    console.log('🧹 Cleaning up orphaned data...');

    const validConnectionIds = await GoogleWorkspaceConnection.distinct('_id');
    
    const orphanedUsers = await GoogleWorkspaceUser.deleteMany({
      connectionId: { $nin: validConnectionIds }
    });
    cleanedUsers += orphanedUsers.deletedCount || 0;

    const orphanedGroups = await GoogleWorkspaceGroup.deleteMany({
      connectionId: { $nin: validConnectionIds }
    });
    cleanedGroups += orphanedGroups.deletedCount || 0;

    const orphanedOrgUnits = await GoogleWorkspaceOrgUnit.deleteMany({
      connectionId: { $nin: validConnectionIds }
    });
    cleanedOrgUnits += orphanedOrgUnits.deletedCount || 0;

    // Final statistics
    const remainingConnections = await GoogleWorkspaceConnection.countDocuments();
    const remainingUsers = await GoogleWorkspaceUser.countDocuments();
    const remainingGroups = await GoogleWorkspaceGroup.countDocuments();
    const remainingOrgUnits = await GoogleWorkspaceOrgUnit.countDocuments();

    console.log('\n📊 Cleanup Summary:');
    console.log(`   Removed connections: ${removedConnections}`);
    console.log(`   Cleaned users: ${cleanedUsers}`);
    console.log(`   Cleaned groups: ${cleanedGroups}`);
    console.log(`   Cleaned org units: ${cleanedOrgUnits}`);
    console.log('\n📈 Final Database State:');
    console.log(`   Remaining connections: ${remainingConnections}`);
    console.log(`   Remaining users: ${remainingUsers}`);
    console.log(`   Remaining groups: ${remainingGroups}`);
    console.log(`   Remaining org units: ${remainingOrgUnits}`);

    console.log('\n✅ Google Workspace connections cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupGoogleWorkspaceConnections()
    .then(() => {
      console.log('🎉 Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup script failed:', error);
      process.exit(1);
    });
}

export { cleanupGoogleWorkspaceConnections };
