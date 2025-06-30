import { Request, Response } from 'express';
import { AWSResourcesService } from '../services/awsResourcesService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class AWSResourcesController {
  private resourcesService: AWSResourcesService;

  constructor() {
    this.resourcesService = new AWSResourcesService();
  }

  // GET /api/integrations/aws/resources/summary - Frontend expects this endpoint
  async getResourcesSummary(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Resources: Fetching resources summary...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      // Get resource stats
      const stats = await this.resourcesService.getResourceStats(companyId);
      
      // Format response for frontend
      const summary = {
        ec2Instances: {
          total: stats.ec2.total,
          running: stats.ec2.byState?.running || 0,
          stopped: stats.ec2.byState?.stopped || 0,
          terminated: stats.ec2.byState?.terminated || 0
        },
        s3Buckets: {
          total: stats.s3.total,
          totalSize: '0 GB', // TODO: Calculate actual size
          largestBucket: 'N/A' // TODO: Find largest bucket
        },
        rdsInstances: {
          total: stats.rds.total,
          available: stats.rds.byStatus?.available || 0,
          maintenance: 0 // TODO: Track maintenance status
        },
        lambdaFunctions: {
          total: stats.lambda.total,
          invocations24h: 0, // TODO: Get from CloudWatch
          errors24h: 0 // TODO: Get from CloudWatch
        },
        vpcCount: 0, // TODO: Add VPC tracking
        elasticIPs: 0, // TODO: Add Elastic IP tracking
        loadBalancers: 0, // TODO: Add Load Balancer tracking
        securityGroups: 0 // TODO: Add Security Group tracking
      };
      
      console.log('✅ AWS Resources: Successfully fetched resources summary');
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('❌ AWS Resources Summary Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch resources summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/resources/ec2 - Frontend expects this endpoint
  async getEC2Instances(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Resources: Fetching EC2 instances...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      // Get all resources and filter EC2
      const resources = await this.resourcesService.getResourcesFromDatabase(companyId, {
        resourceType: 'EC2'
      });

      // Format EC2 instances for frontend
      const ec2Instances = resources
        .filter((r: any) => r.resourceType === 'EC2' || r.resourceType === 'ec2')
        .map((instance: any) => ({
          id: instance.id || instance._id,
          instanceId: instance.resourceId,
          name: instance.resourceName || instance.metadata?.tags?.Name || 'Unnamed Instance',
          type: instance.metadata?.instanceType || 't2.micro',
          state: instance.status || instance.metadata?.state || 'unknown',
          availabilityZone: instance.metadata?.availabilityZone || instance.region,
          publicIP: instance.metadata?.publicIp || instance.metadata?.publicIpAddress,
          privateIP: instance.metadata?.privateIp || instance.metadata?.privateIpAddress || '10.0.0.0',
          launchTime: instance.metadata?.launchTime || instance.lastSync,
          platform: instance.metadata?.platform || 'Linux'
        }));
      
      console.log('✅ AWS Resources: Successfully fetched EC2 instances');
      res.json({
        success: true,
        data: ec2Instances
      });
    } catch (error) {
      console.error('❌ AWS EC2 Instances Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch EC2 instances',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/resources
  async getResources(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Resources: Fetching resources...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { accountId, resourceType, region } = req.query;
      
      const resources = await this.resourcesService.getResourcesFromDatabase(
        companyId,
        {
          accountId: accountId as string,
          resourceType: resourceType as string,
          region: region as string
        }
      );
      
      console.log(`✅ AWS Resources: Found ${resources.length} resources`);
      res.json({
        success: true,
        data: resources
      });
    } catch (error) {
      console.error('❌ AWS Resources Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS resources',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/resources/stats
  async getResourceStats(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Resources: Fetching resource stats...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }
      
      const stats = await this.resourcesService.getResourceStats(companyId);
      
      console.log('✅ AWS Resources: Successfully fetched stats');
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ AWS Resources Stats Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch resource stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/aws/resources/sync
  async syncResources(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS Resources: Starting sync...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }
      
      // Start sync in background
      this.resourcesService.syncResourcesFromAWS(companyId)
        .then(result => {
          console.log('✅ AWS Resources sync completed:', result);
        })
        .catch(error => {
          console.error('❌ AWS Resources sync failed:', error);
        });
      
      res.json({
        success: true,
        message: 'Resource sync initiated. This may take a few minutes.'
      });
    } catch (error) {
      console.error('❌ AWS Resources Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate resource sync',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
