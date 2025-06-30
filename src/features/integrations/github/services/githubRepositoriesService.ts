import { GitHubRepository } from '../../../../database/models';
import mongoose from 'mongoose';
import axios from 'axios';
import { GitHubConnectionService } from './githubConnectionService';

export class GitHubRepositoriesService {
  private connectionService: GitHubConnectionService;

  constructor() {
    this.connectionService = new GitHubConnectionService();
  }

  async syncRepositoriesFromGitHub(connectionId: string, companyId: string): Promise<any> {
    try {
      console.log('🔍 GitHub Repositories: Starting sync from GitHub...');
      
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      let repositories: any[] = [];

      if (connection.scope === 'organization' && connection.organizationName) {
        // Sync organization repositories
        repositories = await this.getOrganizationRepositories(connection.organizationName, token, connection.connectionType);
      } else {
        // Sync user repositories
        repositories = await this.getUserRepositories(token, connection.connectionType);
      }

      // Mark existing repositories as inactive
      await GitHubRepository.updateMany(
        { connectionId, companyId: new mongoose.Types.ObjectId(companyId) },
        { isActive: false }
      );

      // Sync repositories to database
      let syncedCount = 0;
      for (const repoData of repositories) {
        await this.syncRepositoryToDatabase(repoData, connectionId, companyId);
        syncedCount++;
      }

      console.log(`✅ GitHub Repositories sync completed: ${syncedCount} repositories synced`);
      return { syncedCount };
    } catch (error) {
      console.error('❌ GitHub Repositories sync error:', error);
      throw error;
    }
  }

  private async getOrganizationRepositories(org: string, token: string, tokenType: string): Promise<any[]> {
    try {
      console.log(`🔍 GitHub Repositories: Fetching organization repositories for ${org}`);
      console.log(`🔍 GitHub Repositories: Token type: ${tokenType}`);
      
      const repositories: any[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        console.log(`📄 GitHub Repositories: Fetching page ${page} of organization repositories`);
        
        const response = await axios.get(
          `https://api.github.com/orgs/${org}/repos`,
          {
            headers: {
              'Authorization': `${tokenType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            },
            params: {
              per_page: perPage,
              page,
              type: 'all' // Get all types of repos
            }
          }
        );

        console.log(`✅ GitHub Repositories: Received ${response.data.length} repositories on page ${page}`);

        if (response.data.length === 0) break;
        repositories.push(...response.data);

        if (response.data.length < perPage) break;
        page++;
      }

      return repositories;
    } catch (error) {
      console.error('Error fetching organization repositories:', error);
      throw error;
    }
  }

  private async getUserRepositories(token: string, tokenType: string): Promise<any[]> {
    try {
      const repositories: any[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await axios.get(
          'https://api.github.com/user/repos',
          {
            headers: {
              'Authorization': `${tokenType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            },
            params: {
              per_page: perPage,
              page,
              affiliation: 'owner,collaborator,organization_member',
              sort: 'updated'
            }
          }
        );

        if (response.data.length === 0) break;
        repositories.push(...response.data);

        if (response.data.length < perPage) break;
        page++;
      }

      return repositories;
    } catch (error) {
      console.error('Error fetching user repositories:', error);
      throw error;
    }
  }

  private async syncRepositoryToDatabase(repoData: any, connectionId: string, companyId: string): Promise<void> {
    try {
      await GitHubRepository.findOneAndUpdate(
        {
          githubId: repoData.id,
          companyId: new mongoose.Types.ObjectId(companyId)
        },
        {
          connectionId: new mongoose.Types.ObjectId(connectionId),
          nodeId: repoData.node_id,
          name: repoData.name,
          fullName: repoData.full_name,
          description: repoData.description,
          private: repoData.private,
          owner: {
            login: repoData.owner.login,
            type: repoData.owner.type
          },
          htmlUrl: repoData.html_url,
          language: repoData.language,
          stargazersCount: repoData.stargazers_count || 0,
          watchersCount: repoData.watchers_count || 0,
          forksCount: repoData.forks_count || 0,
          openIssuesCount: repoData.open_issues_count || 0,
          defaultBranch: repoData.default_branch || 'main',
          topics: repoData.topics || [],
          archived: repoData.archived || false,
          disabled: repoData.disabled || false,
          pushedAt: repoData.pushed_at ? new Date(repoData.pushed_at) : undefined,
          lastSync: new Date(),
          isActive: true
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error(`Error syncing repository ${repoData.full_name} to database:`, error);
      throw error;
    }
  }

  async getRepositoriesFromDatabase(companyId: string, filters?: {
    connectionId?: string;
    search?: string;
    language?: string;
    visibility?: 'public' | 'private' | 'all';
  }): Promise<any[]> {
    const query: any = {
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    };

    if (filters?.connectionId) {
      query.connectionId = new mongoose.Types.ObjectId(filters.connectionId);
    }

    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { fullName: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters?.language) {
      query.language = filters.language;
    }

    if (filters?.visibility && filters.visibility !== 'all') {
      query.private = filters.visibility === 'private';
    }

    const repositories = await GitHubRepository.find(query)
      .sort({ pushedAt: -1 })
      .populate('connectionId', 'organizationName username');

    return repositories.map((repo: any) => ({
      id: repo._id.toString(),
      githubId: repo.githubId,
      nodeId: repo.nodeId,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      isPrivate: repo.private,  // Changed from 'private' to 'isPrivate'
      owner: repo.owner,
      htmlUrl: repo.htmlUrl,
      url: repo.htmlUrl,  // Added url field
      language: repo.language,
      starCount: repo.stargazersCount,  // Changed to match frontend
      forkCount: repo.forksCount,       // Changed to match frontend
      watcherCount: repo.watchersCount, // Changed to match frontend
      openIssuesCount: repo.openIssuesCount,
      defaultBranch: repo.defaultBranch,
      topics: repo.topics,
      archived: repo.archived,
      disabled: repo.disabled,
      lastUpdated: repo.pushedAt,  // Changed to match frontend
      lastSync: repo.lastSync,
      connection: {
        id: repo.connectionId._id,
        organization: repo.connectionId.organizationName,
        username: repo.connectionId.username
      }
    }));
  }

  async getRepositoryDetails(connectionId: string, companyId: string, owner: string, repo: string): Promise<any> {
    try {
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      // Sync to database
      await this.syncRepositoryToDatabase(response.data, connectionId, companyId);

      return response.data;
    } catch (error: any) {
      console.error('Error fetching repository details:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch repository details');
    }
  }

  async getRepositoryLanguages(connectionId: string, companyId: string, owner: string, repo: string): Promise<any> {
    try {
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/languages`,
        {
          headers: {
            'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error fetching repository languages:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch repository languages');
    }
  }

  async getRepositoryContributors(connectionId: string, companyId: string, owner: string, repo: string): Promise<any[]> {
    try {
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      const contributors: any[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}/contributors`,
          {
            headers: {
              'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            },
            params: {
              per_page: perPage,
              page
            }
          }
        );

        if (response.data.length === 0) break;
        contributors.push(...response.data);

        if (response.data.length < perPage) break;
        page++;
      }

      return contributors;
    } catch (error: any) {
      console.error('Error fetching repository contributors:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch repository contributors');
    }
  }

  async getRepositoryStats(companyId: string): Promise<any> {
    const stats = await GitHubRepository.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalRepositories: { $sum: 1 },
          publicRepositories: {
            $sum: { $cond: [{ $eq: ['$private', false] }, 1, 0] }
          },
          privateRepositories: {
            $sum: { $cond: [{ $eq: ['$private', true] }, 1, 0] }
          },
          archivedRepositories: {
            $sum: { $cond: [{ $eq: ['$archived', true] }, 1, 0] }
          },
          totalStars: { $sum: '$stargazersCount' },
          totalForks: { $sum: '$forksCount' },
          totalOpenIssues: { $sum: '$openIssuesCount' }
        }
      }
    ]);

    // Get language distribution
    const languageStats = await GitHubRepository.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          isActive: true,
          language: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$language',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    return {
      ...(stats[0] || {
        totalRepositories: 0,
        publicRepositories: 0,
        privateRepositories: 0,
        archivedRepositories: 0,
        totalStars: 0,
        totalForks: 0,
        totalOpenIssues: 0
      }),
      topLanguages: languageStats
    };
  }
}
