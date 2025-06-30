import { AWSAccount } from '../../../../database/models';
import mongoose from 'mongoose';
import { encrypt } from '../../../../utils/encryption';

// Lazy load AWS SDK v3 clients only when needed
let IAMClient: any;
let STSClient: any;

const getIAMClient = async () => {
  if (!IAMClient) {
    const { IAMClient: Client } = await import('@aws-sdk/client-iam');
    IAMClient = Client;
  }
  return IAMClient;
};

const getSTSClient = async () => {
  if (!STSClient) {
    const { STSClient: Client } = await import('@aws-sdk/client-sts');
    STSClient = Client;
  }
  return STSClient;
};

export interface AWSOverviewData {
  totalAccounts: number;
  totalUsers: number;
  totalResources: number;
  monthlyCost: number;
  lastSync: string;
  securityScore: number;
  totalGroups?: number;
  hasOrganizations?: boolean;
  hasBillingData?: boolean;
}

export interface AWSAccountData {
  id: string;
  accountId: string;
  accountName: string;
  alias?: string;
  region: string;
  status: 'connected' | 'error' | 'syncing';
  lastSync: string;
  users: number;
  resources: {
    ec2: number;
    s3: number;
    iam: number;
    lambda: number;
  };
  monthlyCost: number;
  accessType: 'cross-account-role' | 'access-keys' | 'sso';
  organizationUnit?: string;
}

export interface AWSUser {
  id: string;
  username: string;
  email?: string;
  accountId: string;
  groups: string[];
  policies: string[];
  lastActivity: string;
  status: 'active' | 'inactive';
  mfaEnabled: boolean;
}

export interface AWSBillingData {
  totalCost: number;
  previousMonthCost: number;
  costByService: Array<{
    service: string;
    cost: number;
    percentage: number;
  }>;
  costByAccount: Array<{
    accountId: string;
    accountName: string;
    cost: number;
  }>;
  recommendations: Array<{
    id: string;
    type: 'cost-optimization' | 'rightsizing' | 'reserved-instances';
    description: string;
    potentialSavings: number;
  }>;
}

export interface AWSSecurityData {
  securityScore: number;
  alerts: Array<{
    id: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    accountId: string;
    timestamp: string;
  }>;
  complianceStatus: {
    cis: number;
    pci: number;
    soc2: number;
  };
}

export class AWSIntegrationService {
  constructor() {
    // Real implementation - no mock data
  }

  async getOverview(companyId: string): Promise<AWSOverviewData> {
    try {
      console.log('🔍 AWS Service: Calculating overview data from database...');
      
      // Get stats from database
      const stats = await AWSAccount.getCompanyStats(companyId);
      
      if (stats.length === 0) {
        return {
          totalAccounts: 0,
          totalUsers: 0,
          totalResources: 0,
          monthlyCost: 0,
          lastSync: 'Not connected',
          securityScore: 0,
          totalGroups: 0,
          hasOrganizations: false,
          hasBillingData: false
        };
      }
      
      const data = stats[0];
      
      // Check for additional data availability
      const { AWSGroup, AWSOrganization, AWSBilling } = await import('../../../../database/models');
      
      const groupCount = await AWSGroup.countDocuments({ 
        companyId: new mongoose.Types.ObjectId(companyId), 
        isActive: true 
      });
      
      const hasOrgs = await AWSOrganization.exists({ 
        companyId: new mongoose.Types.ObjectId(companyId) 
      });
      
      const hasBilling = await AWSBilling.exists({ 
        companyId: new mongoose.Types.ObjectId(companyId) 
      });
      
      return {
        totalAccounts: data.totalAccounts || 0,
        totalUsers: data.totalUsers || 0,
        totalResources: data.totalResources || 0,
        monthlyCost: data.totalCost || 0,
        lastSync: data.totalAccounts > 0 ? 'Recently synced' : 'Not connected',
        securityScore: Math.round(data.avgSecurityScore || 0),
        totalGroups: groupCount || 0,
        hasOrganizations: !!hasOrgs,
        hasBillingData: !!hasBilling || data.totalCost > 0
      };
    } catch (error) {
      console.error('❌ AWS Service: Error calculating overview:', error);
      throw new Error('Failed to fetch AWS overview data.');
    }
  }

  async getAccounts(companyId: string): Promise<AWSAccountData[]> {
    try {
      console.log('🔍 AWS Service: Fetching accounts from database...');
      
      const accounts = await AWSAccount.findByCompany(companyId);
      
      return accounts.map((account: any) => ({
        id: account._id.toString(),
        accountId: account.accountId,
        accountName: account.accountName,
        alias: account.alias,
        region: account.region,
        status: account.status as 'connected' | 'error' | 'syncing',
        lastSync: account.lastSyncFormatted,
        users: account.users,
        resources: account.resources,
        monthlyCost: account.monthlyCost,
        accessType: account.accessType as 'cross-account-role' | 'access-keys' | 'sso',
        organizationUnit: account.organizationUnit
      }));
    } catch (error) {
      console.error('❌ AWS Service: Error fetching accounts:', error);
      throw new Error('Failed to fetch AWS accounts from database.');
    }
  }

  async createAccount(companyId: string, accountData: {
    accountId: string;
    accountName: string;
    accessType: string;
    region: string;
    credentials?: any;
  }): Promise<AWSAccountData> {
    try {
      console.log('🔍 AWS Service: Creating new account in database...');
      
      // Encrypt sensitive credentials before storing
      let encryptedCredentials = {};
      if (accountData.credentials) {
        if (accountData.credentials.secretAccessKey) {
          encryptedCredentials = {
            ...accountData.credentials,
            secretAccessKey: encrypt(accountData.credentials.secretAccessKey)
          };
          if (accountData.credentials.sessionToken) {
            encryptedCredentials = {
              ...encryptedCredentials,
              sessionToken: encrypt(accountData.credentials.sessionToken)
            };
          }
        } else {
          encryptedCredentials = accountData.credentials;
        }
      }
      
      const newAccount = new AWSAccount({
        companyId: new mongoose.Types.ObjectId(companyId),
        accountId: accountData.accountId,
        accountName: accountData.accountName,
        region: accountData.region,
        accessType: accountData.accessType,
        credentials: encryptedCredentials,
        status: 'connected',
        lastSync: new Date(),
        users: 0,
        resources: { ec2: 0, s3: 0, iam: 0, lambda: 0 },
        monthlyCost: 0,
        securityScore: 85
      });

      const savedAccount = await newAccount.save();
      
      return {
        id: (savedAccount._id as any).toString(),
        accountId: savedAccount.accountId,
        accountName: savedAccount.accountName,
        alias: savedAccount.alias,
        region: savedAccount.region,
        status: savedAccount.status as 'connected' | 'error' | 'syncing',
        lastSync: (savedAccount as any).lastSyncFormatted,
        users: savedAccount.users,
        resources: savedAccount.resources,
        monthlyCost: savedAccount.monthlyCost,
        accessType: savedAccount.accessType as 'cross-account-role' | 'access-keys' | 'sso',
        organizationUnit: savedAccount.organizationUnit
      };
    } catch (error) {
      console.error('❌ AWS Service: Error creating account:', error);
      throw new Error('Failed to create AWS account in database.');
    }
  }

  async updateAccount(accountId: string, updateData: Partial<AWSAccountData>): Promise<AWSAccountData> {
    try {
      console.log(`🔍 AWS Service: Updating account ${accountId} in database...`);
      
      const updatedAccount = await AWSAccount.findByIdAndUpdate(
        accountId,
        updateData,
        { new: true }
      );

      if (!updatedAccount) {
        throw new Error('Account not found');
      }
      
      return {
        id: (updatedAccount._id as any).toString(),
        accountId: updatedAccount.accountId,
        accountName: updatedAccount.accountName,
        alias: updatedAccount.alias,
        region: updatedAccount.region,
        status: updatedAccount.status as 'connected' | 'error' | 'syncing',
        lastSync: (updatedAccount as any).lastSyncFormatted,
        users: updatedAccount.users,
        resources: updatedAccount.resources,
        monthlyCost: updatedAccount.monthlyCost,
        accessType: updatedAccount.accessType as 'cross-account-role' | 'access-keys' | 'sso',
        organizationUnit: updatedAccount.organizationUnit
      };
    } catch (error) {
      console.error('❌ AWS Service: Error updating account:', error);
      throw new Error('Failed to update AWS account in database.');
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    try {
      console.log(`🔍 AWS Service: Deleting account ${accountId} from database...`);
      
      const result = await AWSAccount.findByIdAndUpdate(
        accountId,
        { isActive: false },
        { new: true }
      );

      if (!result) {
        throw new Error('Account not found');
      }
    } catch (error) {
      console.error('❌ AWS Service: Error deleting account:', error);
      throw new Error('Failed to delete AWS account from database.');
    }
  }

  async syncAccount(accountId: string): Promise<void> {
    try {
      console.log(`🔍 AWS Service: Syncing account ${accountId}...`);
      
      // Update sync status
      await AWSAccount.findByIdAndUpdate(
        accountId,
        { 
          status: 'syncing',
          lastSync: new Date(),
          syncStatus: 'In progress'
        }
      );

      // TODO: Implement real AWS API sync
      // For now, just update status back to connected
      setTimeout(async () => {
        await AWSAccount.findByIdAndUpdate(
          accountId,
          { 
            status: 'connected',
            syncStatus: 'Completed'
          }
        );
      }, 2000);
      
    } catch (error) {
      console.error('❌ AWS Service: Error syncing account:', error);
      throw new Error('Failed to sync AWS account.');
    }
  }

  async getUsers(accountId?: string): Promise<AWSUser[]> {
    try {
      console.log(`🔍 AWS Service: Fetching users${accountId ? ` for account ${accountId}` : ''}...`);
      
      // TODO: Implement real AWS IAM API integration
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('❌ AWS Service: Error fetching users:', error);
      throw new Error('Failed to fetch AWS users.');
    }
  }

  async getBillingData(accountId?: string): Promise<AWSBillingData> {
    try {
      console.log(`🔍 AWS Service: Fetching billing data${accountId ? ` for account ${accountId}` : ''}...`);
      
      // TODO: Implement real AWS Cost Explorer API integration
      // For now, return empty data
      return {
        totalCost: 0,
        previousMonthCost: 0,
        costByService: [],
        costByAccount: [],
        recommendations: []
      };
    } catch (error) {
      console.error('❌ AWS Service: Error fetching billing data:', error);
      throw new Error('Failed to fetch AWS billing data.');
    }
  }

  async getSecurityData(accountId?: string): Promise<AWSSecurityData> {
    try {
      console.log(`🔍 AWS Service: Fetching security data${accountId ? ` for account ${accountId}` : ''}...`);
      
      // TODO: Implement real AWS Security Hub API integration
      // For now, return empty data
      return {
        securityScore: 0,
        alerts: [],
        complianceStatus: {
          cis: 0,
          pci: 0,
          soc2: 0
        }
      };
    } catch (error) {
      console.error('❌ AWS Service: Error fetching security data:', error);
      throw new Error('Failed to fetch AWS security data.');
    }
  }

  async getOrganizations(): Promise<any[]> {
    try {
      console.log('🔍 AWS Service: Fetching organizations...');
      
      // TODO: Implement real AWS Organizations API integration
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('❌ AWS Service: Error fetching organizations:', error);
      throw new Error('Failed to fetch AWS organizations.');
    }
  }
}
