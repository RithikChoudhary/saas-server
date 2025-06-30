import { Request, Response } from 'express';
import { 
  AWSAccount, 
  SlackUser, 
  SlackConnection,
  ZoomUser,
  ZoomConnection,
  GitHubUser,
  GitHubConnection,
  GoogleWorkspaceUser,
  GoogleWorkspaceConnection
} from '../../../database/models';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class DashboardController {
  // GET /api/dashboard/overview
  async getOverview(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Dashboard: Fetching overview data...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      // Get AWS account statistics
      const awsStats = await AWSAccount.getCompanyStats(companyId);
      const awsData = awsStats.length > 0 ? awsStats[0] : {
        totalAccounts: 0,
        connectedAccounts: 0,
        totalUsers: 0,
        totalCost: 0,
        totalResources: 0,
        avgSecurityScore: 0
      };

      // Get connected services count
      const connectedServices = [];
      if (awsData.connectedAccounts > 0) {
        connectedServices.push({
          type: 'aws',
          name: 'Amazon Web Services',
          accounts: awsData.connectedAccounts,
          users: awsData.totalUsers,
          cost: awsData.totalCost,
          status: 'connected'
        });
      }

      // TODO: Add other services (Office 365, GitHub, etc.) when implemented

      const overview = {
        connectedServices: connectedServices.length,
        totalUsers: awsData.totalUsers || 0,
        totalAccounts: awsData.totalAccounts || 0,
        monthlyCost: awsData.totalCost || 0,
        totalResources: awsData.totalResources || 0,
        securityScore: Math.round(awsData.avgSecurityScore || 0),
        services: connectedServices,
        lastUpdated: new Date().toISOString()
      };

      console.log('✅ Dashboard: Overview data prepared', overview);
      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      console.error('❌ Dashboard Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard overview',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/dashboard/connected-services
  async getConnectedServices(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Dashboard: Fetching connected services...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const connectedServices = [];
      const companyObjectId = new mongoose.Types.ObjectId(companyId);

      // Get AWS services
      const awsAccounts = await AWSAccount.findByCompany(companyId);
      const connectedAWSAccounts = awsAccounts.filter(account => account.status === 'connected');
      
      if (connectedAWSAccounts.length > 0) {
        const totalUsers = connectedAWSAccounts.reduce((sum, account) => sum + account.users, 0);
        const totalCost = connectedAWSAccounts.reduce((sum, account) => sum + account.monthlyCost, 0);
        const lastSync = connectedAWSAccounts.reduce((latest: Date | null, account) => {
          return !latest || (account.lastSync && account.lastSync > latest) ? account.lastSync || null : latest;
        }, null as Date | null);

        connectedServices.push({
          id: 'aws',
          name: 'Amazon Web Services',
          type: 'aws',
          icon: '☁️',
          status: 'connected',
          accounts: connectedAWSAccounts.length,
          users: totalUsers,
          monthlyCost: totalCost,
          lastSync: lastSync ? lastSync.toISOString() : null,
          details: connectedAWSAccounts.map(account => ({
            id: account._id,
            accountId: account.accountId,
            accountName: account.accountName,
            region: account.region,
            users: account.users,
            resources: account.resources,
            monthlyCost: account.monthlyCost,
            lastSync: account.lastSync
          }))
        });
      }

      // Get Slack services
      try {
        const slackConnections = await SlackConnection.find({ 
          companyId: companyObjectId, 
          isActive: true 
        });
        
        if (slackConnections.length > 0) {
          const slackUsers = await SlackUser.find({ 
            companyId: companyObjectId, 
            isActive: true,
            isDeleted: false 
          });
          
          const lastSync = slackConnections.reduce((latest: Date | null, connection) => {
            return !latest || (connection.lastSync && connection.lastSync > latest) ? connection.lastSync || null : latest;
          }, null as Date | null);

          connectedServices.push({
            id: 'slack',
            name: 'Slack',
            type: 'slack',
            icon: '💬',
            status: 'connected',
            accounts: slackConnections.length,
            users: slackUsers.length,
            monthlyCost: 0, // Slack pricing would need to be calculated
            lastSync: lastSync ? lastSync.toISOString() : null,
            details: slackConnections.map(connection => ({
              id: connection._id,
              workspaceName: connection.workspaceName,
              workspaceDomain: connection.workspaceDomain,
              lastSync: connection.lastSync
            }))
          });
        }
      } catch (error) {
        console.error('Error fetching Slack data:', error);
      }

      // Get Zoom services
      try {
        const zoomConnections = await ZoomConnection.find({ 
          companyId: companyObjectId, 
          isActive: true 
        });
        
        if (zoomConnections.length > 0) {
          const zoomUsers = await ZoomUser.find({ 
            companyId: companyObjectId, 
            isActive: true 
          });
          
          const lastSync = zoomConnections.reduce((latest: Date | null, connection) => {
            return !latest || (connection.lastSync && connection.lastSync > latest) ? connection.lastSync || null : latest;
          }, null as Date | null);

          connectedServices.push({
            id: 'zoom',
            name: 'Zoom',
            type: 'zoom',
            icon: '📹',
            status: 'connected',
            accounts: zoomConnections.length,
            users: zoomUsers.length,
            monthlyCost: 0, // Zoom pricing would need to be calculated
            lastSync: lastSync ? lastSync.toISOString() : null,
            details: zoomConnections.map(connection => ({
              id: connection._id,
              accountId: connection.accountId,
              lastSync: connection.lastSync
            }))
          });
        }
      } catch (error) {
        console.error('Error fetching Zoom data:', error);
      }

      // Get GitHub services
      try {
        const githubConnections = await GitHubConnection.find({ 
          companyId: companyObjectId, 
          isActive: true 
        });
        
        if (githubConnections.length > 0) {
          const githubUsers = await GitHubUser.find({ 
            companyId: companyObjectId, 
            isActive: true 
          });
          
          const lastSync = githubConnections.reduce((latest: Date | null, connection) => {
            return !latest || (connection.lastSync && connection.lastSync > latest) ? connection.lastSync || null : latest;
          }, null as Date | null);

          connectedServices.push({
            id: 'github',
            name: 'GitHub',
            type: 'github',
            icon: '🐙',
            status: 'connected',
            accounts: githubConnections.length,
            users: githubUsers.length,
            monthlyCost: 0, // GitHub pricing would need to be calculated
            lastSync: lastSync ? lastSync.toISOString() : null,
            details: githubConnections.map(connection => ({
              id: connection._id,
              organizationName: connection.organizationName,
              lastSync: connection.lastSync
            }))
          });
        }
      } catch (error) {
        console.error('Error fetching GitHub data:', error);
      }

      // Get Google Workspace services
      try {
        const googleConnections = await GoogleWorkspaceConnection.find({ 
          companyId: companyObjectId, 
          isActive: true 
        });
        
        if (googleConnections.length > 0) {
          const googleUsers = await GoogleWorkspaceUser.find({ 
            companyId: companyObjectId, 
            isActive: true 
          });
          
          const lastSync = googleConnections.reduce((latest: Date | null, connection) => {
            return !latest || (connection.lastSync && connection.lastSync > latest) ? connection.lastSync || null : latest;
          }, null as Date | null);

          connectedServices.push({
            id: 'google-workspace',
            name: 'Google Workspace',
            type: 'google-workspace',
            icon: '📊',
            status: 'connected',
            accounts: googleConnections.length,
            users: googleUsers.length,
            monthlyCost: 0, // Google Workspace pricing would need to be calculated
            lastSync: lastSync ? lastSync.toISOString() : null,
            details: googleConnections.map(connection => ({
              id: connection._id,
              domain: connection.domain,
              lastSync: connection.lastSync
            }))
          });
        }
      } catch (error) {
        console.error('Error fetching Google Workspace data:', error);
      }

      console.log(`✅ Dashboard: Found ${connectedServices.length} connected services`);
      res.json({
        success: true,
        data: connectedServices
      });
    } catch (error) {
      console.error('❌ Dashboard Connected Services Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch connected services',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/dashboard/recent-activity
  async getRecentActivity(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Dashboard: Fetching recent activity...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      // Get recent AWS account activities
      const recentAWSAccounts = await AWSAccount.find({ 
        companyId: new mongoose.Types.ObjectId(companyId),
        isActive: true 
      })
      .sort({ createdAt: -1 })
      .limit(10);

      const activities = [];

      // Add AWS connection activities
      for (const account of recentAWSAccounts) {
        activities.push({
          id: `aws-${account._id}`,
          type: 'service_connected',
          service: 'aws',
          message: `AWS account "${account.accountName}" (${account.accountId}) connected`,
          timestamp: account.createdAt.toISOString(),
          severity: 'success',
          details: {
            accountId: account.accountId,
            accountName: account.accountName,
            region: account.region
          }
        });

        // Add sync activities if available
        if (account.lastSync) {
          activities.push({
            id: `aws-sync-${account._id}`,
            type: 'data_sync',
            service: 'aws',
            message: `AWS account "${account.accountName}" data synchronized`,
            timestamp: account.lastSync.toISOString(),
            severity: 'info',
            details: {
              accountId: account.accountId,
              users: account.users,
              resources: account.resources
            }
          });
        }
      }

      // Sort by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      console.log(`✅ Dashboard: Found ${activities.length} recent activities`);
      res.json({
        success: true,
        data: activities.slice(0, 20) // Return last 20 activities
      });
    } catch (error) {
      console.error('❌ Dashboard Recent Activity Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent activity',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
