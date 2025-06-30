import { 
  OrganizationsClient, 
  DescribeOrganizationCommand,
  ListAccountsCommand,
  ListOrganizationalUnitsForParentCommand,
  ListRootsCommand,
  Account as AWSAccountType
} from '@aws-sdk/client-organizations';
import { AWSAccount, AWSOrganization, AWSOrganizationalUnit } from '../../../../database/models';
import mongoose from 'mongoose';
import { decrypt } from '../../../../utils/encryption';

export class AWSOrganizationsService {
  private async getOrganizationsClient(accountId: string, companyId: string): Promise<OrganizationsClient> {
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

    return new OrganizationsClient({
      region: account.region || 'us-east-1', // Organizations API is global, but we need a region
      credentials: {
        accessKeyId: account.credentials.accessKeyId!,
        secretAccessKey: secretAccessKey as string,
        ...(sessionToken && { sessionToken: sessionToken as string })
      }
    });
  }

  async syncOrganizationsFromAWS(companyId: string): Promise<{ 
    organization: any; 
    accounts: number; 
    organizationalUnits: number 
  }> {
    console.log('🔄 Starting AWS Organizations sync for company:', companyId);
    
    // Get the master account (first connected account)
    const masterAccount = await AWSAccount.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      status: 'connected',
      isActive: true
    }).sort({ createdAt: 1 });

    if (!masterAccount) {
      throw new Error('No connected AWS accounts found');
    }

    try {
      const client = await this.getOrganizationsClient(masterAccount.accountId, companyId);
      
      // Get organization details
      const orgCommand = new DescribeOrganizationCommand({});
      const orgResponse = await client.send(orgCommand);
      
      if (!orgResponse.Organization) {
        throw new Error('No organization found for this account');
      }

      // Save organization to database
      const organization = await AWSOrganization.findOneAndUpdate(
        {
          organizationId: orgResponse.Organization.Id,
          companyId: new mongoose.Types.ObjectId(companyId)
        },
        {
          organizationId: orgResponse.Organization.Id!,
          masterAccountId: orgResponse.Organization.MasterAccountId!,
          masterAccountEmail: orgResponse.Organization.MasterAccountEmail!,
          featureSet: orgResponse.Organization.FeatureSet as 'ALL' | 'CONSOLIDATED_BILLING',
          companyId: new mongoose.Types.ObjectId(companyId),
          lastSync: new Date(),
          isActive: true
        },
        { upsert: true, new: true }
      );

      // Sync accounts
      const accountsCount = await this.syncAccounts(client, orgResponse.Organization.Id!, companyId);
      
      // Sync organizational units
      const ouCount = await this.syncOrganizationalUnits(client, orgResponse.Organization.Id!, companyId);

      return {
        organization: {
          id: organization._id,
          organizationId: organization.organizationId,
          masterAccountId: organization.masterAccountId
        },
        accounts: accountsCount,
        organizationalUnits: ouCount
      };
    } catch (error) {
      console.error('❌ Error syncing AWS Organizations:', error);
      throw error;
    }
  }

  private async syncAccounts(client: OrganizationsClient, organizationId: string, companyId: string): Promise<number> {
    try {
      const listAccountsCommand = new ListAccountsCommand({});
      const accountsResponse = await client.send(listAccountsCommand);
      
      if (!accountsResponse.Accounts) {
        return 0;
      }

      let syncedCount = 0;
      
      for (const account of accountsResponse.Accounts) {
        // Update existing AWS Account with organization info
        await AWSAccount.findOneAndUpdate(
          {
            accountId: account.Id,
            companyId: new mongoose.Types.ObjectId(companyId)
          },
          {
            $set: {
              organizationId,
              joinedMethod: account.JoinedMethod,
              joinedTimestamp: account.JoinedTimestamp,
              accountStatus: account.Status
            }
          }
        );
        
        syncedCount++;
      }

      return syncedCount;
    } catch (error) {
      console.error('Error syncing accounts:', error);
      return 0;
    }
  }

  private async syncOrganizationalUnits(
    client: OrganizationsClient, 
    organizationId: string, 
    companyId: string
  ): Promise<number> {
    try {
      // Get root first
      const rootsCommand = new ListRootsCommand({});
      const rootsResponse = await client.send(rootsCommand);
      
      if (!rootsResponse.Roots || rootsResponse.Roots.length === 0) {
        return 0;
      }

      let totalOUs = 0;
      
      // For each root, get OUs recursively
      for (const root of rootsResponse.Roots) {
        totalOUs += await this.syncOUsRecursively(
          client, 
          root.Id!, 
          root.Name || 'Root',
          undefined,
          organizationId, 
          companyId
        );
      }

      return totalOUs;
    } catch (error) {
      console.error('Error syncing organizational units:', error);
      return 0;
    }
  }

  private async syncOUsRecursively(
    client: OrganizationsClient,
    parentId: string,
    parentName: string,
    parentOuId: string | undefined,
    organizationId: string,
    companyId: string
  ): Promise<number> {
    try {
      const command = new ListOrganizationalUnitsForParentCommand({ ParentId: parentId });
      const response = await client.send(command);
      
      if (!response.OrganizationalUnits) {
        return 0;
      }

      let count = 0;
      
      for (const ou of response.OrganizationalUnits) {
        // Save OU to database
        await AWSOrganizationalUnit.findOneAndUpdate(
          {
            ouId: ou.Id,
            companyId: new mongoose.Types.ObjectId(companyId)
          },
          {
            ouId: ou.Id!,
            name: ou.Name!,
            arn: ou.Arn!,
            parentId: parentOuId,
            organizationId,
            companyId: new mongoose.Types.ObjectId(companyId),
            lastSync: new Date(),
            isActive: true
          },
          { upsert: true, new: true }
        );
        
        count++;
        
        // Recursively sync child OUs
        count += await this.syncOUsRecursively(
          client,
          ou.Id!,
          ou.Name!,
          ou.Id!,
          organizationId,
          companyId
        );
      }

      return count;
    } catch (error) {
      console.error('Error syncing OUs recursively:', error);
      return 0;
    }
  }

  async getOrganizationFromDatabase(companyId: string): Promise<any> {
    const organization = await AWSOrganization.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    });

    if (!organization) {
      return null;
    }

    return {
      id: organization._id,
      organizationId: organization.organizationId,
      masterAccountId: organization.masterAccountId,
      masterAccountEmail: organization.masterAccountEmail,
      featureSet: organization.featureSet,
      lastSync: organization.lastSync
    };
  }

  async getOrganizationalUnitsFromDatabase(companyId: string): Promise<any[]> {
    const ous = await AWSOrganizationalUnit.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    }).sort({ name: 1 });

    return ous.map(ou => ({
      id: ou._id,
      ouId: ou.ouId,
      name: ou.name,
      arn: ou.arn,
      parentId: ou.parentId,
      accountCount: ou.accountCount
    }));
  }

  async getAccountsFromDatabase(companyId: string): Promise<any[]> {
    const accounts = await AWSAccount.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    }).sort({ accountName: 1 });

    return accounts.map(account => ({
      id: account._id,
      accountId: account.accountId,
      name: account.accountName,
      email: account.email || '',
      status: account.accountStatus || 'ACTIVE',
      joinedMethod: account.joinedMethod || 'CREATED',
      joinedTimestamp: account.joinedTimestamp || account.createdAt,
      organizationalUnitId: account.organizationalUnitId || ''
    }));
  }
}
