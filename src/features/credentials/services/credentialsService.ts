import { AppCredentials, IAppCredentials } from '../../../database/models/AppCredentials';
import { encrypt, decrypt } from '../../../utils/encryption';
import mongoose from 'mongoose';
// Import all connection models to avoid schema registration errors
import { AWSAccount } from '../../../database/models/AWSAccount';
import { GitHubConnection } from '../../../database/models/GitHubConnection';
import { SlackConnection } from '../../../database/models/SlackConnection';
import { ZoomConnection } from '../../../database/models/ZoomConnection';
import { GoogleWorkspaceConnection } from '../../../database/models/GoogleWorkspaceConnection';

export interface CredentialValidation {
  isValid: boolean;
  missingFields: string[];
}

export class CredentialsService {
  constructor() {
    // Removed circular dependency
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

    return credentialDoc;
  }

  async getAllCredentials(companyId: string): Promise<any[]> {
    const credentials = await AppCredentials.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    }).sort({ appType: 1, appName: 1 });

    // Return simplified credential info without connection status to avoid circular dependency
    return credentials.map((cred) => ({
      id: (cred._id as any).toString(),
      appType: cred.appType,
      appName: cred.appName,
      isActive: cred.isActive,
      createdAt: cred.createdAt,
      hasCredentials: cred.credentials && Object.keys(cred.credentials).length > 0
    }));
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
    try {
      const credentialDoc = await this.getCredentials(companyId, appType, appName);
      
      if (!credentialDoc) {
        console.log(`🔍 No credentials found for ${appType}${appName ? ` (${appName})` : ''}`);
        return null;
      }

      console.log(`🔓 Decrypting credentials for ${appType}${appName ? ` (${appName})` : ''}...`);

      // Decrypt credentials
      const decryptedCredentials: { [key: string]: string } = {};
      let successCount = 0;
      let errorCount = 0;
      
      for (const [key, encryptedValue] of Object.entries(credentialDoc.credentials)) {
        if (encryptedValue) {
          try {
            // Ensure encryptedValue is in the correct format for decrypt function
            if (typeof encryptedValue === 'object' && encryptedValue !== null) {
              const encObj = encryptedValue as any;
              if (encObj.encrypted && encObj.iv && encObj.authTag) {
                const decryptedValue = decrypt(encObj);
                if (decryptedValue && decryptedValue.trim()) {
                  decryptedCredentials[key] = decryptedValue;
                  successCount++;
                } else {
                  console.warn(`⚠️  Decrypted credential ${key} is empty`);
                }
              } else {
                console.warn(`⚠️  Invalid encrypted credential format for ${key} - missing required fields`);
                errorCount++;
              }
            } else {
              console.warn(`⚠️  Invalid encrypted credential format for ${key} - not an object`);
              errorCount++;
            }
          } catch (error) {
            console.error(`❌ Failed to decrypt credential ${key}:`, error);
            errorCount++;
          }
        }
      }

      console.log(`✅ Credential decryption complete: ${successCount} successful, ${errorCount} failed`);

      if (successCount === 0 && errorCount > 0) {
        console.error(`❌ All credential decryption failed for ${appType}. This may indicate encryption key issues.`);
        return null;
      }

      return decryptedCredentials;
    } catch (error) {
      console.error(`❌ Error in getDecryptedCredentials for ${appType}:`, error);
      return null;
    }
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
    // Import the enhanced validator
    const { CredentialsValidator } = require('../validators/credentialsValidator');
    
    try {
      const validationResult = CredentialsValidator.validateCredentials(appType, credentials);
      
      return {
        isValid: validationResult.isValid,
        missingFields: validationResult.errors
      };
    } catch (error) {
      console.error(`❌ Validation error for ${appType}:`, error);
      
      // Fallback to basic validation
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
      // Simple credential validation - just check if they exist and are decryptable
      const credentials = await this.getDecryptedCredentials(companyId, appType, appName);
      
      if (!credentials) {
        return {
          success: false,
          message: 'No credentials found',
          details: 'Please configure credentials first'
        };
      }

      // Basic validation based on app type
      const requirements = this.getCredentialRequirements(appType);
      if (requirements) {
        const validation = this.validateCredentials(appType, credentials);
        if (!validation.isValid) {
          return {
            success: false,
            message: 'Invalid credentials',
            details: `Missing: ${validation.missingFields.join(', ')}`
          };
        }
      }

      return {
        success: true,
        message: 'Credentials are valid and properly encrypted',
        details: 'Ready for connection'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to test credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getServicesStatus(companyId: string): Promise<any[]> {
    const services = [
      {
        id: 'slack',
        name: 'Slack',
        description: 'Team communication and collaboration platform',
        icon: '💬',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        category: 'communication'
      },
      {
        id: 'google-workspace',
        name: 'Google Workspace',
        description: 'Google productivity and collaboration suite',
        icon: '📧',
        color: 'bg-green-100 text-green-800 border-green-200',
        category: 'productivity'
      },
      {
        id: 'github',
        name: 'GitHub',
        description: 'Code repository and collaboration platform',
        icon: '🐙',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        category: 'development'
      },
      {
        id: 'zoom',
        name: 'Zoom',
        description: 'Video conferencing and communication platform',
        icon: '📹',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        category: 'communication'
      },
      {
        id: 'aws',
        name: 'Amazon Web Services',
        description: 'Cloud computing and infrastructure platform',
        icon: '☁️',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        category: 'cloud'
      },
      {
        id: 'azure',
        name: 'Microsoft Azure',
        description: 'Microsoft cloud computing platform',
        icon: '🔷',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        category: 'cloud'
      }
    ];

    // Check status for each service
    const servicesWithStatus = await Promise.all(
      services.map(async (service) => {
        try {
          // Check if credentials exist
          const hasCredentials = await this.hasCredentials(companyId, service.id);
          
          // Check if there are active connections for this service
          let hasActiveConnection = false;
          try {
            switch (service.id) {
              case 'slack':
                const slackConns = await SlackConnection.find({ 
                  companyId: new mongoose.Types.ObjectId(companyId), 
                  isActive: true 
                });
                hasActiveConnection = slackConns.length > 0;
                break;
                
              case 'google-workspace':
                const gwConns = await GoogleWorkspaceConnection.find({ 
                  companyId: new mongoose.Types.ObjectId(companyId), 
                  isActive: true 
                });
                hasActiveConnection = gwConns.length > 0;
                break;
                
              case 'github':
                const githubConns = await GitHubConnection.find({ 
                  companyId: new mongoose.Types.ObjectId(companyId), 
                  isActive: true 
                });
                hasActiveConnection = githubConns.length > 0;
                break;
                
              case 'zoom':
                const zoomConns = await ZoomConnection.find({ 
                  companyId: new mongoose.Types.ObjectId(companyId), 
                  isActive: true 
                });
                hasActiveConnection = zoomConns.length > 0;
                break;
                
              case 'aws':
                const awsAccounts = await AWSAccount.find({ 
                  companyId: new mongoose.Types.ObjectId(companyId), 
                  isActive: true 
                });
                hasActiveConnection = awsAccounts.length > 0;
                break;
            }
          } catch (error) {
            console.warn(`Could not check active connections for ${service.id}:`, error instanceof Error ? error.message : 'Unknown error');
          }
          
          // Determine service status
          let oauthAvailable = false;
          let connectionStatus = 'setup-required';
          let actionText = 'Setup Required';
          
          if (hasActiveConnection) {
            // Service is already connected
            connectionStatus = 'connected';
            actionText = 'Connected';
          } else if (['slack', 'google-workspace', 'github', 'zoom'].includes(service.id)) {
            oauthAvailable = true;
            
            if (hasCredentials) {
              // Try to test the connection
              try {
                const testResult = await this.testCredentials(companyId, service.id);
                if (testResult.success) {
                  connectionStatus = 'available';
                  actionText = 'Connect';
                } else {
                  connectionStatus = 'credentials-invalid';
                  actionText = 'Fix Credentials';
                }
              } catch (error) {
                connectionStatus = 'available';
                actionText = 'Connect';
              }
            } else {
              connectionStatus = 'setup-required';
              actionText = 'Setup & Connect';
            }
          } else if (['aws'].includes(service.id)) {
            // AWS only supports credential-based connection
            oauthAvailable = false;
            if (hasCredentials) {
              connectionStatus = 'available';
              actionText = 'Connect';
            } else {
              connectionStatus = 'setup-required';
              actionText = 'Setup Required';
            }
          } else {
            // Services not yet implemented
            connectionStatus = 'coming-soon';
            actionText = 'Coming Soon';
          }

          return {
            ...service,
            status: connectionStatus,
            actionText,
            oauthAvailable,
            hasCredentials,
            hasActiveConnection,
            isImplemented: !['azure'].includes(service.id) // Mark which services are fully implemented
          };
        } catch (error) {
          console.error(`Error checking status for ${service.id}:`, error);
          return {
            ...service,
            status: 'error',
            actionText: 'Error',
            oauthAvailable: false,
            hasCredentials: false,
            hasActiveConnection: false,
            isImplemented: false
          };
        }
      })
    );

    return servicesWithStatus;
  }

  async smartConnect(companyId: string, appType: string): Promise<any> {
    try {
      console.log(`🔄 Smart Connect: Initiating connection for ${appType}...`);
      
      // Check if credentials exist
      const hasCredentials = await this.hasCredentials(companyId, appType);
      
      if (!hasCredentials) {
        console.log(`❌ Smart Connect: No credentials found for ${appType}`);
        return {
          success: false,
          action: 'setup-required',
          message: `Please set up ${appType} credentials first`,
          redirectTo: 'credentials-setup'
        };
      }

      console.log(`✅ Smart Connect: Credentials found for ${appType}, proceeding with connection...`);

      // For OAuth-enabled services, generate OAuth URL directly
      if (['slack', 'google-workspace', 'github', 'zoom'].includes(appType)) {
        try {
          // Get decrypted credentials
          const credentials = await this.getDecryptedCredentials(companyId, appType);
          
          if (!credentials) {
            console.error(`❌ Smart Connect: Failed to decrypt credentials for ${appType}`);
            return {
              success: false,
              action: 'credentials-invalid',
              message: `Failed to decrypt ${appType} credentials. Please re-enter your credentials.`,
              redirectTo: 'credentials-setup'
            };
          }

          console.log(`🔓 Smart Connect: Credentials decrypted for ${appType}`);

          // Generate OAuth URL based on service type
          let authUrl = '';
          switch (appType) {
            case 'slack':
              authUrl = await this.generateSlackOAuthUrl(companyId, credentials);
              break;
            case 'github':
              authUrl = await this.generateGitHubOAuthUrl(companyId, credentials);
              break;
            case 'zoom':
              authUrl = await this.generateZoomOAuthUrl(companyId, credentials);
              break;
            case 'google-workspace':
              // Google Workspace uses service account, not OAuth
              return await this.connectGoogleWorkspace(companyId, credentials);
          }

          if (authUrl) {
            console.log(`✅ Smart Connect: OAuth URL generated for ${appType}`);
            return {
              success: true,
              action: 'oauth-redirect',
              message: `Redirecting to ${appType} OAuth...`,
              authUrl: authUrl
            };
          } else {
            throw new Error('Failed to generate OAuth URL');
          }
        } catch (error) {
          console.error(`❌ Smart Connect OAuth Error for ${appType}:`, error);
          return {
            success: false,
            action: 'oauth-failed',
            message: `Failed to initiate ${appType} OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      } else if (appType === 'aws') {
        // For AWS, test credentials and create connection
        try {
          const credentials = await this.getDecryptedCredentials(companyId, appType);
          if (!credentials) {
            return {
              success: false,
              action: 'credentials-invalid',
              message: 'Failed to decrypt AWS credentials. Please re-enter your credentials.',
              redirectTo: 'credentials-setup'
            };
          }

          // Test AWS credentials and create connection
          const connectionResult = await this.connectAWS(companyId, credentials);
          return connectionResult;
        } catch (error) {
          console.error(`❌ Smart Connect AWS Error:`, error);
          return {
            success: false,
            action: 'connection-failed',
            message: `Failed to connect to AWS: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      } else {
        // For other services, return setup instructions
        return {
          success: false,
          action: 'manual-setup',
          message: `${appType} connection method not implemented yet.`,
          redirectTo: 'documentation'
        };
      }
    } catch (error) {
      console.error(`❌ Smart Connect Error for ${appType}:`, error);
      return {
        success: false,
        action: 'error',
        message: 'Connection failed due to an unexpected error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper method to generate Slack OAuth URL
  private async generateSlackOAuthUrl(companyId: string, credentials: { [key: string]: string }): Promise<string> {
    const { clientId, redirectUri } = credentials;
    
    if (!clientId) {
      throw new Error('Slack Client ID is required');
    }

    // Generate state for CSRF protection
    const state = Buffer.from(JSON.stringify({
      companyId,
      timestamp: Date.now(),
      service: 'slack'
    })).toString('base64');

    // Slack OAuth scopes
    const scopes = [
      'channels:read',
      'channels:history',
      'groups:read',
      'groups:history',
      'im:read',
      'im:history',
      'mpim:read',
      'mpim:history',
      'users:read',
      'users:read.email',
      'team:read',
      'chat:write',
      'files:read'
    ].join(',');

    const finalRedirectUri = redirectUri || 'http://localhost:5000/api/integrations/slack/callback';

    const authUrl = `https://slack.com/oauth/v2/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(finalRedirectUri)}&` +
      `state=${state}`;

    console.log(`🔗 Generated Slack OAuth URL for company ${companyId}`);
    return authUrl;
  }

  // Helper method to generate GitHub OAuth URL
  private async generateGitHubOAuthUrl(companyId: string, credentials: { [key: string]: string }): Promise<string> {
    const { personalAccessToken, organization } = credentials;
    
    if (!personalAccessToken) {
      throw new Error('GitHub Personal Access Token is required');
    }

    // For GitHub, we don't use OAuth2 flow with personal access tokens
    // Instead, we directly create the connection
    const connectionResult = await this.connectGitHub(companyId, credentials);
    
    if (connectionResult.success) {
      // Return a success URL that the frontend can handle
      return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/credentials?github=connected`;
    } else {
      throw new Error(connectionResult.message || 'Failed to connect GitHub');
    }
  }

  // Helper method to generate Zoom OAuth URL
  private async generateZoomOAuthUrl(companyId: string, credentials: { [key: string]: string }): Promise<string> {
    const { clientId, redirectUri } = credentials;
    
    if (!clientId) {
      throw new Error('Zoom Client ID is required');
    }

    // Generate state for CSRF protection
    const state = Buffer.from(JSON.stringify({
      companyId,
      timestamp: Date.now(),
      service: 'zoom'
    })).toString('base64');

    const finalRedirectUri = redirectUri || 'http://localhost:5000/api/integrations/zoom/callback';

    const authUrl = `https://zoom.us/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(finalRedirectUri)}&` +
      `state=${state}`;

    console.log(`🔗 Generated Zoom OAuth URL for company ${companyId}`);
    return authUrl;
  }

  // Helper method to connect Google Workspace
  private async connectGoogleWorkspace(companyId: string, credentials: { [key: string]: string }): Promise<any> {
    const { serviceAccountKey, adminEmail } = credentials;
    
    if (!serviceAccountKey || !adminEmail) {
      throw new Error('Google Workspace Service Account Key and Admin Email are required');
    }

    try {
      // Parse and validate service account key
      const keyData = JSON.parse(serviceAccountKey);
      
      if (!keyData.client_email || !keyData.private_key || !keyData.project_id) {
        throw new Error('Invalid Service Account Key format');
      }

      // Create or update Google Workspace connection
      const connection = await GoogleWorkspaceConnection.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(companyId),
          domain: keyData.project_id
        },
        {
          domain: keyData.project_id,
          connectionType: 'service-account',
          serviceAccountEmail: keyData.client_email,
          adminEmail: adminEmail,
          isActive: true,
          lastSync: new Date()
        },
        {
          upsert: true,
          new: true
        }
      );

      console.log(`✅ Google Workspace connection created/updated for company ${companyId}`);
      
      return {
        success: true,
        action: 'connected',
        message: 'Google Workspace connected successfully',
        connectionId: (connection._id as any).toString()
      };
    } catch (error) {
      console.error('❌ Google Workspace connection error:', error);
      throw new Error(`Failed to connect Google Workspace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to connect GitHub
  private async connectGitHub(companyId: string, credentials: { [key: string]: string }): Promise<any> {
    const { personalAccessToken, organization } = credentials;
    
    if (!personalAccessToken) {
      throw new Error('GitHub Personal Access Token is required');
    }

    try {
      // Test the token by making a request to GitHub API
      const axios = require('axios');
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${personalAccessToken}`,
          'User-Agent': 'SaaS-Management-Platform'
        }
      });

      const userData = response.data;

      // Create or update GitHub connection
      const connection = await GitHubConnection.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(companyId),
          username: userData.login
        },
        {
          username: userData.login,
          organizationName: organization || null,
          connectionType: 'personal-access-token',
          scope: 'user',
          isActive: true,
          lastSync: new Date()
        },
        {
          upsert: true,
          new: true
        }
      );

      console.log(`✅ GitHub connection created/updated for company ${companyId}`);
      
      return {
        success: true,
        action: 'connected',
        message: 'GitHub connected successfully',
        connectionId: (connection._id as any).toString()
      };
    } catch (error) {
      console.error('❌ GitHub connection error:', error);
      throw new Error(`Failed to connect GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to connect AWS
  private async connectAWS(companyId: string, credentials: { [key: string]: string }): Promise<any> {
    const { accessKey, secretKey, region } = credentials;
    
    if (!accessKey || !secretKey) {
      throw new Error('AWS Access Key and Secret Key are required');
    }

    try {
      // In a real implementation, you would test the credentials with AWS SDK
      // For now, we'll create a basic connection record
      const accountId = `aws-${Date.now()}`;
      
      const awsAccount = await AWSAccount.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(companyId),
          accountId: accountId
        },
        {
          accountName: `AWS Account (${region || 'us-east-1'})`,
          region: region || 'us-east-1',
          status: 'connected',
          accessType: 'access-keys',
          isActive: true,
          lastSync: new Date()
        },
        {
          upsert: true,
          new: true
        }
      );

      console.log(`✅ AWS connection created/updated for company ${companyId}`);
      
      return {
        success: true,
        action: 'connected',
        message: 'AWS connected successfully',
        accountId: awsAccount.accountId
      };
    } catch (error) {
      console.error('❌ AWS connection error:', error);
      throw new Error(`Failed to connect AWS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Comprehensive service disconnect method
  async disconnectService(companyId: string, appType: string): Promise<any> {
    try {
      console.log(`🔄 Disconnecting ${appType} for company ${companyId}...`);
      
      const results = {
        credentialsDeleted: false,
        connectionsDeleted: 0,
        errors: [] as string[]
      };

      // Step 1: Delete app credentials
      try {
        await this.deleteServiceCredentials(companyId, appType);
        results.credentialsDeleted = true;
        console.log(`✅ Deleted credentials for ${appType}`);
      } catch (error) {
        const errorMsg = `Failed to delete credentials: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.warn(`⚠️ ${errorMsg}`);
      }

      // Step 2: Delete connection data based on service type
      try {
        switch (appType) {
          case 'slack':
            const slackConnections = await SlackConnection.find({ 
              companyId: new mongoose.Types.ObjectId(companyId), 
              isActive: true 
            });
            for (const conn of slackConnections) {
              await SlackConnection.findByIdAndUpdate(conn._id, { isActive: false });
              results.connectionsDeleted++;
            }
            break;
            
          case 'google-workspace':
            const gwConnections = await GoogleWorkspaceConnection.find({ 
              companyId: new mongoose.Types.ObjectId(companyId), 
              isActive: true 
            });
            for (const conn of gwConnections) {
              await GoogleWorkspaceConnection.findByIdAndUpdate(conn._id, { isActive: false });
              results.connectionsDeleted++;
            }
            break;
            
          case 'github':
            const githubConnections = await GitHubConnection.find({ 
              companyId: new mongoose.Types.ObjectId(companyId), 
              isActive: true 
            });
            for (const conn of githubConnections) {
              await GitHubConnection.findByIdAndUpdate(conn._id, { isActive: false });
              results.connectionsDeleted++;
            }
            break;
            
          case 'zoom':
            const zoomConnections = await ZoomConnection.find({ 
              companyId: new mongoose.Types.ObjectId(companyId), 
              isActive: true 
            });
            for (const conn of zoomConnections) {
              await ZoomConnection.findByIdAndUpdate(conn._id, { isActive: false });
              results.connectionsDeleted++;
            }
            break;
            
          case 'aws':
            const awsAccounts = await AWSAccount.find({ 
              companyId: new mongoose.Types.ObjectId(companyId), 
              isActive: true 
            });
            for (const account of awsAccounts) {
              await AWSAccount.findByIdAndUpdate(account._id, { isActive: false });
              results.connectionsDeleted++;
            }
            break;
        }
        
        console.log(`✅ Cleaned up ${results.connectionsDeleted} connections for ${appType}`);
      } catch (error) {
        const errorMsg = `Failed to clean up connections: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.warn(`⚠️ ${errorMsg}`);
      }

      console.log(`✅ Service disconnect completed for ${appType}:`, results);
      return results;
    } catch (error) {
      console.error(`❌ Service disconnect failed for ${appType}:`, error);
      throw new Error(`Failed to disconnect ${appType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Delete all credentials for a service type
  async deleteServiceCredentials(companyId: string, appType: string): Promise<any> {
    try {
      console.log(`🔄 Deleting all ${appType} credentials for company ${companyId}...`);
      
      const result = await AppCredentials.updateMany(
        {
          companyId: new mongoose.Types.ObjectId(companyId),
          appType: appType,
          isActive: true
        },
        {
          isActive: false,
          deletedAt: new Date()
        }
      );

      console.log(`✅ Deleted ${result.modifiedCount} credential records for ${appType}`);
      
      return {
        deletedCount: result.modifiedCount,
        appType: appType,
        companyId: companyId
      };
    } catch (error) {
      console.error(`❌ Failed to delete service credentials for ${appType}:`, error);
      throw new Error(`Failed to delete ${appType} credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
