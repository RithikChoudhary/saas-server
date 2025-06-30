import { Request, Response } from 'express';
import { GitHubConnectionService } from '../services/githubConnectionService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class GitHubConnectionController {
  private connectionService: GitHubConnectionService;

  constructor() {
    this.connectionService = new GitHubConnectionService();
  }

  // POST /api/integrations/github/connections/oauth/initiate
  async initiateOAuth(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Connection: Initiating OAuth...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { scope, organizationName } = req.body;

      if (!scope || !['user', 'organization'].includes(scope)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid scope. Must be "user" or "organization"'
        });
      }

      if (scope === 'organization' && !organizationName) {
        return res.status(400).json({
          success: false,
          message: 'Organization name is required for organization scope'
        });
      }

      const authUrl = await this.connectionService.initiateOAuth(companyId, scope, organizationName);

      console.log('✅ GitHub Connection: OAuth URL generated');
      res.json({
        success: true,
        data: { authUrl }
      });
    } catch (error) {
      console.error('❌ GitHub OAuth Initiation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate GitHub OAuth',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/callback
  async handleOAuthCallback(req: Request, res: Response) {
    try {
      console.log('🔍 GitHub Connection: Handling OAuth callback...');
      
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({
          success: false,
          message: 'Missing code or state parameter'
        });
      }

      const result = await this.connectionService.handleOAuthCallback(
        code as string,
        state as string
      );

      console.log('✅ GitHub Connection: OAuth callback handled successfully');
      
      // Redirect to frontend with success
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/github?connected=true`);
    } catch (error) {
      console.error('❌ GitHub OAuth Callback Error:', error);
      
      // Redirect to frontend with error
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/github?error=oauth_failed`);
    }
  }

  // POST /api/integrations/github/connections/pat
  async createPersonalAccessTokenConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Connection: Creating PAT connection...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { token, scope, organizationName } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Personal access token is required'
        });
      }

      if (!scope || !['user', 'organization'].includes(scope)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid scope. Must be "user" or "organization"'
        });
      }

      if (scope === 'organization' && !organizationName) {
        return res.status(400).json({
          success: false,
          message: 'Organization name is required for organization scope'
        });
      }

      const result = await this.connectionService.createPersonalAccessTokenConnection(
        companyId,
        token,
        scope,
        organizationName
      );

      console.log('✅ GitHub Connection: PAT connection created successfully');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ GitHub PAT Connection Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create GitHub connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/connections
  async getConnections(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Connection: Fetching connections...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const connections = await this.connectionService.getConnections(companyId);

      console.log('✅ GitHub Connection: Successfully fetched connections');
      res.json({
        success: true,
        data: connections
      });
    } catch (error) {
      console.error('❌ GitHub Get Connections Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch GitHub connections',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/connections/:connectionId
  async getConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Connection: Fetching connection details...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId } = req.params;

      const connection = await this.connectionService.getConnection(connectionId, companyId);

      console.log('✅ GitHub Connection: Successfully fetched connection details');
      res.json({
        success: true,
        data: connection
      });
    } catch (error) {
      console.error('❌ GitHub Get Connection Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch GitHub connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/integrations/github/connections/:connectionId
  async disconnectConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Connection: Disconnecting...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId } = req.params;

      await this.connectionService.disconnectConnection(connectionId, companyId);

      console.log('✅ GitHub Connection: Successfully disconnected');
      res.json({
        success: true,
        message: 'GitHub connection disconnected successfully'
      });
    } catch (error) {
      console.error('❌ GitHub Disconnect Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect GitHub connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/github/connections/:connectionId/refresh
  async refreshConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Connection: Refreshing...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId } = req.params;

      await this.connectionService.refreshConnection(connectionId, companyId);

      console.log('✅ GitHub Connection: Successfully refreshed');
      res.json({
        success: true,
        message: 'GitHub connection refreshed successfully'
      });
    } catch (error) {
      console.error('❌ GitHub Refresh Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh GitHub connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
