import { Request, Response } from 'express';
import { CredentialsService } from '../services/credentialsService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class CredentialsController {
  private credentialsService: CredentialsService;

  constructor() {
    this.credentialsService = new CredentialsService();
  }

  // POST /api/credentials
  async saveCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Credentials: Saving credentials...');
      console.log('📊 Request body:', { 
        appType: req.body.appType, 
        appName: req.body.appName, 
        credentialKeys: Object.keys(req.body.credentials || {})
      });
      
      const companyId = req.user?.companyId;
      const userId = req.user?.userId;
      
      if (!companyId || !userId) {
        console.error('❌ Credentials: Missing authentication data');
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { appType, appName, credentials } = req.body;

      if (!appType || !appName || !credentials) {
        console.error('❌ Credentials: Missing required fields', { appType, appName, hasCredentials: !!credentials });
        return res.status(400).json({
          success: false,
          message: 'App type, app name, and credentials are required'
        });
      }

      // Log credential details for debugging (without sensitive data)
      console.log('📋 Credentials details:', {
        companyId,
        appType,
        appName,
        credentialFields: Object.keys(credentials),
        credentialValues: Object.entries(credentials).map(([key, value]) => ({
          key,
          hasValue: !!value,
          length: typeof value === 'string' ? value.length : 0
        }))
      });

      // Validate credentials for the app type
      const validation = this.credentialsService.validateCredentials(appType, credentials);
      
      if (!validation.isValid) {
        console.error('❌ Credentials: Validation failed', validation.missingFields);
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials',
          missingFields: validation.missingFields
        });
      }

      console.log('✅ Credentials: Validation passed, saving to database...');

      const result = await this.credentialsService.saveCredentials(
        companyId,
        appType,
        appName,
        credentials,
        userId
      );

      console.log('✅ Credentials: Successfully saved credentials', {
        id: result._id,
        appType: result.appType,
        appName: result.appName,
        isActive: result.isActive,
        credentialCount: Object.keys(result.credentials).length
      });

      // Verify the save by fetching the credentials back
      const verification = await this.credentialsService.getCredentials(companyId, appType, appName);
      console.log('🔍 Credentials: Verification check', {
        found: !!verification,
        id: verification?._id,
        credentialCount: verification ? Object.keys(verification.credentials).length : 0
      });

      res.json({
        success: true,
        data: {
          id: result._id,
          appType: result.appType,
          appName: result.appName,
          isActive: result.isActive,
          createdAt: result.createdAt,
          hasCredentials: Object.keys(result.credentials).length > 0
        },
        message: 'Credentials saved successfully'
      });
    } catch (error) {
      console.error('❌ Credentials Save Error:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({
        success: false,
        message: 'Failed to save credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/credentials
  async getAllCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Credentials: Fetching all credentials...');
      
      const companyId = req.user?.companyId;
      
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const credentials = await this.credentialsService.getAllCredentials(companyId);

      console.log('✅ Credentials: Successfully fetched credentials');
      res.json({
        success: true,
        data: credentials
      });
    } catch (error) {
      console.error('❌ Credentials Get All Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/credentials/:appType
  async getCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Credentials: Fetching credentials for app type...');
      
      const companyId = req.user?.companyId;
      
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { appType } = req.params;
      const { appName } = req.query;

      const credentials = await this.credentialsService.getCredentials(
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
        ...credentials.toObject(),
        credentials: Object.keys(credentials.credentials).reduce((acc: any, key: string) => {
          acc[key] = credentials.credentials[key] ? '***' : null;
          return acc;
        }, {})
      };

      console.log('✅ Credentials: Successfully fetched credentials');
      res.json({
        success: true,
        data: safeCredentials
      });
    } catch (error) {
      console.error('❌ Credentials Get Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/credentials/:appType/:appName
  async deleteCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Credentials: Deleting credentials...');
      
      const companyId = req.user?.companyId;
      
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { appType, appName } = req.params;

      await this.credentialsService.deleteCredentials(companyId, appType, appName);

      console.log('✅ Credentials: Successfully deleted credentials');
      res.json({
        success: true,
        message: 'Credentials deleted successfully'
      });
    } catch (error) {
      console.error('❌ Credentials Delete Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/credentials/:appType/check
  async checkCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Credentials: Checking credentials...');
      
      const companyId = req.user?.companyId;
      
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { appType } = req.params;
      const { appName } = req.query;

      const hasCredentials = await this.credentialsService.hasCredentials(
        companyId,
        appType,
        appName as string
      );

      console.log('✅ Credentials: Successfully checked credentials');
      res.json({
        success: true,
        data: { hasCredentials }
      });
    } catch (error) {
      console.error('❌ Credentials Check Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/credentials/requirements/:appType
  async getRequirements(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Credentials: Getting requirements...');
      
      const { appType } = req.params;
      const requirement = this.credentialsService.getCredentialRequirements(appType);

      if (!requirement) {
        return res.status(404).json({
          success: false,
          message: 'App type not supported'
        });
      }

      console.log('✅ Credentials: Successfully got requirements');
      res.json({
        success: true,
        data: requirement
      });
    } catch (error) {
      console.error('❌ Credentials Requirements Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get requirements',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/credentials/:appType/test
  async testCredentials(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Credentials: Testing credentials...');
      
      const companyId = req.user?.companyId;
      
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { appType } = req.params;
      const { appName } = req.body; // Get appName from body instead of query

      const result = await this.credentialsService.testCredentials(
        companyId,
        appType,
        appName as string
      );

      console.log('✅ Credentials: Test result:', result);
      
      // Return the result directly, not wrapped in data
      res.json(result);
    } catch (error) {
      console.error('❌ Credentials Test Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
