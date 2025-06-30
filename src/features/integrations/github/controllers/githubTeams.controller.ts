import { Request, Response } from 'express';
import { GitHubTeamsService } from '../services/githubTeamsService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class GitHubTeamsController {
  private teamsService: GitHubTeamsService;

  constructor() {
    this.teamsService = new GitHubTeamsService();
  }

  // POST /api/integrations/github/teams/sync
  async syncTeams(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Teams: Starting sync...');
      
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
      this.teamsService.syncTeamsFromGitHub(connectionId, companyId)
        .then(result => {
          console.log('✅ GitHub Teams sync completed:', result);
        })
        .catch(error => {
          console.error('❌ GitHub Teams sync failed:', error);
        });

      res.json({
        success: true,
        message: 'Teams sync initiated. This may take a few minutes.'
      });
    } catch (error) {
      console.error('❌ GitHub Teams Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate teams sync',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/teams
  async getTeams(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Teams: Fetching teams...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId, search } = req.query;

      const teams = await this.teamsService.getTeamsFromDatabase(companyId, {
        connectionId: connectionId as string,
        search: search as string
      });

      console.log('✅ GitHub Teams: Successfully fetched teams');
      res.json({
        success: true,
        data: teams
      });
    } catch (error) {
      console.error('❌ GitHub Get Teams Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch GitHub teams',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/teams/:teamId/members
  async getTeamMembers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Teams: Fetching team members...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { teamId } = req.params;

      const members = await this.teamsService.getTeamMembersFromDatabase(teamId, companyId);

      console.log('✅ GitHub Teams: Successfully fetched team members');
      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      console.error('❌ GitHub Get Team Members Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch team members',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/github/teams
  async createTeam(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Teams: Creating team...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId, name, description, privacy, parentTeamId } = req.body;

      if (!connectionId || !name) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID and team name are required'
        });
      }

      const result = await this.teamsService.createTeam(connectionId, companyId, {
        name,
        description,
        privacy,
        parentTeamId
      });

      console.log('✅ GitHub Teams: Team created successfully');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ GitHub Create Team Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create team',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // PATCH /api/integrations/github/teams/:teamSlug
  async updateTeam(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Teams: Updating team...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { teamSlug } = req.params;
      const { connectionId, name, description, privacy } = req.body;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID is required'
        });
      }

      const result = await this.teamsService.updateTeam(connectionId, companyId, teamSlug, {
        name,
        description,
        privacy
      });

      console.log('✅ GitHub Teams: Team updated successfully');
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ GitHub Update Team Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update team',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/integrations/github/teams/:teamSlug
  async deleteTeam(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Teams: Deleting team...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { teamSlug } = req.params;
      const { connectionId } = req.body;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID is required'
        });
      }

      await this.teamsService.deleteTeam(connectionId, companyId, teamSlug);

      console.log('✅ GitHub Teams: Team deleted successfully');
      res.json({
        success: true,
        message: 'Team deleted successfully'
      });
    } catch (error) {
      console.error('❌ GitHub Delete Team Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete team',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/github/teams/:teamSlug/members
  async addTeamMember(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Teams: Adding team member...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { teamSlug } = req.params;
      const { connectionId, username, role } = req.body;

      if (!connectionId || !username) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID and username are required'
        });
      }

      await this.teamsService.addTeamMember(connectionId, companyId, teamSlug, username, role);

      console.log('✅ GitHub Teams: Team member added successfully');
      res.json({
        success: true,
        message: 'Team member added successfully'
      });
    } catch (error) {
      console.error('❌ GitHub Add Team Member Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add team member',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/integrations/github/teams/:teamSlug/members/:username
  async removeTeamMember(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Teams: Removing team member...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { teamSlug, username } = req.params;
      const { connectionId } = req.body;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID is required'
        });
      }

      await this.teamsService.removeTeamMember(connectionId, companyId, teamSlug, username);

      console.log('✅ GitHub Teams: Team member removed successfully');
      res.json({
        success: true,
        message: 'Team member removed successfully'
      });
    } catch (error) {
      console.error('❌ GitHub Remove Team Member Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove team member',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/teams/stats
  async getTeamStats(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Teams: Fetching team stats...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const stats = await this.teamsService.getTeamStats(companyId);

      console.log('✅ GitHub Teams: Successfully fetched team stats');
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ GitHub Team Stats Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch team stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
