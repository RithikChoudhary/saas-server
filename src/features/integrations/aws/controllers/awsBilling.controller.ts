import { Request, Response } from 'express';
import { AWSBillingService } from '../services/awsBillingService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class AWSBillingController {
  private billingService: AWSBillingService;

  constructor() {
    this.billingService = new AWSBillingService();
  }

  // GET /api/integrations/aws/billing/summary - Frontend expects this endpoint
  async getBillingSummary(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Billing: Fetching billing summary...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { period = '30d' } = req.query;
      
      // Get billing data from database
      const billingData = await this.billingService.getBillingFromDatabase(companyId, {
        period: period as string
      });

      // Get all AWS accounts for budget calculation
      const { AWSAccount } = await import('../../../../database/models');
      const accounts = await AWSAccount.find({
        companyId,
        isActive: true
      });

      // Calculate budget (example: $1000 per account)
      const budgetLimit = accounts.length * 1000;
      const budgetUsagePercentage = budgetLimit > 0 ? (billingData.totalCost / budgetLimit) * 100 : 0;

      // Calculate month over month change
      const monthOverMonthChange = billingData.previousMonthCost > 0 
        ? ((billingData.totalCost - billingData.previousMonthCost) / billingData.previousMonthCost) * 100
        : 0;

      // Format response for frontend
      const summary = {
        currentMonthCost: billingData.totalCost,
        lastMonthCost: billingData.previousMonthCost,
        monthOverMonthChange,
        forecastedCost: billingData.totalCost * 1.1, // Simple 10% forecast
        budgetLimit,
        budgetUsagePercentage,
        topServices: billingData.costByService.slice(0, 5).map((service: any) => ({
          ...service,
          trend: 'stable' // TODO: Calculate actual trend
        })),
        costByAccount: billingData.costByAccount.map((account: any) => ({
          ...account,
          percentage: billingData.totalCost > 0 ? (account.cost / billingData.totalCost) * 100 : 0
        }))
      };
      
      console.log('✅ AWS Billing: Successfully fetched billing summary');
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('❌ AWS Billing Summary Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS billing summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/billing
  async getBilling(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Billing: Fetching billing data...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { accountId, period } = req.query;
      
      const billingData = await this.billingService.getBillingFromDatabase(
        companyId,
        {
          accountId: accountId as string,
          period: period as string
        }
      );
      
      console.log('✅ AWS Billing: Successfully fetched billing data');
      res.json({
        success: true,
        data: billingData
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

  // GET /api/integrations/aws/billing/trends
  async getBillingTrends(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Billing: Fetching billing trends...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { period = '30d' } = req.query;
      
      const trends = await this.billingService.getBillingTrends(
        companyId,
        period as string
      );
      
      console.log('✅ AWS Billing: Successfully fetched billing trends');
      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      console.error('❌ AWS Billing Trends Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch billing trends',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/aws/billing/sync
  async syncBilling(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Billing: Starting billing sync...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }
      
      // Start sync in background
      this.billingService.syncBillingFromAWS(companyId)
        .then(result => {
          console.log('✅ AWS Billing sync completed:', result);
        })
        .catch(error => {
          console.error('❌ AWS Billing sync failed:', error);
        });
      
      res.json({
        success: true,
        message: 'Billing sync initiated. This may take a few minutes.'
      });
    } catch (error) {
      console.error('❌ AWS Billing Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate billing sync',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
