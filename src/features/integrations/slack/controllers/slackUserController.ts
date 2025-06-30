import { Request, Response } from 'express';
import { SlackUserService } from '../services/slackUserService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class SlackUserController {
  private userService: SlackUserService;

  constructor() {
    this.userService = new SlackUserService();
  }

  // GET /api/integrations/slack/users
  async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack Users: Fetching users...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId } = req.query;
      const users = await this.userService.getUsers(
        companyId, 
        connectionId as string
      );

      console.log('✅ Slack Users: Successfully fetched users');
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('❌ Slack Get Users Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/slack/users/stats
  async getUserStats(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack Users: Fetching user stats...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId } = req.query;
      const stats = await this.userService.getUserStats(
        companyId, 
        connectionId as string
      );

      console.log('✅ Slack Users: Successfully fetched user stats');
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ Slack Get User Stats Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/slack/users/:id
  async getUser(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack Users: Fetching user details...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const user = await this.userService.getUser(id, companyId);

      console.log('✅ Slack Users: Successfully fetched user details');
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('❌ Slack Get User Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/slack/users/sync
  async syncUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack Users: Syncing users...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId } = req.body;
      
      if (connectionId) {
        // Sync specific connection
        const users = await this.userService.syncUsers(connectionId, companyId);
        console.log('✅ Slack Users: Successfully synced users for connection');
        res.json({
          success: true,
          message: 'Users synced successfully',
          data: { syncedCount: users.length }
        });
      } else {
        // Sync all connections
        await this.userService.syncAllConnections(companyId);
        console.log('✅ Slack Users: Successfully synced users for all connections');
        res.json({
          success: true,
          message: 'All users synced successfully'
        });
      }
    } catch (error) {
      console.error('❌ Slack Sync Users Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/slack/users/ghost
  async getGhostUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack Users: Fetching ghost users...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { inactiveDays = '90' } = req.query;
      const ghostUsers = await this.userService.getGhostUsers(
        companyId, 
        parseInt(inactiveDays as string)
      );

      console.log('✅ Slack Users: Successfully fetched ghost users');
      res.json({
        success: true,
        data: ghostUsers
      });
    } catch (error) {
      console.error('❌ Slack Get Ghost Users Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch ghost users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
