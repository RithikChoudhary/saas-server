import { 
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
  GetDimensionValuesCommand,
  Dimension
} from '@aws-sdk/client-cost-explorer';
import { AWSAccount, AWSBilling } from '../../../../database/models';
import mongoose from 'mongoose';
import { decrypt } from '../../../../utils/encryption';

export class AWSBillingService {
  private async getCostExplorerClient(accountId: string, companyId: string): Promise<CostExplorerClient> {
    const account = await AWSAccount.findOne({
      accountId,
      companyId: new mongoose.Types.ObjectId(companyId),
      status: 'connected',
      isActive: true
    });

    if (!account) {
      throw new Error(`AWS account ${accountId} not found or not connected`);
    }

    // Decrypt credentials if they are encrypted
    let secretAccessKey = account.credentials.secretAccessKey;
    let sessionToken = account.credentials.sessionToken;
    
    if (typeof secretAccessKey === 'object' && secretAccessKey !== null && 'encrypted' in secretAccessKey) {
      secretAccessKey = decrypt(secretAccessKey as any);
    }
    
    if (typeof sessionToken === 'object' && sessionToken !== null && 'encrypted' in sessionToken) {
      sessionToken = decrypt(sessionToken as any);
    }

    const credentials = {
      accessKeyId: account.credentials.accessKeyId!,
      secretAccessKey: secretAccessKey as string,
      ...(sessionToken && { sessionToken: sessionToken as string })
    };

    // Cost Explorer is only available in us-east-1
    return new CostExplorerClient({ 
      region: 'us-east-1', 
      credentials 
    });
  }

  async syncBillingFromAWS(companyId: string): Promise<any> {
    try {
      console.log('🔍 AWS Billing: Starting sync from AWS...');
      
      // Get all connected AWS accounts for this company
      const accounts = await AWSAccount.find({
        companyId: new mongoose.Types.ObjectId(companyId),
        status: 'connected',
        isActive: true
      });

      let totalCost = 0;
      let syncedAccounts = 0;

      for (const account of accounts) {
        console.log(`🔄 Syncing billing for account ${account.accountId}...`);
        
        try {
          const client = await this.getCostExplorerClient(account.accountId, companyId);
          
          // Get current month costs
          const currentMonthCost = await this.getCurrentMonthCost(client, account.accountId, companyId);
          
          // Get last 30 days costs by service
          const costByService = await this.getCostByService(client, account.accountId, companyId);
          
          // Get daily costs for trend
          const dailyCosts = await this.getDailyCosts(client, account.accountId, companyId);
          
          totalCost += currentMonthCost;
          syncedAccounts++;

          // Update account monthly cost
          await AWSAccount.findByIdAndUpdate(account._id, {
            monthlyCost: currentMonthCost,
            lastSync: new Date()
          });

        } catch (error) {
          console.error(`❌ Error syncing billing for account ${account.accountId}:`, error);
        }
      }

      console.log(`✅ AWS Billing sync completed: ${syncedAccounts} accounts, total cost: $${totalCost}`);
      return { syncedAccounts, totalCost };
    } catch (error) {
      console.error('❌ AWS Billing sync error:', error);
      throw error;
    }
  }

  private async getCurrentMonthCost(client: CostExplorerClient, accountId: string, companyId: string): Promise<number> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const command = new GetCostAndUsageCommand({
        TimePeriod: {
          Start: startOfMonth.toISOString().split('T')[0],
          End: endOfMonth.toISOString().split('T')[0]
        },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost']
      });

      const response = await client.send(command);
      const totalCost = response.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount || '0';
      
      // Store in database
      await AWSBilling.findOneAndUpdate(
        {
          accountId,
          companyId: new mongoose.Types.ObjectId(companyId),
          billingPeriod: startOfMonth
        },
        {
          totalCost: parseFloat(totalCost),
          currency: response.ResultsByTime?.[0]?.Total?.UnblendedCost?.Unit || 'USD',
          lastSync: new Date(),
          isActive: true
        },
        { upsert: true, new: true }
      );

      return parseFloat(totalCost);
    } catch (error) {
      console.error('Error getting current month cost:', error);
      return 0;
    }
  }

  private async getCostByService(client: CostExplorerClient, accountId: string, companyId: string): Promise<any[]> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const command = new GetCostAndUsageCommand({
        TimePeriod: {
          Start: thirtyDaysAgo.toISOString().split('T')[0],
          End: now.toISOString().split('T')[0]
        },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{
          Type: 'DIMENSION',
          Key: 'SERVICE'
        }]
      });

      const response = await client.send(command);
      const services: any[] = [];

      if (response.ResultsByTime?.[0]?.Groups) {
        for (const group of response.ResultsByTime[0].Groups) {
          const serviceName = group.Keys?.[0] || 'Unknown';
          const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
          
          if (cost > 0) {
            services.push({
              service: serviceName,
              cost,
              percentage: 0 // Will be calculated later
            });

            // Store service cost in database
            await AWSBilling.findOneAndUpdate(
              {
                accountId,
                companyId: new mongoose.Types.ObjectId(companyId),
                service: serviceName,
                billingPeriod: thirtyDaysAgo
              },
              {
                totalCost: cost,
                currency: group.Metrics?.UnblendedCost?.Unit || 'USD',
                costBreakdown: {
                  service: serviceName,
                  amount: cost
                },
                lastSync: new Date(),
                isActive: true
              },
              { upsert: true, new: true }
            );
          }
        }
      }

      // Calculate percentages
      const totalCost = services.reduce((sum, s) => sum + s.cost, 0);
      services.forEach(s => {
        s.percentage = totalCost > 0 ? (s.cost / totalCost) * 100 : 0;
      });

      return services.sort((a, b) => b.cost - a.cost);
    } catch (error) {
      console.error('Error getting cost by service:', error);
      return [];
    }
  }

  private async getDailyCosts(client: CostExplorerClient, accountId: string, companyId: string): Promise<any[]> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const command = new GetCostAndUsageCommand({
        TimePeriod: {
          Start: thirtyDaysAgo.toISOString().split('T')[0],
          End: now.toISOString().split('T')[0]
        },
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost']
      });

      const response = await client.send(command);
      const dailyCosts: any[] = [];

      if (response.ResultsByTime) {
        for (const day of response.ResultsByTime) {
          const date = day.TimePeriod?.Start || '';
          const cost = parseFloat(day.Total?.UnblendedCost?.Amount || '0');
          
          dailyCosts.push({ date, cost });
        }
      }

      return dailyCosts;
    } catch (error) {
      console.error('Error getting daily costs:', error);
      return [];
    }
  }

  async getBillingFromDatabase(companyId: string, filters?: {
    accountId?: string;
    period?: string;
  }): Promise<any> {
    const query: any = {
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    };

    if (filters?.accountId) query.accountId = filters.accountId;

    // Get current month billing
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const currentMonthBilling = await AWSBilling.find({
      ...query,
      billingPeriod: { $gte: startOfMonth }
    }).sort({ totalCost: -1 });

    // Get previous month billing
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const previousMonthBilling = await AWSBilling.find({
      ...query,
      billingPeriod: { $gte: startOfPrevMonth, $lte: endOfPrevMonth }
    });

    const totalCost = currentMonthBilling.reduce((sum, b) => sum + (b.totalCost || 0), 0);
    const previousMonthCost = previousMonthBilling.reduce((sum, b) => sum + (b.totalCost || 0), 0);

    // Group costs by service
    const costByService = currentMonthBilling
      .filter((b: any) => b.service)
      .map((b: any) => ({
        service: b.service,
        cost: b.totalCost || 0,
        percentage: totalCost > 0 ? ((b.totalCost || 0) / totalCost) * 100 : 0
      }))
      .sort((a, b) => b.cost - a.cost);

    // Group costs by account
    const costByAccount: any[] = [];
    const accountCosts = new Map<string, number>();
    
    currentMonthBilling.forEach((b: any) => {
      const current = accountCosts.get(b.accountId) || 0;
      accountCosts.set(b.accountId, current + (b.totalCost || 0));
    });

    for (const [accountId, cost] of accountCosts) {
      const account = await AWSAccount.findOne({ accountId });
      costByAccount.push({
        accountId,
        accountName: account?.accountName || accountId,
        cost
      });
    }

    return {
      totalCost,
      previousMonthCost,
      costByService,
      costByAccount: costByAccount.sort((a, b) => b.cost - a.cost),
      recommendations: [] // TODO: Implement cost optimization recommendations
    };
  }

  async getBillingTrends(companyId: string, period: string = '30d'): Promise<any> {
    const days = parseInt(period) || 30;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const billingData = await AWSBilling.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      billingPeriod: { $gte: startDate, $lte: endDate },
      isActive: true
    }).sort({ billingPeriod: 1 });

    // Group by date
    const trendData = new Map<string, number>();
    
    billingData.forEach((b: any) => {
      // Ensure billingPeriod is a Date object
      const billingDate = b.billingPeriod instanceof Date ? b.billingPeriod : new Date(b.billingPeriod);
      const dateKey = billingDate.toISOString().split('T')[0];
      const current = trendData.get(dateKey) || 0;
      trendData.set(dateKey, current + (b.totalCost || 0));
    });

    // Convert to array format
    const trends = Array.from(trendData.entries()).map(([date, cost]) => ({
      date,
      cost
    }));

    // Calculate average daily cost
    const totalCost = trends.reduce((sum, t) => sum + t.cost, 0);
    const avgDailyCost = trends.length > 0 ? totalCost / trends.length : 0;

    return {
      trends,
      avgDailyCost,
      totalCost,
      period: `${days}d`
    };
  }
}
