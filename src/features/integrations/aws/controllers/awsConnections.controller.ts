import { Request, Response } from 'express';
import { AWSIntegrationService } from '../services/AWSIntegration';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class AWSConnectionsController {
  private awsService: AWSIntegrationService;

  constructor() {
    this.awsService = new AWSIntegrationService();
  }

  // GET /api/integrations/aws/overview
  async getOverview(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Overview: Fetching overview data...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }
      
      const overview = await this.awsService.getOverview(companyId);
      
      console.log('✅ AWS Overview: Successfully fetched data');
      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      console.error('❌ AWS Overview Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS overview',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/accounts
  async getAccounts(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Accounts: Fetching accounts...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }
      
      const accounts = await this.awsService.getAccounts(companyId);
      
      console.log(`✅ AWS Accounts: Found ${accounts.length} accounts`);
      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      console.error('❌ AWS Accounts Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS accounts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/aws/accounts
  async createAccount(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Create Account: Creating new account connection...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }
      
      const { accountId, accountName, accessType, region, credentials } = req.body;
      
      if (!accountId || !accountName || !accessType || !region) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: accountId, accountName, accessType, region'
        });
      }

      // Validate credentials based on access type
      if (accessType === 'access-keys' && (!credentials?.accessKeyId || !credentials?.secretAccessKey)) {
        return res.status(400).json({
          success: false,
          message: 'Access Key ID and Secret Access Key are required for access-keys type'
        });
      }

      const account = await this.awsService.createAccount(companyId, {
        accountId,
        accountName,
        accessType,
        region,
        credentials
      });
      
      console.log(`✅ AWS Create Account: Successfully created account ${accountId}`);
      res.status(201).json({
        success: true,
        data: account
      });
    } catch (error) {
      console.error('❌ AWS Create Account Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create AWS account',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // PUT /api/integrations/aws/accounts/:id
  async updateAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log(`🔍 AWS Update Account: Updating account ${id}...`);
      
      const account = await this.awsService.updateAccount(id, req.body);
      
      console.log(`✅ AWS Update Account: Successfully updated account ${id}`);
      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      console.error('❌ AWS Update Account Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update AWS account',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/integrations/aws/accounts/:id
  async deleteAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log(`🔍 AWS Delete Account: Deleting account ${id}...`);
      
      await this.awsService.deleteAccount(id);
      
      console.log(`✅ AWS Delete Account: Successfully deleted account ${id}`);
      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('❌ AWS Delete Account Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete AWS account',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/aws/accounts/:id/sync
  async syncAccount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log(`🔍 AWS Sync Account: Syncing account ${id}...`);
      
      await this.awsService.syncAccount(id);
      
      console.log(`✅ AWS Sync Account: Successfully synced account ${id}`);
      res.json({
        success: true,
        message: 'Account sync initiated successfully'
      });
    } catch (error) {
      console.error('❌ AWS Sync Account Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync AWS account',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/users
  async getUsers(req: Request, res: Response) {
    try {
      const { accountId } = req.query;
      console.log(`🔍 AWS Users: Fetching users${accountId ? ` for account ${accountId}` : ''}...`);
      
      const users = await this.awsService.getUsers(accountId as string);
      
      console.log(`✅ AWS Users: Found ${users.length} users`);
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('❌ AWS Users Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/billing
  async getBilling(req: Request, res: Response) {
    try {
      const { accountId } = req.query;
      console.log(`🔍 AWS Billing: Fetching billing data${accountId ? ` for account ${accountId}` : ''}...`);
      
      const billing = await this.awsService.getBillingData(accountId as string);
      
      console.log('✅ AWS Billing: Successfully fetched billing data');
      res.json({
        success: true,
        data: billing
      });
    } catch (error) {
      console.error('❌ AWS Billing Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS billing data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/security
  async getSecurity(req: Request, res: Response) {
    try {
      const { accountId } = req.query;
      console.log(`🔍 AWS Security: Fetching security data${accountId ? ` for account ${accountId}` : ''}...`);
      
      const security = await this.awsService.getSecurityData(accountId as string);
      
      console.log('✅ AWS Security: Successfully fetched security data');
      res.json({
        success: true,
        data: security
      });
    } catch (error) {
      console.error('❌ AWS Security Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS security data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/organizations
  async getOrganizations(req: Request, res: Response) {
    try {
      console.log('🔍 AWS Organizations: Fetching organizations...');
      
      const organizations = await this.awsService.getOrganizations();
      
      console.log(`✅ AWS Organizations: Found ${organizations.length} organizations`);
      res.json({
        success: true,
        data: organizations
      });
    } catch (error) {
      console.error('❌ AWS Organizations Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS organizations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
