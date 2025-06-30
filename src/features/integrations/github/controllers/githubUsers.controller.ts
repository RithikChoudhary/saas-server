import { Request, Response } from 'express';
import { GitHubUsersService } from '../services/githubUsersService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class GitHubUsersController {
  private usersService: GitHubUsersService;

  constructor() {
    this.usersService = new GitHubUsersService();
  }

  // POST /api/integrations/github/users/sync
  async syncUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Users: Starting sync...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId } = req.body;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID is required'
        });
      }

      // Start sync in background
      this.usersService.syncUsersFromGitHub(connectionId, companyId)
        .then(result => {
          console.log('✅ GitHub Users sync completed:', result);
        })
        .catch(error => {
          console.error('❌ GitHub Users sync failed:', error);
        });

      res.json({
        success: true,
        message: 'Users sync initiated. This may take a few minutes.'
      });
    } catch (error) {
      console.error('❌ GitHub Users Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate users sync',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/users
  async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Users: Fetching users...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId, search } = req.query;

      const users = await this.usersService.getUsersFromDatabase(companyId, {
        connectionId: connectionId as string,
        search: search as string
      });

      console.log('✅ GitHub Users: Successfully fetched users');
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('❌ GitHub Get Users Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch GitHub users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/github/users/invite
  async inviteUser(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Users: Inviting user...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId, username } = req.body;

      if (!connectionId || !username) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID and username are required'
        });
      }

      const result = await this.usersService.inviteUser(connectionId, companyId, username);

      console.log('✅ GitHub Users: User invited successfully');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ GitHub Invite User Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to invite user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/integrations/github/users/:username
  async removeUser(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Users: Removing user...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { username } = req.params;
      const { connectionId } = req.body;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID is required'
        });
      }

      await this.usersService.removeUser(connectionId, companyId, username);

      console.log('✅ GitHub Users: User removed successfully');
      res.json({
        success: true,
        message: 'User removed successfully'
      });
    } catch (error) {
      console.error('❌ GitHub Remove User Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/users/stats
  async getUserStats(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Users: Fetching user stats...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const stats = await this.usersService.getUserStats(companyId);

      console.log('✅ GitHub Users: Successfully fetched user stats');
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ GitHub User Stats Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
