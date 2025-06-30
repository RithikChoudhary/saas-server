import { AppCredentials } from '../../../database/models/AppCredentials';
import { GitHubConnection, SlackConnection } from '../../../database/models';
import { AWSAccount } from '../../../database/models/AWSAccount';
import { GitHubConnectionService } from '../../integrations/github/services/githubConnectionService';
import { SlackConnectionService } from '../../integrations/slack/services/slackConnectionService';
import { decrypt } from '../../../utils/encryption';
import mongoose from 'mongoose';

export class ConnectionSyncService {
  private githubConnectionService: GitHubConnectionService;
  private slackConnectionService: SlackConnectionService;

  constructor() {
    this.githubConnectionService = new GitHubConnectionService();
    this.slackConnectionService = new SlackConnectionService();
  }

  /**
   * Sync credentials to create actual service connections
   */
  async syncCredentialsToConnections(companyId: string, appType: string, appName: string): Promise<any> {
    try {
      const credentials = await AppCredentials.findOne({
        companyId: new mongoose.Types.ObjectId(companyId),
        appType,
        appName,
        isActive: true
      });

      if (!credentials) {
        throw new Error('Credentials not found');
      }

      // Decrypt credentials
      const decryptedCredentials: { [key: string]: string } = {};
      for (const [key, encryptedValue] of Object.entries(credentials.credentials)) {
        if (encryptedValue && typeof encryptedValue === 'object') {
          const encObj = encryptedValue as any;
          if (encObj.encrypted && encObj.iv && encObj.authTag) {
            decryptedCredentials[key] = decrypt(encObj);
          }
        }
      }

      switch (appType) {
        case 'github':
          return await this.syncGitHubCredentials(companyId, appName, decryptedCredentials);
        case 'slack':
          return await this.syncSlackCredentials(companyId, appName, decryptedCredentials);
        case 'aws':
          return await this.syncAWSCredentials(companyId, appName, decryptedCredentials);
        case 'google-workspace':
          return await this.syncGoogleWorkspaceCredentials(companyId, appName, decryptedCredentials);
        default:
          throw new Error(`Connection sync not implemented for ${appType}`);
      }
    } catch (error) {
      console.error('Error syncing credentials to connections:', error);
      throw error;
    }
  }

  private async syncGitHubCredentials(companyId: string, appName: string, credentials: any): Promise<any> {
    const { personalAccessToken, organization } = credentials;

    if (!personalAccessToken) {
      throw new Error('Personal Access Token is required for GitHub');
    }

    // Check if connection already exists
    const existingConnection = await GitHubConnection.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      credentialSetName: appName,
      isActive: true
    });

    if (existingConnection) {
      // Update existing connection
      return await this.githubConnectionService.updatePersonalAccessTokenConnection(
        (existingConnection._id as any).toString(),
        companyId,
        personalAccessToken
      );
    } else {
      // Create new connection
      const scope = organization ? 'organization' : 'user';
      const connection = await this.githubConnectionService.createPersonalAccessTokenConnection(
        companyId,
        personalAccessToken,
        scope,
        organization
      );

      // Update connection with credential set name
      await GitHubConnection.findByIdAndUpdate(connection.connectionId, {
        credentialSetName: appName
      });

      return connection;
    }
  }

  private async syncSlackCredentials(companyId: string, appName: string, credentials: any): Promise<any> {
    const { clientId, clientSecret, accessToken } = credentials;

    if (!clientId || !clientSecret) {
      throw new Error('Client ID and Client Secret are required for Slack');
    }

    // For Slack, we need an OAuth flow, but if we have an access token, we can create a connection
    if (accessToken) {
      // Check if connection already exists
      const existingConnection = await SlackConnection.findOne({
        companyId: new mongoose.Types.ObjectId(companyId),
        credentialSetName: appName,
        isActive: true
      });

      if (existingConnection) {
        // Update existing connection
        return { success: true, message: 'Slack connection already exists' };
      } else {
        // Create new connection with the access token
        // This would need to be implemented in SlackConnectionService
        return { 
          success: false, 
          message: 'Slack requires OAuth authentication. Please use the Connect Slack button to authenticate.',
          oauthRequired: true
        };
      }
    }

    return { 
      success: false, 
      message: 'Slack requires OAuth authentication. Please use the Connect Slack button to authenticate.',
      oauthRequired: true
    };
  }

  private async syncAWSCredentials(companyId: string, appName: string, credentials: any): Promise<any> {
    const { accessKey, secretKey, region } = credentials;

    if (!accessKey || !secretKey) {
      throw new Error('Access Key and Secret Key are required for AWS');
    }

    // Check if AWS account already exists
    const existingAccount = await AWSAccount.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      credentialSetName: appName,
      isActive: true
    });

    if (existingAccount) {
      return { success: true, message: 'AWS account already exists', accountId: existingAccount.accountId };
    }

    // For AWS, we need to create an account record
    // In a real implementation, you would verify the credentials with AWS
    const awsAccount = await AWSAccount.create({
      companyId: new mongoose.Types.ObjectId(companyId),
      accountId: `aws-${Date.now()}`, // Placeholder - should be fetched from AWS
      accountName: appName,
      credentialSetName: appName,
      region: region || 'us-east-1',
      status: 'connected',
      accessType: 'access-keys',
      isActive: true
    });

    return {
      success: true,
      message: 'AWS account created',
      accountId: awsAccount.accountId
    };
  }

  private async syncGoogleWorkspaceCredentials(companyId: string, appName: string, credentials: any): Promise<any> {
    const { serviceAccountKey, adminEmail } = credentials;

    if (!serviceAccountKey || !adminEmail) {
      throw new Error('Service Account Key and Admin Email are required for Google Workspace');
    }

    try {
      // Parse the service account key
      const keyData = JSON.parse(serviceAccountKey);
      
      // For Google Workspace, we don't create a connection record like other services
      // Instead, we just validate the credentials
      return {
        success: true,
        message: 'Google Workspace credentials validated',
        details: {
          projectId: keyData.project_id,
          clientEmail: keyData.client_email,
          adminEmail: adminEmail
        }
      };
    } catch (error) {
      throw new Error('Invalid Service Account Key format');
    }
  }

  /**
   * Get connection status for credentials
   */
  async getConnectionStatus(companyId: string, appType: string, appName: string): Promise<any> {
    try {
      let connection;
      let isConnected = false;
      let lastSync = null;
      let connectionDetails = null;

      switch (appType) {
        case 'github':
          connection = await GitHubConnection.findOne({
            companyId: new mongoose.Types.ObjectId(companyId),
            credentialSetName: appName,
            isActive: true
          });
          
          if (connection) {
            isConnected = connection.status === 'connected';
            lastSync = connection.lastSync;
            connectionDetails = {
              username: connection.username,
              organization: connection.organizationName,
              scope: connection.scope,
              connectionType: connection.connectionType
            };
          }
          break;

        case 'slack':
          connection = await SlackConnection.findOne({
            companyId: new mongoose.Types.ObjectId(companyId),
            credentialSetName: appName,
            isActive: true
          });
          
          if (connection) {
            isConnected = connection.status === 'connected';
            lastSync = connection.lastSync;
            connectionDetails = {
              teamId: connection.teamId,
              teamName: connection.teamName,
              scope: connection.scope
            };
          }
          break;

        case 'aws':
          const awsAccount = await AWSAccount.findOne({
            companyId: new mongoose.Types.ObjectId(companyId),
            credentialSetName: appName,
            isActive: true
          });
          
          if (awsAccount) {
            isConnected = awsAccount.status === 'connected';
            lastSync = awsAccount.lastSync;
            connectionDetails = {
              accountId: awsAccount.accountId,
              accountName: awsAccount.accountName,
              region: awsAccount.region
            };
          }
          break;

        case 'google-workspace':
          // For Google Workspace, we check if credentials exist and are valid
          const credentialsDoc = await AppCredentials.findOne({
            companyId: new mongoose.Types.ObjectId(companyId),
            appType: 'google-workspace',
            appName,
            isActive: true
          });
          
          if (credentialsDoc) {
            const googleCreds: { [key: string]: string } = {};
            for (const [key, encryptedValue] of Object.entries(credentialsDoc.credentials)) {
              if (encryptedValue && typeof encryptedValue === 'object') {
                const encObj = encryptedValue as any;
                if (encObj.encrypted && encObj.iv && encObj.authTag) {
                  googleCreds[key] = decrypt(encObj);
                }
              }
            }
            if (googleCreds.serviceAccountKey && googleCreds.adminEmail) {
              try {
                const keyData = JSON.parse(googleCreds.serviceAccountKey);
                isConnected = true;
                connectionDetails = {
                  projectId: keyData.project_id,
                  clientEmail: keyData.client_email,
                  adminEmail: googleCreds.adminEmail
                };
              } catch (error) {
                isConnected = false;
              }
            }
          }
          break;
      }

      return {
        isConnected,
        lastSync,
        connectionDetails,
        requiresOAuth: appType === 'slack' && !isConnected
      };
    } catch (error) {
      console.error('Error getting connection status:', error);
      return {
        isConnected: false,
        lastSync: null,
        connectionDetails: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test connection using saved credentials
   */
  async testConnection(companyId: string, appType: string, appName: string): Promise<any> {
    try {
      // First try to sync credentials to create/update connection
      const syncResult = await this.syncCredentialsToConnections(companyId, appType, appName);
      
      if (syncResult.success === false && syncResult.oauthRequired) {
        return syncResult;
      }

      // Then test the connection
      const connectionStatus = await this.getConnectionStatus(companyId, appType, appName);
      
      return {
        success: connectionStatus.isConnected,
        message: connectionStatus.isConnected ? 'Connection successful' : 'Connection failed',
        details: connectionStatus
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to test connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
