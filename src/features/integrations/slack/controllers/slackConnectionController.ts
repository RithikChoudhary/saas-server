import { Request, Response } from 'express';
import { SlackConnectionService } from '../services/slackConnectionService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class SlackConnectionController {
  private connectionService: SlackConnectionService;

  constructor() {
    this.connectionService = new SlackConnectionService();
  }

  // POST /api/integrations/slack/connections/oauth/initiate
  async initiateOAuth(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack OAuth: Initiating OAuth flow...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const authUrl = await this.connectionService.initiateOAuth(companyId);

      console.log('✅ Slack OAuth: Successfully generated auth URL');
      res.json({
        success: true,
        data: { authUrl }
      });
    } catch (error) {
      console.error('❌ Slack OAuth Initiate Error:', error);
      
      // Check if it's a configuration error
      if (error instanceof Error && error.message.includes('not configured')) {
        return res.status(400).json({
          success: false,
          message: 'Slack integration is not configured',
          error: error.message,
          configurationRequired: true
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to initiate OAuth',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/slack/callback
  async handleOAuthCallback(req: Request, res: Response) {
    try {
      console.log('🔍 Slack Connection: Handling OAuth callback...');
      
      const { code, state, error } = req.query;

      if (error) {
        console.error('❌ Slack OAuth Error:', error);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/slack?error=${error}`);
      }

      if (!code || !state) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/slack?error=missing_parameters`);
      }

      const result = await this.connectionService.handleOAuthCallback(
        code as string,
        state as string
      );

      console.log('✅ Slack Connection: OAuth callback successful');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/slack?success=true&workspace=${result.workspaceName}`);
    } catch (error) {
      console.error('❌ Slack OAuth Callback Error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/slack?error=oauth_failed`);
    }
  }

  // GET /api/integrations/slack/connections
  async getConnections(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack Connection: Fetching connections...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const connections = await this.connectionService.getConnections(companyId);

      console.log('✅ Slack Connection: Successfully fetched connections');
      res.json({
        success: true,
        data: connections
      });
    } catch (error) {
      console.error('❌ Slack Get Connections Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch connections',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/slack/connections/:id
  async getConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack Connection: Fetching connection details...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const connection = await this.connectionService.getConnection(id, companyId);

      console.log('✅ Slack Connection: Successfully fetched connection details');
      res.json({
        success: true,
        data: {
          id: connection._id.toString(),
          workspaceId: connection.workspaceId,
          workspaceName: connection.workspaceName,
          workspaceDomain: connection.workspaceDomain,
          connectionType: connection.connectionType,
          scope: connection.scope,
          isActive: connection.isActive,
          lastSync: connection.lastSync,
          createdAt: connection.createdAt
        }
      });
    } catch (error) {
      console.error('❌ Slack Get Connection Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/integrations/slack/connections/:id
  async disconnectConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack Connection: Disconnecting...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      await this.connectionService.disconnectConnection(id, companyId);

      console.log('✅ Slack Connection: Successfully disconnected');
      res.json({
        success: true,
        message: 'Connection disconnected successfully'
      });
    } catch (error) {
      console.error('❌ Slack Disconnect Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/slack/connections/:id/refresh
  async refreshConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack Connection: Refreshing...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      await this.connectionService.refreshConnection(id, companyId);

      console.log('✅ Slack Connection: Successfully refreshed');
      res.json({
        success: true,
        message: 'Connection refreshed successfully'
      });
    } catch (error) {
      console.error('❌ Slack Refresh Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/slack/connections/:id/test
  async testConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Slack Connection: Testing...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const result = await this.connectionService.testConnection(id, companyId);

      console.log('✅ Slack Connection: Test successful');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Slack Test Connection Error:', error);
      res.status(500).json({
        success: false,
        message: 'Connection test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
