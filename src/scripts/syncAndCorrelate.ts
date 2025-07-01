import dotenv from 'dotenv';
import connectDB from '../shared/database';
import { CrossPlatformAnalyticsService } from '../features/analytics/services/crossPlatformAnalytics.service';
import { GoogleWorkspaceConnectionService } from '../features/integrations/google-workspace/services/googleWorkspaceConnectionService';
import { GitHubConnectionService } from '../features/integrations/github/services/githubConnectionService';
import { GitHubUsersService } from '../features/integrations/github/services/githubUsersService';
import Company from '../database/models/Company';
import { GoogleWorkspaceUser } from '../database/models/GoogleWorkspaceUser';
import { GitHubUser } from '../database/models/GitHubUser';
import mongoose from 'mongoose';

dotenv.config();

async function syncAndCorrelateData() {
  try {
    console.log('🚀 Starting sync and correlation process...');
    
    // Connect to database
    await connectDB();
    
    // Get all companies
    const companies = await Company.find({ isActive: true });
    console.log(`Found ${companies.length} active companies`);
    
    for (const company of companies) {
      console.log(`\n📊 Processing company: ${company.name} (${company._id})`);
      
      try {
        // 1. Sync Google Workspace data
        console.log('🔄 Syncing Google Workspace data...');
        const googleService = new GoogleWorkspaceConnectionService();
        const googleConnections = await googleService.getConnections(company._id.toString());
        
        for (const connection of googleConnections) {
          if (connection.connectionType === 'service_account') {
            try {
              console.log(`  - Syncing users for connection: ${connection.id}`);
              const syncResult = await googleService.syncUsers(connection.id, company._id.toString());
              
              if (syncResult.success && syncResult.users) {
                // Save users to database
                for (const userData of syncResult.users) {
                  await GoogleWorkspaceUser.findOneAndUpdate(
                    {
                      companyId: company._id,
                      primaryEmail: userData.primaryEmail
                    },
                    {
                      companyId: company._id,
                      googleId: userData.id,
                      primaryEmail: userData.primaryEmail,
                      name: {
                        givenName: userData.name?.givenName || '',
                        familyName: userData.name?.familyName || '',
                        fullName: userData.name?.fullName || ''
                      },
                      isAdmin: userData.isAdmin || false,
                      isDelegatedAdmin: userData.isDelegatedAdmin || false,
                      lastLoginTime: userData.lastLoginTime ? new Date(userData.lastLoginTime) : undefined,
                      creationTime: userData.creationTime ? new Date(userData.creationTime) : new Date(),
                      suspended: userData.suspended || false,
                      orgUnitPath: userData.orgUnitPath || '/',
                      isEnrolledIn2Sv: userData.isEnrolledIn2Sv || false,
                      isEnforcedIn2Sv: userData.isEnforcedIn2Sv || false,
                      isActive: !userData.suspended,
                      rawData: userData
                    },
                    { upsert: true, new: true }
                  );
                }
                console.log(`    ✅ Synced ${syncResult.users.length} Google Workspace users`);
              }
            } catch (error) {
              console.error(`    ❌ Error syncing Google connection ${connection.id}:`, error);
            }
          }
        }
        
        // 2. Sync GitHub data
        console.log('🔄 Syncing GitHub data...');
        const githubConnectionService = new GitHubConnectionService();
        const githubUsersService = new GitHubUsersService();
        const githubConnections = await githubConnectionService.getConnections(company._id.toString());
        
        for (const connection of githubConnections) {
          try {
            console.log(`  - Syncing users for GitHub connection: ${connection.id}`);
            const syncResult = await githubUsersService.syncUsersFromGitHub(connection.id, company._id.toString());
            
            console.log(`    ✅ Synced ${syncResult.syncedCount} GitHub users`);
          } catch (error) {
            console.error(`    ❌ Error syncing GitHub connection ${connection.id}:`, error);
          }
        }
        
        // 3. Correlate users across platforms
        console.log('🔗 Correlating users across platforms...');
        const analyticsService = new CrossPlatformAnalyticsService();
        const correlatedUsers = await analyticsService.correlateUsers(company._id.toString());
        console.log(`  ✅ Correlated ${correlatedUsers.length} users`);
        
        // 4. Log summary
        const googleUsers = await GoogleWorkspaceUser.countDocuments({ companyId: company._id, isActive: true });
        const githubUsers = await GitHubUser.countDocuments({ companyId: company._id, isActive: true });
        
        console.log(`\n📈 Summary for ${company.name}:`);
        console.log(`  - Google Workspace users: ${googleUsers}`);
        console.log(`  - GitHub users: ${githubUsers}`);
        console.log(`  - Cross-platform users: ${correlatedUsers.length}`);
        console.log(`  - Ghost users: ${correlatedUsers.filter(u => u.ghostStatus.isGhost).length}`);
        console.log(`  - Security risks: ${correlatedUsers.filter(u => u.securityRisks.riskScore > 0).length}`);
        
      } catch (error) {
        console.error(`❌ Error processing company ${company.name}:`, error);
      }
    }
    
    console.log('\n✅ Sync and correlation process completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the sync
syncAndCorrelateData();
