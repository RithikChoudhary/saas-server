import { Request, Response } from 'express';
import { GitHubRepositoriesService } from '../services/githubRepositoriesService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class GitHubRepositoriesController {
  private repositoriesService: GitHubRepositoriesService;

  constructor() {
    this.repositoriesService = new GitHubRepositoriesService();
  }

  // POST /api/integrations/github/repositories/sync
  async syncRepositories(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Repositories: Starting sync...');
      
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
      this.repositoriesService.syncRepositoriesFromGitHub(connectionId, companyId)
        .then(result => {
          console.log('✅ GitHub Repositories sync completed:', result);
        })
        .catch(error => {
          console.error('❌ GitHub Repositories sync failed:', error);
        });

      res.json({
        success: true,
        message: 'Repositories sync initiated. This may take a few minutes.'
      });
    } catch (error) {
      console.error('❌ GitHub Repositories Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate repositories sync',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/repositories
  async getRepositories(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Repositories: Fetching repositories...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { connectionId, search, language, visibility } = req.query;

      const repositories = await this.repositoriesService.getRepositoriesFromDatabase(companyId, {
        connectionId: connectionId as string,
        search: search as string,
        language: language as string,
        visibility: visibility as 'public' | 'private' | 'all'
      });

      console.log('✅ GitHub Repositories: Successfully fetched repositories');
      res.json({
        success: true,
        data: repositories
      });
    } catch (error) {
      console.error('❌ GitHub Get Repositories Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch GitHub repositories',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/repositories/:owner/:repo
  async getRepositoryDetails(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Repositories: Fetching repository details...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { owner, repo } = req.params;
      const { connectionId } = req.query;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID is required'
        });
      }

      const repository = await this.repositoriesService.getRepositoryDetails(
        connectionId as string,
        companyId,
        owner,
        repo
      );

      console.log('✅ GitHub Repositories: Successfully fetched repository details');
      res.json({
        success: true,
        data: repository
      });
    } catch (error) {
      console.error('❌ GitHub Get Repository Details Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch repository details',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/repositories/:owner/:repo/languages
  async getRepositoryLanguages(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Repositories: Fetching repository languages...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { owner, repo } = req.params;
      const { connectionId } = req.query;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID is required'
        });
      }

      const languages = await this.repositoriesService.getRepositoryLanguages(
        connectionId as string,
        companyId,
        owner,
        repo
      );

      console.log('✅ GitHub Repositories: Successfully fetched repository languages');
      res.json({
        success: true,
        data: languages
      });
    } catch (error) {
      console.error('❌ GitHub Get Repository Languages Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch repository languages',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/repositories/:owner/:repo/contributors
  async getRepositoryContributors(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Repositories: Fetching repository contributors...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { owner, repo } = req.params;
      const { connectionId } = req.query;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: 'Connection ID is required'
        });
      }

      const contributors = await this.repositoriesService.getRepositoryContributors(
        connectionId as string,
        companyId,
        owner,
        repo
      );

      console.log('✅ GitHub Repositories: Successfully fetched repository contributors');
      res.json({
        success: true,
        data: contributors
      });
    } catch (error) {
      console.error('❌ GitHub Get Repository Contributors Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch repository contributors',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/github/repositories/stats
  async getRepositoryStats(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 GitHub Repositories: Fetching repository stats...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const stats = await this.repositoriesService.getRepositoryStats(companyId);

      console.log('✅ GitHub Repositories: Successfully fetched repository stats');
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ GitHub Repository Stats Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch repository stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
