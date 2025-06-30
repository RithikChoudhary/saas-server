import { Request, Response } from 'express';
import { AppCredentialsService } from '../services/appCredentialsService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class AppCredentialsController {
  private appCredentialsService: AppCredentialsService;

  constructor() {
    this.appCredentialsService = new AppCredentialsService();
  }

  // POST /api/apps/credentials
  async saveCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 App Credentials: Saving credentials...');
      
      const companyId = req.user?.companyId;
      const userId = req.user?.userId;
      
      if (!companyId || !userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { appType, appName, credentials } = req.body;

      if (!appType || !appName || !credentials) {
        return res.status(400).json({
          success: false,
          message: 'App type, app name, and credentials are required'
        });
      }

      // Validate credentials for the app type
      const validation = this.appCredentialsService.validateCredentials(appType, credentials);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials',
          missingFields: validation.missingFields
        });
      }

      const result = await this.appCredentialsService.saveCredentials(
        companyId,
        appType,
        appName,
        credentials,
        userId
      );

      console.log('✅ App Credentials: Successfully saved credentials');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ App Credentials Save Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/apps/credentials
  async getAllCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 App Credentials: Fetching all credentials...');
      
      const companyId = req.user?.companyId;
      
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const credentials = await this.appCredentialsService.getAllCredentials(companyId);

      console.log('✅ App Credentials: Successfully fetched credentials');
      res.json({
        success: true,
        data: credentials
      });
    } catch (error) {
      console.error('❌ App Credentials Get All Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/apps/credentials/:appType
  async getCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 App Credentials: Fetching credentials for app type...');
      
      const companyId = req.user?.companyId;
      
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { appType } = req.params;
      const { appName } = req.query;

      const credentials = await this.appCredentialsService.getCredentials(
        companyId,
        appType,
        appName as string
      );

      if (!credentials) {
        return res.status(404).json({
          success: false,
          message: 'Credentials not found'
        });
      }

      // Don't return actual credential values in the response for security
      const safeCredentials = {
        ...credentials,
        credentials: Object.keys(credentials.credentials).reduce((acc: any, key: string) => {
          acc[key] = credentials.credentials[key] ? '***' : null;
          return acc;
        }, {})
      };

      console.log('✅ App Credentials: Successfully fetched credentials');
      res.json({
        success: true,
        data: safeCredentials
      });
    } catch (error) {
      console.error('❌ App Credentials Get Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/apps/credentials/:appType/:appName
  async deleteCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 App Credentials: Deleting credentials...');
      
      const companyId = req.user?.companyId;
      
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { appType, appName } = req.params;

      await this.appCredentialsService.deleteCredentials(companyId, appType, appName);

      console.log('✅ App Credentials: Successfully deleted credentials');
      res.json({
        success: true,
        message: 'Credentials deleted successfully'
      });
    } catch (error) {
      console.error('❌ App Credentials Delete Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/apps/credentials/:appType/check
  async checkCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 App Credentials: Checking credentials...');
      
      const companyId = req.user?.companyId;
      
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { appType } = req.params;
      const { appName } = req.query;

      const hasCredentials = await this.appCredentialsService.hasCredentials(
        companyId,
        appType,
        appName as string
      );

      console.log('✅ App Credentials: Successfully checked credentials');
      res.json({
        success: true,
        data: { hasCredentials }
      });
    } catch (error) {
      console.error('❌ App Credentials Check Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/apps/credentials/requirements/:appType
  async getRequirements(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 App Credentials: Getting requirements...');
      
      const { appType } = req.params;

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

      const requirement = requirements[appType];

      if (!requirement) {
        return res.status(404).json({
          success: false,
          message: 'App type not supported'
        });
      }

      console.log('✅ App Credentials: Successfully got requirements');
      res.json({
        success: true,
        data: requirement
      });
    } catch (error) {
      console.error('❌ App Credentials Requirements Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get requirements',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
