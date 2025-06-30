import { Request, Response } from 'express';
import { ZoomConnectionService } from '../services/zoomConnectionService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class ZoomConnectionController {
  private connectionService: ZoomConnectionService;

  constructor() {
    this.connectionService = new ZoomConnectionService();
  }

  // POST /api/integrations/zoom/connections/oauth/initiate
  async initiateOAuth(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Zoom Connection: Initiating OAuth...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const authUrl = await this.connectionService.initiateOAuth(companyId);

      console.log('✅ Zoom Connection: OAuth URL generated');
      res.json({
        success: true,
        data: { authUrl }
      });
    } catch (error) {
      console.error('❌ Zoom OAuth Initiate Error:', error);
      
      // Check if it's a configuration error
      if (error instanceof Error && error.message.includes('not configured')) {
        return res.status(400).json({
          success: false,
          message: 'Zoom integration is not configured',
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

  // GET /api/integrations/zoom/callback
  async handleOAuthCallback(req: Request, res: Response) {
    try {
      console.log('🔍 Zoom Connection: Handling OAuth callback...');
      
      const { code, state, error } = req.query;

      if (error) {
        console.error('❌ Zoom OAuth Error:', error);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/zoom?error=${error}`);
      }

      if (!code || !state) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/zoom?error=missing_parameters`);
      }

      const result = await this.connectionService.handleOAuthCallback(
        code as string,
        state as string
      );

      console.log('✅ Zoom Connection: OAuth callback successful');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/zoom?success=true&account=${result.accountName}`);
    } catch (error) {
      console.error('❌ Zoom OAuth Callback Error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/zoom?error=oauth_failed`);
    }
  }

  // GET /api/integrations/zoom/connections
  async getConnections(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Zoom Connection: Fetching connections...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const connections = await this.connectionService.getConnections(companyId);

      console.log('✅ Zoom Connection: Successfully fetched connections');
      res.json({
        success: true,
        data: connections
      });
    } catch (error) {
      console.error('❌ Zoom Get Connections Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch connections',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/zoom/connections/:id
  async getConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Zoom Connection: Fetching connection details...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const connection = await this.connectionService.getConnection(id, companyId);

      console.log('✅ Zoom Connection: Successfully fetched connection details');
      res.json({
        success: true,
        data: {
          id: connection._id.toString(),
          accountId: connection.accountId,
          accountName: connection.accountName,
          accountType: connection.accountType,
          connectionType: connection.connectionType,
          scope: connection.scope,
          isActive: connection.isActive,
          lastSync: connection.lastSync,
          createdAt: connection.createdAt
        }
      });
    } catch (error) {
      console.error('❌ Zoom Get Connection Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/integrations/zoom/connections/:id
  async disconnectConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Zoom Connection: Disconnecting...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      await this.connectionService.disconnectConnection(id, companyId);

      console.log('✅ Zoom Connection: Successfully disconnected');
      res.json({
        success: true,
        message: 'Connection disconnected successfully'
      });
    } catch (error) {
      console.error('❌ Zoom Disconnect Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/zoom/connections/:id/refresh
  async refreshConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Zoom Connection: Refreshing...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      await this.connectionService.refreshConnection(id, companyId);

      console.log('✅ Zoom Connection: Successfully refreshed');
      res.json({
        success: true,
        message: 'Connection refreshed successfully'
      });
    } catch (error) {
      console.error('❌ Zoom Refresh Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/zoom/connections/:id/test
  async testConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Zoom Connection: Testing...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const result = await this.connectionService.testConnection(id, companyId);

      console.log('✅ Zoom Connection: Test successful');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Zoom Test Connection Error:', error);
      res.status(500).json({
        success: false,
        message: 'Connection test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
