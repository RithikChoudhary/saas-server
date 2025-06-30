import { Request, Response } from 'express';
import { GoogleWorkspaceConnectionService } from '../services/googleWorkspaceConnectionService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class GoogleWorkspaceConnectionController {
  private connectionService: GoogleWorkspaceConnectionService;

  constructor() {
    this.connectionService = new GoogleWorkspaceConnectionService();
  }

  // POST /api/integrations/google-workspace/connections/oauth/initiate
  async initiateOAuth(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Initiating OAuth...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const authUrl = await this.connectionService.initiateOAuth(companyId);

      console.log('✅ Google Workspace Connection: OAuth URL generated');
      res.json({
        success: true,
        data: { authUrl }
      });
    } catch (error) {
      console.error('❌ Google Workspace OAuth Initiate Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate OAuth',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/google-workspace/callback
  async handleOAuthCallback(req: Request, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Handling OAuth callback...');
      
      const { code, state, error } = req.query;

      if (error) {
        console.error('❌ Google Workspace OAuth Error:', error);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/google-workspace?error=${error}`);
      }

      if (!code || !state) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/google-workspace?error=missing_parameters`);
      }

      const result = await this.connectionService.handleOAuthCallback(
        code as string,
        state as string
      );

      console.log('✅ Google Workspace Connection: OAuth callback successful');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/google-workspace?success=true&domain=${result.domain}`);
    } catch (error) {
      console.error('❌ Google Workspace OAuth Callback Error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/apps/google-workspace?error=oauth_failed`);
    }
  }

  // GET /api/integrations/google-workspace/connections
  async getConnections(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Fetching connections...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const connections = await this.connectionService.getConnections(companyId);

      console.log('✅ Google Workspace Connection: Successfully fetched connections');
      res.json({
        success: true,
        data: connections
      });
    } catch (error) {
      console.error('❌ Google Workspace Get Connections Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch connections',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/google-workspace/connections/:id
  async getConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Fetching connection details...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const connection = await this.connectionService.getConnection(id, companyId);

      console.log('✅ Google Workspace Connection: Successfully fetched connection details');
      res.json({
        success: true,
        data: {
          id: connection._id.toString(),
          domain: connection.domain,
          customerID: connection.customerID,
          organizationName: connection.organizationName,
          connectionType: connection.connectionType,
          scope: connection.scope,
          isActive: connection.isActive,
          lastSync: connection.lastSync,
          createdAt: connection.createdAt
        }
      });
    } catch (error) {
      console.error('❌ Google Workspace Get Connection Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/integrations/google-workspace/connections/:id
  async disconnectConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Disconnecting...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      await this.connectionService.disconnectConnection(id, companyId);

      console.log('✅ Google Workspace Connection: Successfully disconnected');
      res.json({
        success: true,
        message: 'Connection disconnected successfully'
      });
    } catch (error) {
      console.error('❌ Google Workspace Disconnect Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/google-workspace/connections/:id/refresh
  async refreshConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Refreshing...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      await this.connectionService.refreshConnection(id, companyId);

      console.log('✅ Google Workspace Connection: Successfully refreshed');
      res.json({
        success: true,
        message: 'Connection refreshed successfully'
      });
    } catch (error) {
      console.error('❌ Google Workspace Refresh Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/google-workspace/connections/:id/test
  async testConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Testing...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const result = await this.connectionService.testConnection(id, companyId);

      console.log('✅ Google Workspace Connection: Test successful');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Google Workspace Test Connection Error:', error);
      res.status(500).json({
        success: false,
        message: 'Connection test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/google-workspace/connections/:id/sync
  async syncConnection(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Starting sync...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      
      // Run sync operations in parallel
      const [usersResult, groupsResult, orgUnitsResult] = await Promise.allSettled([
        this.connectionService.syncUsers(id, companyId),
        this.connectionService.syncGroups(id, companyId),
        this.connectionService.syncOrgUnits(id, companyId)
      ]);

      const results = {
        users: usersResult.status === 'fulfilled' ? usersResult.value : { error: usersResult.reason?.message },
        groups: groupsResult.status === 'fulfilled' ? groupsResult.value : { error: groupsResult.reason?.message },
        orgUnits: orgUnitsResult.status === 'fulfilled' ? orgUnitsResult.value : { error: orgUnitsResult.reason?.message }
      };

      console.log('✅ Google Workspace Connection: Sync completed');
      res.json({
        success: true,
        message: 'Sync completed',
        data: results
      });
    } catch (error) {
      console.error('❌ Google Workspace Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Sync failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/google-workspace/connections/:id/sync/users
  async syncUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Syncing users...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const result = await this.connectionService.syncUsers(id, companyId);

      console.log('✅ Google Workspace Connection: Users sync successful');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Google Workspace Users Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Users sync failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/google-workspace/connections/:id/sync/groups
  async syncGroups(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Syncing groups...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const result = await this.connectionService.syncGroups(id, companyId);

      console.log('✅ Google Workspace Connection: Groups sync successful');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Google Workspace Groups Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Groups sync failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/google-workspace/connections/:id/sync/org-units
  async syncOrgUnits(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Google Workspace Connection: Syncing org units...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const result = await this.connectionService.syncOrgUnits(id, companyId);

      console.log('✅ Google Workspace Connection: Org units sync successful');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Google Workspace Org Units Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Org units sync failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
