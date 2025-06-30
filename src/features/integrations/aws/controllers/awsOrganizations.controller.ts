import { Request, Response } from 'express';
import { AWSOrganizationsService } from '../services/awsOrganizationsService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class AWSOrganizationsController {
  private awsOrganizationsService: AWSOrganizationsService;

  constructor() {
    this.awsOrganizationsService = new AWSOrganizationsService();
  }

  // GET /api/integrations/aws/organizations
  async getOrganization(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Organizations: Fetching organization...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const organization = await this.awsOrganizationsService.getOrganizationFromDatabase(companyId);

      console.log('✅ AWS Organizations: Organization data retrieved');
      res.json({
        success: true,
        data: organization
      });
    } catch (error) {
      console.error('❌ AWS Organizations Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS organization',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/organizations/units
  async getOrganizationalUnits(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Organizations: Fetching organizational units...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const units = await this.awsOrganizationsService.getOrganizationalUnitsFromDatabase(companyId);

      console.log(`✅ AWS Organizations: Returning ${units.length} organizational units`);
      res.json({
        success: true,
        data: units
      });
    } catch (error) {
      console.error('❌ AWS Organizations Units Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organizational units',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/organizations/accounts
  async getAccounts(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Organizations: Fetching accounts...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const accounts = await this.awsOrganizationsService.getAccountsFromDatabase(companyId);

      console.log(`✅ AWS Organizations: Returning ${accounts.length} accounts`);
      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      console.error('❌ AWS Organizations Accounts Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organization accounts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/aws/organizations/sync
  async syncOrganizations(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Organizations: Syncing from AWS...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const syncResult = await this.awsOrganizationsService.syncOrganizationsFromAWS(companyId);

      console.log('✅ AWS Organizations: Sync completed');
      res.json({
        success: true,
        message: 'AWS Organizations synced successfully',
        data: {
          organization: syncResult.organization,
          accountsSynced: syncResult.accounts,
          organizationalUnitsSynced: syncResult.organizationalUnits,
          lastSync: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ AWS Organizations Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync AWS Organizations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
