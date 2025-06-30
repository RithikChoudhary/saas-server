import { AppCredentials } from '../../../../database/models/AppCredentials';
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

      // Update last sync time
      await AppCredentials.findByIdAndUpdate(connectionId, {
        updatedAt: new Date()
      });

      return {
        success: true,
        usersCount: allUsers.length,
        users: allUsers
      };
    } catch (error) {
      console.error('Error syncing users:', error);
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

      return {
        success: true,
        groupsCount: allGroups.length,
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

      return {
        success: true,
        orgUnitsCount: orgUnits.length,
        orgUnits: orgUnits
      };
    } catch (error) {
      console.error('Error syncing org units:', error);
      throw error;
    }
  }
}
