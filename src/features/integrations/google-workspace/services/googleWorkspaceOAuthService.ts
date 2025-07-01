import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GoogleWorkspaceUser } from '../../../../database/models/GoogleWorkspaceUser';
import { GoogleWorkspaceGroup } from '../../../../database/models/GoogleWorkspaceGroup';
import { GoogleWorkspaceOrgUnit } from '../../../../database/models/GoogleWorkspaceOrgUnit';
import { GoogleWorkspaceConnection } from '../../../../database/models';
import { decrypt } from '../../../../utils/encryption';
import mongoose from 'mongoose';

export class GoogleWorkspaceOAuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/integrations/google-workspace/callback`
    );
  }

  /**
   * Set credentials for OAuth client
   */
  private async setOAuthCredentials(connection: any) {
    const accessToken = decrypt(connection.accessToken);
    const refreshToken = connection.refreshToken ? decrypt(connection.refreshToken) : undefined;
    
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }

  /**
   * Sync users using OAuth
   */
  async syncUsers(connection: any, companyId: string): Promise<any> {
    try {
      console.log('🔍 OAuth: Starting user sync...');
      
      // Set OAuth credentials
      await this.setOAuthCredentials(connection);
      
      const admin = google.admin({ version: 'directory_v1', auth: this.oauth2Client });
      
      // Fetch all users
      let allUsers: any[] = [];
      let pageToken: string | undefined;
      
      do {
        const response = await admin.users.list({
          customer: 'my_customer',
          maxResults: 500,
          pageToken
        });
        
        if (response.data.users) {
          allUsers = allUsers.concat(response.data.users);
        }
        
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);
      
      console.log(`📊 OAuth: Found ${allUsers.length} users`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Save users to database
      for (const userData of allUsers) {
        try {
          // Skip users without ID or email
          if (!userData.id || !userData.primaryEmail) {
            console.warn(`⚠️ OAuth: Skipping user without ID or email:`, userData);
            errorCount++;
            continue;
          }
          
          // Prepare user data with correct field mapping
          const userDoc = {
            companyId: new mongoose.Types.ObjectId(companyId),
            connectionId: new mongoose.Types.ObjectId(connection._id),
            googleUserId: userData.id, // Fixed: was googleId, now googleUserId
            primaryEmail: userData.primaryEmail,
            firstName: userData.name?.givenName || '',
            lastName: userData.name?.familyName || '',
            fullName: userData.name?.fullName || `${userData.name?.givenName || ''} ${userData.name?.familyName || ''}`.trim(),
            isAdmin: userData.isAdmin || false,
            isSuperAdmin: userData.isAdmin || false, // Google doesn't distinguish, using isAdmin
            isDelegatedAdmin: userData.isDelegatedAdmin || false,
            suspended: userData.suspended || false,
            archived: false, // Default value
            changePasswordAtNextLogin: userData.changePasswordAtNextLogin || false,
            ipWhitelisted: userData.ipWhitelisted || false,
            orgUnitPath: userData.orgUnitPath || '/',
            lastLoginTime: userData.lastLoginTime ? new Date(userData.lastLoginTime) : undefined,
            creationTime: userData.creationTime ? new Date(userData.creationTime) : new Date(),
            deletionTime: userData.deletionTime ? new Date(userData.deletionTime) : undefined,
            suspensionReason: userData.suspensionReason,
            // Profile fields
            jobTitle: userData.organizations?.[0]?.title,
            department: userData.organizations?.[0]?.department,
            location: userData.locations?.[0]?.area,
            phoneNumber: userData.phones?.[0]?.value,
            recoveryEmail: userData.recoveryEmail,
            recoveryPhone: userData.recoveryPhone,
            // Security
            isEnforcedIn2Sv: userData.isEnforcedIn2Sv || false,
            isEnrolledIn2Sv: userData.isEnrolledIn2Sv || false,
            agreedToTerms: userData.agreedToTerms || false,
            // Storage - default values since Google API doesn't always provide these
            quotaUsed: 0,
            quotaLimit: 0,
            isActive: !userData.suspended,
            lastSync: new Date()
          };

          await GoogleWorkspaceUser.findOneAndUpdate(
            {
              companyId: new mongoose.Types.ObjectId(companyId),
              googleUserId: userData.id // Use googleUserId for matching
            },
            userDoc,
            { upsert: true, new: true }
          );
          
          successCount++;
        } catch (userError) {
          console.error(`❌ OAuth: Error syncing user ${userData.primaryEmail}:`, userError);
          errorCount++;
          // Continue with next user instead of failing entire sync
        }
      }
      
      // Update connection last sync
      await GoogleWorkspaceConnection.findByIdAndUpdate(connection._id, {
        lastSync: new Date()
      });
      
      console.log(`✅ OAuth: User sync completed - ${successCount} successful, ${errorCount} errors`);
      
      return {
        success: true,
        usersCount: allUsers.length,
        successCount,
        errorCount,
        users: allUsers
      };
    } catch (error) {
      console.error('❌ OAuth: Error syncing users:', error);
      throw error;
    }
  }

  /**
   * Sync groups using OAuth
   */
  async syncGroups(connection: any, companyId: string): Promise<any> {
    try {
      console.log('🔍 OAuth: Starting group sync...');
      
      // Set OAuth credentials
      await this.setOAuthCredentials(connection);
      
      const admin = google.admin({ version: 'directory_v1', auth: this.oauth2Client });
      
      // Fetch all groups
      let allGroups: any[] = [];
      let pageToken: string | undefined;
      
      do {
        const response = await admin.groups.list({
          customer: 'my_customer',
          maxResults: 200,
          pageToken
        });
        
        if (response.data.groups) {
          allGroups = allGroups.concat(response.data.groups);
        }
        
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);
      
      console.log(`📊 OAuth: Found ${allGroups.length} groups`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Save groups to database
      for (const groupData of allGroups) {
        try {
          // Skip groups without ID or email
          if (!groupData.id || !groupData.email) {
            console.warn(`⚠️ OAuth: Skipping group without ID or email:`, groupData);
            errorCount++;
            continue;
          }
          
          await GoogleWorkspaceGroup.findOneAndUpdate(
            {
              companyId: new mongoose.Types.ObjectId(companyId),
              googleGroupId: groupData.id // Use googleGroupId for matching
            },
            {
              companyId: new mongoose.Types.ObjectId(companyId),
              connectionId: new mongoose.Types.ObjectId(connection._id),
              googleGroupId: groupData.id, // Fixed: was googleId, now googleGroupId
              email: groupData.email,
              name: groupData.name,
              description: groupData.description,
              adminCreated: groupData.adminCreated || false,
              directMembersCount: groupData.directMembersCount || 0,
              aliases: groupData.aliases || [],
              nonEditableAliases: groupData.nonEditableAliases || [],
              isActive: true,
              lastSync: new Date()
            },
            { upsert: true, new: true }
          );
          
          successCount++;
        } catch (groupError) {
          console.error(`❌ OAuth: Error syncing group ${groupData.email}:`, groupError);
          errorCount++;
          // Continue with next group instead of failing entire sync
        }
      }
      
      console.log(`✅ OAuth: Group sync completed - ${successCount} successful, ${errorCount} errors`);
      
      return {
        success: true,
        groupsCount: allGroups.length,
        successCount,
        errorCount,
        groups: allGroups
      };
    } catch (error) {
      console.error('❌ OAuth: Error syncing groups:', error);
      throw error;
    }
  }

  /**
   * Sync organizational units using OAuth
   */
  async syncOrgUnits(connection: any, companyId: string): Promise<any> {
    try {
      console.log('🔍 OAuth: Starting org units sync...');
      
      // Set OAuth credentials
      await this.setOAuthCredentials(connection);
      
      const admin = google.admin({ version: 'directory_v1', auth: this.oauth2Client });
      
      // Fetch all org units
      const response = await admin.orgunits.list({
        customerId: 'my_customer',
        type: 'all'
      });
      
      const orgUnits = response.data.organizationUnits || [];
      
      console.log(`📊 OAuth: Found ${orgUnits.length} organizational units`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Save org units to database
      for (const orgUnitData of orgUnits) {
        try {
          // Skip org units without ID or path
          if (!orgUnitData.orgUnitId || !orgUnitData.orgUnitPath) {
            console.warn(`⚠️ OAuth: Skipping org unit without ID or path:`, orgUnitData);
            errorCount++;
            continue;
          }
          
          await GoogleWorkspaceOrgUnit.findOneAndUpdate(
            {
              companyId: new mongoose.Types.ObjectId(companyId),
              googleOrgUnitId: orgUnitData.orgUnitId // Use googleOrgUnitId for matching
            },
            {
              companyId: new mongoose.Types.ObjectId(companyId),
              connectionId: new mongoose.Types.ObjectId(connection._id),
              googleOrgUnitId: orgUnitData.orgUnitId, // Fixed: was googleId, now googleOrgUnitId
              name: orgUnitData.name,
              description: orgUnitData.description,
              orgUnitPath: orgUnitData.orgUnitPath,
              parentOrgUnitPath: orgUnitData.parentOrgUnitPath,
              parentOrgUnitId: orgUnitData.parentOrgUnitId,
              blockInheritance: orgUnitData.blockInheritance || false,
              etag: orgUnitData.etag || '',
              isActive: true,
              lastSync: new Date()
            },
            { upsert: true, new: true }
          );
          
          successCount++;
        } catch (orgUnitError) {
          console.error(`❌ OAuth: Error syncing org unit ${orgUnitData.orgUnitPath}:`, orgUnitError);
          errorCount++;
          // Continue with next org unit instead of failing entire sync
        }
      }
      
      console.log(`✅ OAuth: Org units sync completed - ${successCount} successful, ${errorCount} errors`);
      
      return {
        success: true,
        orgUnitsCount: orgUnits.length,
        successCount,
        errorCount,
        orgUnits: orgUnits
      };
    } catch (error) {
      console.error('❌ OAuth: Error syncing org units:', error);
      throw error;
    }
  }
}
