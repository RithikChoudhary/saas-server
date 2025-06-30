import { 
  EC2Client, 
  DescribeInstancesCommand,
  DescribeVolumesCommand,
  DescribeSecurityGroupsCommand
} from '@aws-sdk/client-ec2';
import { 
  S3Client, 
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetBucketVersioningCommand
} from '@aws-sdk/client-s3';
import { 
  LambdaClient, 
  ListFunctionsCommand,
  GetFunctionCommand
} from '@aws-sdk/client-lambda';
import { 
  RDSClient, 
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand
} from '@aws-sdk/client-rds';
import { AWSAccount, AWSResource } from '../../../../database/models';
import mongoose from 'mongoose';
import { decrypt } from '../../../../utils/encryption';

export class AWSResourcesService {
  private async getClients(accountId: string, companyId: string) {
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

    return {
      ec2Client: new EC2Client({ region: account.region, credentials }),
      s3Client: new S3Client({ region: account.region, credentials }),
      lambdaClient: new LambdaClient({ region: account.region, credentials }),
      rdsClient: new RDSClient({ region: account.region, credentials })
    };
  }

  async syncResourcesFromAWS(companyId: string): Promise<any> {
    try {
      console.log('🔍 AWS Resources: Starting sync from AWS...');
      
      // Get all connected AWS accounts for this company
      const accounts = await AWSAccount.find({
        companyId: new mongoose.Types.ObjectId(companyId),
        status: 'connected',
        isActive: true
      });

      let totalResources = {
        ec2: 0,
        s3: 0,
        lambda: 0,
        rds: 0
      };

      for (const account of accounts) {
        console.log(`🔄 Syncing resources for account ${account.accountId}...`);
        
        try {
          const { ec2Client, s3Client, lambdaClient, rdsClient } = await this.getClients(
            account.accountId,
            companyId
          );

          // Sync EC2 instances
          const ec2Count = await this.syncEC2Resources(ec2Client, account.accountId, companyId);
          totalResources.ec2 += ec2Count;

          // Sync S3 buckets
          const s3Count = await this.syncS3Resources(s3Client, account.accountId, companyId);
          totalResources.s3 += s3Count;

          // Sync Lambda functions
          const lambdaCount = await this.syncLambdaResources(lambdaClient, account.accountId, companyId);
          totalResources.lambda += lambdaCount;

          // Sync RDS instances
          const rdsCount = await this.syncRDSResources(rdsClient, account.accountId, companyId);
          totalResources.rds += rdsCount;

          // Update account resource counts
          await AWSAccount.findByIdAndUpdate(account._id, {
            resources: {
              ec2: ec2Count,
              s3: s3Count,
              lambda: lambdaCount,
              iam: account.resources.iam // Keep existing IAM count
            },
            lastSync: new Date()
          });

        } catch (error) {
          console.error(`❌ Error syncing account ${account.accountId}:`, error);
        }
      }

      console.log('✅ AWS Resources sync completed:', totalResources);
      return totalResources;
    } catch (error) {
      console.error('❌ AWS Resources sync error:', error);
      throw error;
    }
  }

  private async syncEC2Resources(ec2Client: EC2Client, accountId: string, companyId: string): Promise<number> {
    try {
      // Mark existing EC2 resources as inactive
      await AWSResource.updateMany(
        { accountId, resourceType: 'EC2', companyId: new mongoose.Types.ObjectId(companyId) },
        { isActive: false }
      );

      const instancesResponse = await ec2Client.send(new DescribeInstancesCommand({}));
      let count = 0;

      for (const reservation of instancesResponse.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          if (instance.State?.Name !== 'terminated') {
            await AWSResource.findOneAndUpdate(
              {
                resourceId: instance.InstanceId,
                accountId,
                companyId: new mongoose.Types.ObjectId(companyId)
              },
              {
                resourceType: 'EC2',
                resourceName: instance.Tags?.find((t: any) => t.Key === 'Name')?.Value || `Unnamed Instance`,
                region: instance.Placement?.AvailabilityZone?.slice(0, -1) || 'unknown',
                status: instance.State?.Name || 'unknown',
                metadata: {
                  instanceType: instance.InstanceType,
                  platform: instance.Platform || 'linux',
                  vpcId: instance.VpcId,
                  subnetId: instance.SubnetId,
                  publicIp: instance.PublicIpAddress,
                  privateIp: instance.PrivateIpAddress,
                  launchTime: instance.LaunchTime
                },
                tags: instance.Tags?.reduce((acc: Record<string, string>, tag: any) => {
                  if (tag.Key && tag.Value) acc[tag.Key] = tag.Value;
                  return acc;
                }, {} as Record<string, string>),
                cost: 0, // Will be updated by billing sync
                lastSync: new Date(),
                isActive: true
              },
              { upsert: true, new: true }
            );
            count++;
          }
        }
      }

      return count;
    } catch (error) {
      console.error('Error syncing EC2 resources:', error);
      return 0;
    }
  }

  private async syncS3Resources(s3Client: S3Client, accountId: string, companyId: string): Promise<number> {
    try {
      // Mark existing S3 resources as inactive
      await AWSResource.updateMany(
        { accountId, resourceType: 'S3', companyId: new mongoose.Types.ObjectId(companyId) },
        { isActive: false }
      );

      const bucketsResponse = await s3Client.send(new ListBucketsCommand({}));
      let count = 0;

      for (const bucket of bucketsResponse.Buckets || []) {
        if (bucket.Name) {
          let region = 'us-east-1';
          let versioning = 'Disabled';
          
          try {
            const locationResponse = await s3Client.send(new GetBucketLocationCommand({ Bucket: bucket.Name }));
            region = locationResponse.LocationConstraint || 'us-east-1';
            
            const versioningResponse = await s3Client.send(new GetBucketVersioningCommand({ Bucket: bucket.Name }));
            versioning = versioningResponse.Status || 'Disabled';
          } catch (error) {
            // Ignore errors for bucket details
          }

          await AWSResource.findOneAndUpdate(
            {
              resourceId: bucket.Name,
              accountId,
              companyId: new mongoose.Types.ObjectId(companyId)
            },
            {
              resourceType: 'S3',
              resourceName: bucket.Name,
              region,
              status: 'active',
              metadata: {
                creationDate: bucket.CreationDate,
                versioning
              },
              cost: 0,
              lastSync: new Date(),
              isActive: true
            },
            { upsert: true, new: true }
          );
          count++;
        }
      }

      return count;
    } catch (error) {
      console.error('Error syncing S3 resources:', error);
      return 0;
    }
  }

  private async syncLambdaResources(lambdaClient: LambdaClient, accountId: string, companyId: string): Promise<number> {
    try {
      // Mark existing Lambda resources as inactive
      await AWSResource.updateMany(
        { accountId, resourceType: 'Lambda', companyId: new mongoose.Types.ObjectId(companyId) },
        { isActive: false }
      );

      const functionsResponse = await lambdaClient.send(new ListFunctionsCommand({}));
      let count = 0;

      for (const func of functionsResponse.Functions || []) {
        if (func.FunctionName && func.FunctionArn) {
          await AWSResource.findOneAndUpdate(
            {
              resourceId: func.FunctionArn,
              accountId,
              companyId: new mongoose.Types.ObjectId(companyId)
            },
            {
              resourceType: 'Lambda',
              resourceName: func.FunctionName,
              region: func.FunctionArn.split(':')[3] || 'unknown',
              status: func.State || 'unknown',
              metadata: {
                runtime: func.Runtime,
                handler: func.Handler,
                codeSize: func.CodeSize,
                memorySize: func.MemorySize,
                timeout: func.Timeout,
                lastModified: func.LastModified
              },
              cost: 0,
              lastSync: new Date(),
              isActive: true
            },
            { upsert: true, new: true }
          );
          count++;
        }
      }

      return count;
    } catch (error) {
      console.error('Error syncing Lambda resources:', error);
      return 0;
    }
  }

  private async syncRDSResources(rdsClient: RDSClient, accountId: string, companyId: string): Promise<number> {
    try {
      // Mark existing RDS resources as inactive
      await AWSResource.updateMany(
        { accountId, resourceType: 'RDS', companyId: new mongoose.Types.ObjectId(companyId) },
        { isActive: false }
      );

      const instancesResponse = await rdsClient.send(new DescribeDBInstancesCommand({}));
      let count = 0;

      for (const instance of instancesResponse.DBInstances || []) {
        if (instance.DBInstanceIdentifier && instance.DBInstanceArn) {
          await AWSResource.findOneAndUpdate(
            {
              resourceId: instance.DBInstanceArn,
              accountId,
              companyId: new mongoose.Types.ObjectId(companyId)
            },
            {
              resourceType: 'RDS',
              resourceName: instance.DBInstanceIdentifier,
              region: instance.AvailabilityZone?.slice(0, -1) || 'unknown',
              status: instance.DBInstanceStatus || 'unknown',
              metadata: {
                engine: instance.Engine,
                engineVersion: instance.EngineVersion,
                instanceClass: instance.DBInstanceClass,
                allocatedStorage: instance.AllocatedStorage,
                multiAZ: instance.MultiAZ,
                endpoint: instance.Endpoint?.Address,
                port: instance.Endpoint?.Port,
                createdTime: instance.InstanceCreateTime
              },
              cost: 0,
              lastSync: new Date(),
              isActive: true
            },
            { upsert: true, new: true }
          );
          count++;
        }
      }

      return count;
    } catch (error) {
      console.error('Error syncing RDS resources:', error);
      return 0;
    }
  }

  async getResourcesFromDatabase(companyId: string, filters?: {
    accountId?: string;
    resourceType?: string;
    region?: string;
  }): Promise<any[]> {
    const query: any = {
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    };

    if (filters?.accountId) query.accountId = filters.accountId;
    if (filters?.resourceType) query.resourceType = filters.resourceType;
    if (filters?.region) query.region = filters.region;

    const resources = await AWSResource.find(query).sort({ resourceType: 1, resourceName: 1 });
    
    return resources.map((resource: any) => ({
      id: resource._id.toString(),
      resourceId: resource.resourceId,
      resourceType: resource.resourceType,
      resourceName: resource.resourceName,
      accountId: resource.accountId,
      region: resource.region,
      status: resource.status,
      metadata: resource.metadata,
      tags: resource.tags,
      cost: resource.cost,
      lastSync: resource.lastSync
    }));
  }

  async getResourceStats(companyId: string): Promise<any> {
    const stats = await AWSResource.aggregate([
      { 
        $match: { 
          companyId: new mongoose.Types.ObjectId(companyId), 
          isActive: true 
        } 
      },
      {
        $group: {
          _id: '$resourceType',
          count: { $sum: 1 },
          totalCost: { $sum: '$cost' }
        }
      }
    ]);

    // Get EC2 state breakdown
    const ec2States = await AWSResource.aggregate([
      { 
        $match: { 
          companyId: new mongoose.Types.ObjectId(companyId), 
          resourceType: 'EC2',
          isActive: true 
        } 
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get RDS status breakdown
    const rdsStatuses = await AWSResource.aggregate([
      { 
        $match: { 
          companyId: new mongoose.Types.ObjectId(companyId), 
          resourceType: 'RDS',
          isActive: true 
        } 
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Build result in the format the controller expects
    const result: any = {
      total: 0,
      totalCost: 0,
      ec2: {
        total: 0,
        byState: {}
      },
      s3: {
        total: 0
      },
      lambda: {
        total: 0
      },
      rds: {
        total: 0,
        byStatus: {}
      }
    };

    // Process main stats
    stats.forEach(stat => {
      const type = stat._id.toLowerCase();
      if (result[type]) {
        result[type].total = stat.count;
        result[type].cost = stat.totalCost;
      }
      result.total += stat.count;
      result.totalCost += stat.totalCost;
    });

    // Process EC2 states
    ec2States.forEach(state => {
      result.ec2.byState[state._id] = state.count;
    });

    // Process RDS statuses
    rdsStatuses.forEach(status => {
      result.rds.byStatus[status._id] = status.count;
    });

    return result;
  }
}
