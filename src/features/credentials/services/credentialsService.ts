import { AppCredentials, IAppCredentials } from '../../../database/models/AppCredentials';
import { encrypt, decrypt } from '../../../utils/encryption';
import mongoose from 'mongoose';
import { ConnectionSyncService } from './connectionSyncService';

export interface CredentialValidation {
  isValid: boolean;
  missingFields: string[];
}

export class CredentialsService {
  private connectionSyncService: ConnectionSyncService;

  constructor() {
    this.connectionSyncService = new ConnectionSyncService();
  }
  
  async saveCredentials(
    companyId: string,
    appType: string,
    appName: string,
    credentials: { [key: string]: string },
    userId: string
  ): Promise<IAppCredentials> {
    // Encrypt sensitive credential data
    const encryptedCredentials: { [key: string]: any } = {};
    
    for (const [key, value] of Object.entries(credentials)) {
      if (value && value.trim()) {
        encryptedCredentials[key] = encrypt(value.trim());
      }
    }

    // Create or update credentials
    const credentialDoc = await AppCredentials.findOneAndUpdate(
      {
        companyId: new mongoose.Types.ObjectId(companyId),
        appType,
        appName
      },
      {
        credentials: encryptedCredentials,
        isActive: true,
        createdBy: new mongoose.Types.ObjectId(userId)
      },
      {
        upsert: true,
        new: true
      }
    );

    // Try to sync credentials to create actual service connections
    try {
      await this.connectionSyncService.syncCredentialsToConnections(companyId, appType, appName);
    } catch (error) {
      console.error('Failed to sync credentials to connections:', error);
      // Don't fail the save operation if sync fails
    }

    return credentialDoc;
  }

  async getAllCredentials(companyId: string): Promise<any[]> {
    const credentials = await AppCredentials.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    }).sort({ appType: 1, appName: 1 });

    // Get connection status for each credential
    const credentialsWithStatus = await Promise.all(
      credentials.map(async (cred) => {
        const connectionStatus = await this.connectionSyncService.getConnectionStatus(
          companyId,
          cred.appType,
          cred.appName
        );

        return {
          id: (cred._id as any).toString(),
          appType: cred.appType,
          appName: cred.appName,
          isActive: cred.isActive,
          createdAt: cred.createdAt,
          hasCredentials: cred.credentials && Object.keys(cred.credentials).length > 0,
          connectionStatus: {
            isConnected: connectionStatus.isConnected,
            lastSync: connectionStatus.lastSync,
            requiresOAuth: connectionStatus.requiresOAuth,
            connectionDetails: connectionStatus.connectionDetails
          }
        };
      })
    );

    return credentialsWithStatus;
  }

  async getCredentials(
    companyId: string,
    appType: string,
    appName?: string
  ): Promise<IAppCredentials | null> {
    const query: any = {
      companyId: new mongoose.Types.ObjectId(companyId),
      appType,
      isActive: true
    };

    if (appName) {
      query.appName = appName;
    }

    return await AppCredentials.findOne(query);
  }

  async getDecryptedCredentials(
    companyId: string,
    appType: string,
    appName?: string
  ): Promise<{ [key: string]: string } | null> {
    const credentialDoc = await this.getCredentials(companyId, appType, appName);
    
    if (!credentialDoc) {
      return null;
    }

    // Decrypt credentials
    const decryptedCredentials: { [key: string]: string } = {};
    
    for (const [key, encryptedValue] of Object.entries(credentialDoc.credentials)) {
      if (encryptedValue) {
        try {
          // Ensure encryptedValue is in the correct format for decrypt function
          if (typeof encryptedValue === 'object' && encryptedValue !== null) {
            const encObj = encryptedValue as any;
            if (encObj.encrypted && encObj.iv && encObj.authTag) {
              decryptedCredentials[key] = decrypt(encObj);
            } else {
              console.warn(`Invalid encrypted credential format for ${key}, skipping`);
            }
          } else {
            console.warn(`Invalid encrypted credential format for ${key}, skipping`);
          }
        } catch (error) {
          console.error(`Failed to decrypt credential ${key}:`, error);
          // Skip corrupted credentials
        }
      }
    }

    return decryptedCredentials;
  }

  async deleteCredentials(
    companyId: string,
    appType: string,
    appName: string
  ): Promise<void> {
    await AppCredentials.findOneAndUpdate(
      {
        companyId: new mongoose.Types.ObjectId(companyId),
        appType,
        appName
      },
      {
        isActive: false
      }
    );
  }

  async hasCredentials(
    companyId: string,
    appType: string,
    appName?: string
  ): Promise<boolean> {
    const credentials = await this.getCredentials(companyId, appType, appName);
    return credentials !== null && Object.keys(credentials.credentials).length > 0;
  }

  validateCredentials(appType: string, credentials: { [key: string]: string }): CredentialValidation {
    const requirements = this.getCredentialRequirements(appType);
    
    if (!requirements) {
      return { isValid: false, missingFields: ['Invalid app type'] };
    }

    const missingFields: string[] = [];
    
    for (const field of requirements.fields) {
      if (field.required && (!credentials[field.name] || !credentials[field.name].trim())) {
        missingFields.push(field.label);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  public getCredentialRequirements(appType: string) {
    const requirements: { [key: string]: any } = {
      slack: {
        fields: [
          { name: 'clientId', label: 'Client ID', type: 'text', required: true },
          { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
          { name: 'redirectUri', label: 'Redirect URI', type: 'text', required: false, default: 'http://localhost:5000/api/integrations/slack/callback' }
        ],
        instructions: 'Create a Slack app at https://api.slack.com/apps and get your Client ID and Client Secret.'
      },
      zoom: {
        fields: [
          { name: 'clientId', label: 'Client ID', type: 'text', required: true },
          { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
          { name: 'redirectUri', label: 'Redirect URI', type: 'text', required: false, default: 'http://localhost:5000/api/integrations/zoom/callback' }
        ],
        instructions: 'Create a Zoom app at https://marketplace.zoom.us/develop/create and get your Client ID and Client Secret.'
      },
      'google-workspace': {
        fields: [
          { name: 'serviceAccountKey', label: 'Service Account JSON Key', type: 'textarea', required: true },
          { name: 'adminEmail', label: 'Admin Email (for impersonation)', type: 'email', required: true },
          { name: 'customerId', label: 'Customer ID', type: 'text', required: false }
        ],
        instructions: 'Create a Service Account in Google Cloud Console, enable Google Workspace APIs, download the JSON key file, and enable domain-wide delegation. The admin email should have super admin privileges.'
      },
      github: {
        fields: [
          { name: 'personalAccessToken', label: 'Personal Access Token', type: 'password', required: true },
          { name: 'organization', label: 'Organization Name', type: 'text', required: false },
          { name: 'apiUrl', label: 'GitHub API URL', type: 'text', required: false, default: 'https://api.github.com' }
        ],
        instructions: 'Create a Personal Access Token at https://github.com/settings/tokens with repo, admin:org, user, and admin:org_hook scopes.'
      },
      aws: {
        fields: [
          { name: 'accessKey', label: 'Access Key ID', type: 'text', required: true },
          { name: 'secretKey', label: 'Secret Access Key', type: 'password', required: true },
          { name: 'region', label: 'Default Region', type: 'text', required: true, default: 'us-east-1' }
        ],
        instructions: 'Create AWS IAM credentials with appropriate permissions for your organization.'
      }
    };

    return requirements[appType] || null;
  }

  async testCredentials(
    companyId: string,
    appType: string,
    appName?: string
  ): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Use connection sync service to test the connection
      return await this.connectionSyncService.testConnection(companyId, appType, appName || '');
    } catch (error) {
      return {
        success: false,
        message: 'Failed to test credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
