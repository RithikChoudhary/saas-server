import { DatadogConnection, DatadogUser, GoogleWorkspaceUser } from '../../../../database/models';
import { decrypt } from '../../../../utils/encryption';
import axios from 'axios';

export class DatadogUserService {
  
  async syncUsers(connectionId: string, companyId: string): Promise<any> {
    try {
      // First try to find a formal DatadogConnection
      let connection = await DatadogConnection.findOne({
        _id: connectionId,
        companyId,
        isActive: true
      });

      let apiKey: string = '';
      let applicationKey: string = '';
      let site: string = 'datadoghq.com';
      let organizationName: string = 'Unknown';
      let credentialsFound = false;

      if (connection) {
        // Formal connection found - check if it has valid credentials
        console.log('Using formal DatadogConnection for sync');
        
        // Check if credentials exist and are properly formatted
        const hasValidApiKey = connection.apiKey && 
                              typeof connection.apiKey === 'object' && 
                              connection.apiKey.encrypted && 
                              connection.apiKey.iv && 
                              connection.apiKey.authTag;
                              
        const hasValidAppKey = connection.applicationKey && 
                              typeof connection.applicationKey === 'object' && 
                              connection.applicationKey.encrypted && 
                              connection.applicationKey.iv && 
                              connection.applicationKey.authTag;

        if (hasValidApiKey && hasValidAppKey) {
          // Update sync status
          await DatadogConnection.findByIdAndUpdate(connectionId, {
            syncStatus: 'syncing'
          });

          try {
            apiKey = decrypt(connection.apiKey);
            applicationKey = decrypt(connection.applicationKey);
            site = connection.site;
            organizationName = connection.organizationName;
            credentialsFound = true;
            console.log('Successfully decrypted formal connection credentials');
          } catch (error) {
            console.error('Error decrypting Datadog credentials:', error);
            console.log('Falling back to credentials service due to decryption error');
            connection = null; // Force fallback to credentials service
          }
        } else {
          console.log('Formal connection found but credentials are invalid/undefined, falling back to credentials service');
          connection = null; // Force fallback to credentials service
        }
      }
      
      if (!connection || !credentialsFound) {
        // No formal connection - check if this is a credentials-based connection
        console.log('No formal connection found, checking credentials-based connection');
        
        const credentialsService = new (require('../../../credentials/services/credentialsService').CredentialsService)();
        const credentialsData = await credentialsService.getDecryptedCredentials(companyId, 'datadog');
        
        if (!credentialsData) {
          throw new Error('Connection not found - no formal connection or credentials available');
        }

        apiKey = credentialsData.apiKey;
        applicationKey = credentialsData.applicationKey;
        site = credentialsData.site || 'datadoghq.com';
        organizationName = credentialsData.organizationName || 'Datadog Organization';

        console.log('Using credentials-based connection for sync');
      }
      const baseUrl = `https://api.${site}`;

      // Fetch users from Datadog API
      console.log(`🔍 Attempting to fetch users from: ${baseUrl}/api/v2/users`);
      console.log(`🔑 Using API Key: ${apiKey.substring(0, 8)}...`);
      console.log(`🔑 Using App Key: ${applicationKey.substring(0, 8)}...`);
      
      const response = await axios.get(`${baseUrl}/api/v2/users`, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': applicationKey,
          'Content-Type': 'application/json'
        },
        params: {
          'page[size]': 100
          // Removed invalid 'include': 'roles,teams' parameter
          // Datadog only supports: identity_providers, allowed_login_methods_identity_providers
        }
      });

      const datadogUsers = response.data.data;
      const syncResults = {
        total: datadogUsers.length,
        created: 0,
        updated: 0,
        errors: 0
      };

      // Process each user
      for (const ddUser of datadogUsers) {
        try {
          const userData = {
            companyId,
            connectionId,
            datadogUserId: ddUser.id,
            email: ddUser.attributes.email,
            name: ddUser.attributes.name || ddUser.attributes.email,
            handle: ddUser.attributes.handle,
            title: ddUser.attributes.title,
            verified: ddUser.attributes.verified,
            disabled: ddUser.attributes.disabled,
            status: ddUser.attributes.disabled ? 'Disabled' : 'Active',
            roles: ddUser.relationships?.roles?.data?.map((role: any) => role.id) || [],
            teams: ddUser.relationships?.teams?.data?.map((team: any) => team.id) || []
          };

          const existingUser = await DatadogUser.findOne({
            companyId,
            datadogUserId: ddUser.id
          });

          if (existingUser) {
            await DatadogUser.findByIdAndUpdate(existingUser._id, userData);
            syncResults.updated++;
          } else {
            await DatadogUser.create(userData);
            syncResults.created++;
          }
        } catch (error) {
          console.error(`Error syncing user ${ddUser.id}:`, error);
          syncResults.errors++;
        }
      }

      // Correlate with Google Workspace users
      await this.correlateWithGoogleWorkspace(companyId, connectionId);

      // Update connection sync status
      await DatadogConnection.findByIdAndUpdate(connectionId, {
        syncStatus: 'completed',
        lastSync: new Date(),
        errorMessage: null
      });

      return {
        success: true,
        results: syncResults
      };

    } catch (error: any) {
      console.error('❌ Datadog API Error Details:');
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      
      if (error.response?.data?.errors) {
        console.error('🔍 Datadog Error Messages:');
        error.response.data.errors.forEach((err: any, index: number) => {
          console.error(`  ${index + 1}. ${JSON.stringify(err, null, 2)}`);
        });
      }
      
      if (error.response?.data) {
        console.error('📋 Full Response Data:', JSON.stringify(error.response.data, null, 2));
      }

      // Create a more detailed error message
      let detailedErrorMessage = error.message;
      if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        const firstError = error.response.data.errors[0];
        detailedErrorMessage = `Datadog API Error: ${firstError.detail || firstError.title || firstError.message || 'Unknown error'}`;
      }

      // Update connection with error status
      await DatadogConnection.findByIdAndUpdate(connectionId, {
        syncStatus: 'failed',
        errorMessage: detailedErrorMessage
      });

      throw new Error(detailedErrorMessage);
    }
  }

  async getUsers(companyId: string, connectionId?: string): Promise<any[]> {
    const filter: any = { companyId };
    if (connectionId) {
      filter.connectionId = connectionId;
    }

    const users = await DatadogUser.find(filter).sort({ name: 1 });

    return users.map((user: any) => ({
      id: user._id.toString(),
      datadogUserId: user.datadogUserId,
      email: user.email,
      name: user.name,
      handle: user.handle,
      title: user.title,
      verified: user.verified,
      disabled: user.disabled,
      status: user.status,
      roles: user.roles,
      teams: user.teams,
      lastLogin: user.lastLogin,
      correlationStatus: user.correlationStatus,
      googleWorkspaceUserId: user.googleWorkspaceUserId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
  }

  async getUserById(userId: string, companyId: string): Promise<any> {
    const user = await DatadogUser.findOne({
      _id: userId,
      companyId
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: (user as any)._id.toString(),
      datadogUserId: user.datadogUserId,
      email: user.email,
      name: user.name,
      handle: user.handle,
      title: user.title,
      verified: user.verified,
      disabled: user.disabled,
      status: user.status,
      roles: user.roles,
      teams: user.teams,
      lastLogin: user.lastLogin,
      correlationStatus: user.correlationStatus,
      googleWorkspaceUserId: user.googleWorkspaceUserId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  private async correlateWithGoogleWorkspace(companyId: string, connectionId: string): Promise<void> {
    try {
      // Get all Datadog users for this connection
      const datadogUsers = await DatadogUser.find({
        companyId,
        connectionId
      });

      // Get all Google Workspace users for this company
      const googleUsers = await GoogleWorkspaceUser.find({
        companyId
      });

      // Create email lookup map for Google users
      const googleUserMap = new Map();
      googleUsers.forEach(user => {
        googleUserMap.set(user.primaryEmail.toLowerCase(), user);
      });

      // Correlate users based on email matching
      for (const ddUser of datadogUsers) {
        const googleUser = googleUserMap.get(ddUser.email.toLowerCase());
        
        if (googleUser) {
          // Exact email match
          await DatadogUser.findByIdAndUpdate(ddUser._id, {
            googleWorkspaceUserId: googleUser.googleUserId,
            correlationStatus: 'matched',
            correlationScore: 1.0
          });
        } else {
          // Check for partial matches (same domain, similar names, etc.)
          const partialMatch = this.findPartialMatch(ddUser, googleUsers);
          
          if (partialMatch) {
            await DatadogUser.findByIdAndUpdate(ddUser._id, {
              googleWorkspaceUserId: partialMatch.user.googleUserId,
              correlationStatus: partialMatch.score > 0.8 ? 'matched' : 'conflict',
              correlationScore: partialMatch.score
            });
          } else {
            await DatadogUser.findByIdAndUpdate(ddUser._id, {
              correlationStatus: 'unmatched',
              correlationScore: 0
            });
          }
        }
      }
    } catch (error) {
      console.error('Error correlating with Google Workspace:', error);
    }
  }

  private findPartialMatch(datadogUser: any, googleUsers: any[]): { user: any; score: number } | null {
    let bestMatch = null;
    let bestScore = 0;

    for (const googleUser of googleUsers) {
      let score = 0;

      // Check domain match
      const ddDomain = datadogUser.email.split('@')[1];
      const googleDomain = googleUser.primaryEmail.split('@')[1];
      if (ddDomain === googleDomain) {
        score += 0.3;
      }

      // Check name similarity
      const ddName = datadogUser.name.toLowerCase();
      const googleName = (googleUser.name?.fullName || '').toLowerCase();
      
      if (ddName === googleName) {
        score += 0.5;
      } else if (ddName.includes(googleName) || googleName.includes(ddName)) {
        score += 0.3;
      }

      // Check username similarity
      const ddUsername = datadogUser.email.split('@')[0];
      const googleUsername = googleUser.primaryEmail.split('@')[0];
      
      if (ddUsername === googleUsername) {
        score += 0.4;
      } else if (ddUsername.includes(googleUsername) || googleUsername.includes(ddUsername)) {
        score += 0.2;
      }

      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = { user: googleUser, score };
      }
    }

    return bestMatch;
  }

  async getUserStats(companyId: string, connectionId?: string): Promise<any> {
    const filter: any = { companyId };
    if (connectionId) {
      filter.connectionId = connectionId;
    }

    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      verifiedUsers,
      matchedUsers,
      unmatchedUsers
    ] = await Promise.all([
      DatadogUser.countDocuments(filter),
      DatadogUser.countDocuments({ ...filter, status: 'Active' }),
      DatadogUser.countDocuments({ ...filter, disabled: true }),
      DatadogUser.countDocuments({ ...filter, verified: true }),
      DatadogUser.countDocuments({ ...filter, correlationStatus: 'matched' }),
      DatadogUser.countDocuments({ ...filter, correlationStatus: 'unmatched' })
    ]);

    return {
      totalUsers,
      activeUsers,
      disabledUsers,
      verifiedUsers,
      matchedUsers,
      unmatchedUsers,
      correlationRate: totalUsers > 0 ? (matchedUsers / totalUsers * 100).toFixed(1) : 0
    };
  }
}
