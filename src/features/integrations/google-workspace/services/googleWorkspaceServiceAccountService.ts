import { AppCredentials } from '../../../../database/models/AppCredentials';
import { GoogleWorkspaceUser } from '../../../../database/models/GoogleWorkspaceUser';
import { GoogleWorkspaceGroup } from '../../../../database/models/GoogleWorkspaceGroup';
import { GoogleWorkspaceOrgUnit } from '../../../../database/models/GoogleWorkspaceOrgUnit';
import { decrypt } from '../../../../utils/encryption';
import mongoose from 'mongoose';
import { google } from 'googleapis';

export class GoogleWorkspaceServiceAccountService {
  
  /**
   * Create JWT auth client for service account with domain-wide delegation
   */
  private async createJWTAuth(connectionId: string, companyId: string, scopes: string[]) {
    const credentials = await AppCredentials.findOne({
      _id: new mongoose.Types.ObjectId(connectionId),
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    });

    if (!credentials) {
      throw new Error('Service account credentials not found');
    }

    // Decrypt credentials
    const decryptedCreds: { [key: string]: string } = {};
    for (const [key, encryptedValue] of Object.entries(credentials.credentials)) {
      if (encryptedValue && typeof encryptedValue === 'object') {
        const encObj = encryptedValue as any;
        if (encObj.encrypted && encObj.iv && encObj.authTag) {
          decryptedCreds[key] = decrypt(encObj);
        }
      }
    }

    if (!decryptedCreds.serviceAccountKey || !decryptedCreds.adminEmail) {
      throw new Error('Missing service account key or admin email');
    }

    const keyData = JSON.parse(decryptedCreds.serviceAccountKey);
    
    // Create JWT client with proper domain-wide delegation
    const auth = new google.auth.JWT({
      email: keyData.client_email,
      key: keyData.private_key,
      scopes: scopes,
      subject: decryptedCreds.adminEmail // This MUST be rithik@transfi.com
    });

    return { auth, adminEmail: decryptedCreds.adminEmail };
  }

  /**
   * Test connection using service account
   */
  async testConnection(connectionId: string, companyId: string): Promise<any> {
    try {
      const { auth, adminEmail } = await this.createJWTAuth(connectionId, companyId, [
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/admin.directory.customer.readonly'
      ]);

      const admin = google.admin({ version: 'directory_v1', auth });
      
      // Test with a simple API call
      const response = await admin.users.list({
        domain: adminEmail.split('@')[1],
        maxResults: 1
      });

      return {
        success: true,
        message: 'Service account connection is working',
        domain: adminEmail.split('@')[1],
        usersFound: response.data.users ? response.data.users.length : 0
      };
    } catch (error) {
      console.error('Error testing connection:', error);
      throw error;
    }
  }

  /**
   * Sync users using service account
   */
  async syncUsers(connectionId: string, companyId: string): Promise<any> {
    try {
      console.log('🔍 Service Account: Starting user sync...');
      
      const { auth, adminEmail } = await this.createJWTAuth(connectionId, companyId, [
        'https://www.googleapis.com/auth/admin.directory.user.readonly'
      ]);

      const admin = google.admin({ version: 'directory_v1', auth });
      const domain = adminEmail.split('@')[1];
      
      // Fetch all users using domain parameter
      let allUsers: any[] = [];
      let pageToken: string | undefined;

      do {
        const response = await admin.users.list({
          domain: domain,
          maxResults: 500,
          pageToken
        });

        if (response.data.users) {
          allUsers = allUsers.concat(response.data.users);
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      console.log(`📊 Service Account: Found ${allUsers.length} users`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Save users to database
      for (const userData of allUsers) {
        try {
          // Skip users without ID or email
          if (!userData.id || !userData.primaryEmail) {
            console.warn(`⚠️ Service Account: Skipping user without ID or email:`, userData);
            errorCount++;
            continue;
          }
          
          // Prepare user data with correct field mapping
          const userDoc = {
            companyId: new mongoose.Types.ObjectId(companyId),
            connectionId: new mongoose.Types.ObjectId(connectionId),
            googleUserId: userData.id, // Correct field name
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
          console.error(`❌ Service Account: Error syncing user ${userData.primaryEmail}:`, userError);
          errorCount++;
          // Continue with next user instead of failing entire sync
        }
      }

      // Update last sync time
      await AppCredentials.findByIdAndUpdate(connectionId, {
        updatedAt: new Date()
      });

      console.log(`✅ Service Account: User sync completed - ${successCount} successful, ${errorCount} errors`);

      return {
        success: true,
        usersCount: allUsers.length,
        successCount,
        errorCount,
        users: allUsers
      };
    } catch (error) {
      console.error('❌ Service Account: Error syncing users:', error);
      throw error;
    }
  }

  /**
   * Sync groups using service account
   */
  async syncGroups(connectionId: string, companyId: string): Promise<any> {
    try {
      const { auth } = await this.createJWTAuth(connectionId, companyId, [
        'https://www.googleapis.com/auth/admin.directory.group.readonly',
        'https://www.googleapis.com/auth/admin.directory.customer.readonly'
      ]);

      const admin = google.admin({ version: 'directory_v1', auth });
      
      // Get customer info first
      const customerInfo = await admin.customers.get({ customerKey: 'my_customer' });
      const customerId = customerInfo.data.id;
      
      // Fetch all groups using customer ID
      let allGroups: any[] = [];
      let pageToken: string | undefined;

      if (customerId) {
        do {
          const response = await admin.groups.list({
            customer: customerId,
            maxResults: 200,
            pageToken
          });

          if (response.data.groups) {
            allGroups = allGroups.concat(response.data.groups);
          }

          pageToken = response.data.nextPageToken || undefined;
        } while (pageToken);
      }

      console.log(`📊 Service Account: Found ${allGroups.length} groups`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Save groups to database
      for (const groupData of allGroups) {
        try {
          // Skip groups without ID or email
          if (!groupData.id || !groupData.email) {
            console.warn(`⚠️ Service Account: Skipping group without ID or email:`, groupData);
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
              connectionId: new mongoose.Types.ObjectId(connectionId),
              googleGroupId: groupData.id, // Fixed: use googleGroupId
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
          console.error(`❌ Service Account: Error syncing group ${groupData.email}:`, groupError);
          errorCount++;
          // Continue with next group instead of failing entire sync
        }
      }
      
      console.log(`✅ Service Account: Group sync completed - ${successCount} successful, ${errorCount} errors`);

      return {
        success: true,
        groupsCount: allGroups.length,
        successCount,
        errorCount,
        groups: allGroups
      };
    } catch (error) {
      console.error('Error syncing groups:', error);
      throw error;
    }
  }

  /**
   * Sync organizational units using service account
   */
  async syncOrgUnits(connectionId: string, companyId: string): Promise<any> {
    try {
      const { auth } = await this.createJWTAuth(connectionId, companyId, [
        'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
        'https://www.googleapis.com/auth/admin.directory.customer.readonly'
      ]);

      const admin = google.admin({ version: 'directory_v1', auth });
      
      // Get customer info first
      const customerInfo = await admin.customers.get({ customerKey: 'my_customer' });
      const customerId = customerInfo.data.id;
      
      let orgUnits: any[] = [];
      
      // Fetch all org units using correct customer ID
      if (customerId) {
        const response = await admin.orgunits.list({
          customerId: customerId,
          type: 'all'
        });
        
        orgUnits = response.data.organizationUnits || [];
      }

      console.log(`📊 Service Account: Found ${orgUnits.length} organizational units`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Save org units to database
      for (const orgUnitData of orgUnits) {
        try {
          // Skip org units without ID or path
          if (!orgUnitData.orgUnitId || !orgUnitData.orgUnitPath) {
            console.warn(`⚠️ Service Account: Skipping org unit without ID or path:`, orgUnitData);
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
              connectionId: new mongoose.Types.ObjectId(connectionId),
              googleOrgUnitId: orgUnitData.orgUnitId, // Fixed: use googleOrgUnitId
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
          console.error(`❌ Service Account: Error syncing org unit ${orgUnitData.orgUnitPath}:`, orgUnitError);
          errorCount++;
          // Continue with next org unit instead of failing entire sync
        }
      }
      
      console.log(`✅ Service Account: Org units sync completed - ${successCount} successful, ${errorCount} errors`);

      return {
        success: true,
        orgUnitsCount: orgUnits.length,
        successCount,
        errorCount,
        orgUnits: orgUnits
      };
    } catch (error) {
      console.error('Error syncing org units:', error);
      throw error;
    }
  }
}
