import { GitHubUser, GitHubConnection } from '../../../../database/models';
import mongoose from 'mongoose';
import axios from 'axios';
import { GitHubConnectionService } from './githubConnectionService';

export class GitHubUsersService {
  private connectionService: GitHubConnectionService;

  constructor() {
    this.connectionService = new GitHubConnectionService();
  }

  /**
   * Make a GitHub API request with retry logic and rate limiting
   */
  private async makeGitHubRequest(url: string, headers: any, params?: any, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, { 
          headers,
          params,
          timeout: 10000 // 10 second timeout
        });
        return response;
      } catch (error: any) {
        console.log(`🔄 GitHub API: Attempt ${i + 1}/${retries} failed for ${url}`);
        
        if (error.response?.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          // Handle rate limiting
          const resetTime = parseInt(error.response.headers['x-ratelimit-reset']) * 1000;
          const waitTime = Math.max(resetTime - Date.now(), 0) + 1000; // Add 1 second buffer
          
          if (waitTime > 0 && waitTime < 300000) { // Don't wait more than 5 minutes
            console.log(`⏳ GitHub API: Rate limited, waiting ${Math.round(waitTime / 1000)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        if (error.response?.status === 401) {
          throw new Error('GitHub authentication failed. Please check your token.');
        }
        
        if (error.response?.status === 404) {
          throw new Error('GitHub resource not found. Please check permissions.');
        }
        
        if (i === retries - 1) {
          throw error;
        }
        
        // Exponential backoff for other errors
        const backoffTime = Math.min(1000 * Math.pow(2, i), 10000);
        console.log(`⏳ GitHub API: Retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  async syncUsersFromGitHub(connectionId: string, companyId: string): Promise<any> {
    try {
      console.log('🔍 GitHub Users: Starting sync from GitHub...');
      
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      let users: any[] = [];

      if (connection.scope === 'organization' && connection.organizationName) {
        // Sync organization members
        users = await this.getOrganizationMembers(connection.organizationName, token, connection.connectionType);
      } else {
        // For user scope, just sync the authenticated user
        const user = await this.getAuthenticatedUser(token, connection.connectionType);
        users = [user];
      }

      // Mark existing users as inactive
      await GitHubUser.updateMany(
        { connectionId, companyId: new mongoose.Types.ObjectId(companyId) },
        { isActive: false }
      );

      // Sync users to database
      let syncedCount = 0;
      for (const userData of users) {
        await this.syncUserToDatabase(userData, connectionId, companyId);
        syncedCount++;
      }

      console.log(`✅ GitHub Users sync completed: ${syncedCount} users synced`);
      return { syncedCount };
    } catch (error) {
      console.error('❌ GitHub Users sync error:', error);
      throw error;
    }
  }

  private async getOrganizationMembers(org: string, token: string, tokenType: string): Promise<any[]> {
    try {
      console.log(`🔍 GitHub Users: Fetching organization members for ${org}`);
      console.log(`🔍 GitHub Users: Token type: ${tokenType}`);
      
      const members: any[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        console.log(`📄 GitHub Users: Fetching page ${page} of organization members`);
        
        try {
          const response = await this.makeGitHubRequest(
            `https://api.github.com/orgs/${org}/members`,
            {
              'Authorization': `${tokenType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'SaaS-Management-Platform'
            },
            {
              per_page: perPage,
              page
            }
          );

          console.log(`✅ GitHub Users: Received ${response.data.length} members on page ${page}`);

          if (response.data.length === 0) break;

          // For each member, get detailed info with rate limiting
          for (const member of response.data) {
            try {
              const userDetails = await this.getUserDetails(member.login, token, tokenType);
              members.push(userDetails);
              
              // Add small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (userError) {
              console.warn(`⚠️ GitHub Users: Failed to get details for user ${member.login}:`, userError);
              // Add basic member info even if detailed fetch fails
              members.push({
                id: member.id,
                login: member.login,
                avatar_url: member.avatar_url,
                type: member.type,
                site_admin: member.site_admin || false,
                email: null, // Will be null for failed detailed fetches
                name: member.login
              });
            }
          }

          if (response.data.length < perPage) break;
          page++;
        } catch (pageError: any) {
          console.error(`❌ GitHub Users: Error fetching page ${page}:`, pageError);
          if (pageError.response?.status === 403) {
            console.error('❌ GitHub Users: Rate limit or permission error, stopping pagination');
            break;
          }
          throw pageError;
        }
      }

      return members;
    } catch (error: any) {
      console.error('❌ GitHub Users: Error fetching organization members:', error);
      if (error.response?.status === 404) {
        throw new Error(`Organization '${org}' not found or access denied`);
      } else if (error.response?.status === 403) {
        throw new Error('Insufficient permissions to access organization members');
      }
      throw error;
    }
  }

  private async getAuthenticatedUser(token: string, tokenType: string): Promise<any> {
    try {
      const response = await this.makeGitHubRequest(
        'https://api.github.com/user',
        {
          'Authorization': `${tokenType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SaaS-Management-Platform'
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching authenticated user:', error);
      throw error;
    }
  }

  private async getUserDetails(username: string, token: string, tokenType: string): Promise<any> {
    try {
      const response = await this.makeGitHubRequest(
        `https://api.github.com/users/${username}`,
        {
          'Authorization': `${tokenType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SaaS-Management-Platform'
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error fetching user details for ${username}:`, error);
      throw error;
    }
  }

  private async syncUserToDatabase(userData: any, connectionId: string, companyId: string): Promise<void> {
    try {
      await GitHubUser.findOneAndUpdate(
        {
          githubId: userData.id,
          companyId: new mongoose.Types.ObjectId(companyId)
        },
        {
          connectionId: new mongoose.Types.ObjectId(connectionId),
          login: userData.login,
          email: userData.email,
          name: userData.name,
          avatarUrl: userData.avatar_url,
          type: userData.type,
          siteAdmin: userData.site_admin || false,
          company: userData.company,
          location: userData.location,
          bio: userData.bio,
          publicRepos: userData.public_repos || 0,
          followers: userData.followers || 0,
          following: userData.following || 0,
          lastSync: new Date(),
          isActive: true
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error(`Error syncing user ${userData.login} to database:`, error);
      throw error;
    }
  }

  async getUsersFromDatabase(companyId: string, filters?: {
    connectionId?: string;
    search?: string;
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
        { login: { $regex: filters.search, $options: 'i' } },
        { name: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const users = await GitHubUser.find(query)
      .sort({ login: 1 })
      .populate('connectionId', 'organizationName username');

    return users.map((user: any) => ({
      id: user._id.toString(),
      githubId: user.githubId,
      login: user.login,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      type: user.type,
      siteAdmin: user.siteAdmin,
      company: user.company,
      location: user.location,
      bio: user.bio,
      publicRepos: user.publicRepos,
      followers: user.followers,
      following: user.following,
      lastSync: user.lastSync,
      connection: {
        id: user.connectionId._id,
        organization: user.connectionId.organizationName,
        username: user.connectionId.username
      }
    }));
  }

  async inviteUser(connectionId: string, companyId: string, username: string): Promise<any> {
    try {
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      if (connection.scope !== 'organization' || !connection.organizationName) {
        throw new Error('Can only invite users to organizations');
      }

      // Send invitation via GitHub API
      const response = await axios.put(
        `https://api.github.com/orgs/${connection.organizationName}/memberships/${username}`,
        { role: 'member' },
        {
          headers: {
            'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      // Fetch user details and sync to database
      const userDetails = await this.getUserDetails(username, token, connection.connectionType);
      await this.syncUserToDatabase(userDetails, connectionId, companyId);

      return {
        success: true,
        user: userDetails,
        membership: response.data
      };
    } catch (error: any) {
      console.error('Error inviting user:', error);
      throw new Error(error.response?.data?.message || 'Failed to invite user');
    }
  }

  async removeUser(connectionId: string, companyId: string, username: string): Promise<void> {
    try {
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      if (connection.scope !== 'organization' || !connection.organizationName) {
        throw new Error('Can only remove users from organizations');
      }

      // Remove from GitHub
      await axios.delete(
        `https://api.github.com/orgs/${connection.organizationName}/members/${username}`,
        {
          headers: {
            'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      // Mark as inactive in database
      await GitHubUser.updateOne(
        {
          login: username,
          companyId: new mongoose.Types.ObjectId(companyId),
          connectionId: new mongoose.Types.ObjectId(connectionId)
        },
        { isActive: false }
      );
    } catch (error: any) {
      console.error('Error removing user:', error);
      throw new Error(error.response?.data?.message || 'Failed to remove user');
    }
  }

  async getUserStats(companyId: string): Promise<any> {
    const stats = await GitHubUser.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          adminUsers: {
            $sum: { $cond: [{ $eq: ['$siteAdmin', true] }, 1, 0] }
          },
          botUsers: {
            $sum: { $cond: [{ $eq: ['$type', 'Bot'] }, 1, 0] }
          }
        }
      }
    ]);

    return stats[0] || {
      totalUsers: 0,
      adminUsers: 0,
      botUsers: 0
    };
  }
}
