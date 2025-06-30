import { GitHubTeam, GitHubTeamMember, GitHubUser } from '../../../../database/models';
import mongoose from 'mongoose';
import axios from 'axios';
import { GitHubConnectionService } from './githubConnectionService';

export class GitHubTeamsService {
  private connectionService: GitHubConnectionService;

  constructor() {
    this.connectionService = new GitHubConnectionService();
  }

  async syncTeamsFromGitHub(connectionId: string, companyId: string): Promise<any> {
    try {
      console.log('🔍 GitHub Teams: Starting sync from GitHub...');
      
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      if (connection.scope !== 'organization' || !connection.organizationName) {
        throw new Error('Teams are only available for organization connections');
      }

      // Mark existing teams as inactive
      await GitHubTeam.updateMany(
        { connectionId, companyId: new mongoose.Types.ObjectId(companyId) },
        { isActive: false }
      );

      // Mark existing team members as inactive
      await GitHubTeamMember.updateMany(
        { companyId: new mongoose.Types.ObjectId(companyId) },
        { isActive: false }
      );

      // Sync teams
      const teams = await this.getOrganizationTeams(connection.organizationName, token, connection.connectionType);
      
      let syncedCount = 0;
      for (const teamData of teams) {
        const team = await this.syncTeamToDatabase(teamData, connectionId, companyId, connection.organizationName);
        
        // Sync team members
        await this.syncTeamMembers(team._id.toString(), teamData.slug, connection.organizationName, token, connection.connectionType, companyId);
        
        syncedCount++;
      }

      console.log(`✅ GitHub Teams sync completed: ${syncedCount} teams synced`);
      return { syncedCount };
    } catch (error) {
      console.error('❌ GitHub Teams sync error:', error);
      throw error;
    }
  }

  private async getOrganizationTeams(org: string, token: string, tokenType: string): Promise<any[]> {
    try {
      const teams: any[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await axios.get(
          `https://api.github.com/orgs/${org}/teams`,
          {
            headers: {
              'Authorization': `${tokenType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            },
            params: {
              per_page: perPage,
              page
            }
          }
        );

        if (response.data.length === 0) break;
        teams.push(...response.data);

        if (response.data.length < perPage) break;
        page++;
      }

      return teams;
    } catch (error) {
      console.error('Error fetching organization teams:', error);
      throw error;
    }
  }

  private async syncTeamToDatabase(teamData: any, connectionId: string, companyId: string, organization: string): Promise<any> {
    try {
      return await GitHubTeam.findOneAndUpdate(
        {
          githubId: teamData.id,
          companyId: new mongoose.Types.ObjectId(companyId)
        },
        {
          connectionId: new mongoose.Types.ObjectId(connectionId),
          nodeId: teamData.node_id,
          slug: teamData.slug,
          name: teamData.name,
          description: teamData.description,
          privacy: teamData.privacy,
          permission: teamData.permission,
          membersCount: teamData.members_count || 0,
          reposCount: teamData.repos_count || 0,
          organization,
          parentTeamId: teamData.parent?.id,
          lastSync: new Date(),
          isActive: true
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error(`Error syncing team ${teamData.name} to database:`, error);
      throw error;
    }
  }

  private async syncTeamMembers(teamId: string, teamSlug: string, org: string, token: string, tokenType: string, companyId: string): Promise<void> {
    try {
      const members = await this.getTeamMembers(teamSlug, org, token, tokenType);
      
      for (const member of members) {
        // Find the user in our database
        const user = await GitHubUser.findOne({
          githubId: member.id,
          companyId: new mongoose.Types.ObjectId(companyId),
          isActive: true
        });

        if (user) {
          await GitHubTeamMember.findOneAndUpdate(
            {
              teamId: new mongoose.Types.ObjectId(teamId),
              userId: user._id,
              companyId: new mongoose.Types.ObjectId(companyId)
            },
            {
              role: member.role || 'member',
              addedAt: new Date(),
              isActive: true
            },
            { upsert: true, new: true }
          );
        }
      }
    } catch (error) {
      console.error(`Error syncing team members for team ${teamSlug}:`, error);
    }
  }

  private async getTeamMembers(teamSlug: string, org: string, token: string, tokenType: string): Promise<any[]> {
    try {
      const members: any[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await axios.get(
          `https://api.github.com/orgs/${org}/teams/${teamSlug}/members`,
          {
            headers: {
              'Authorization': `${tokenType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            },
            params: {
              per_page: perPage,
              page,
              role: 'all' // Get both members and maintainers
            }
          }
        );

        if (response.data.length === 0) break;
        
        // Get role for each member
        for (const member of response.data) {
          const roleResponse = await axios.get(
            `https://api.github.com/orgs/${org}/teams/${teamSlug}/memberships/${member.login}`,
            {
              headers: {
                'Authorization': `${tokenType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }
          );
          
          members.push({
            ...member,
            role: roleResponse.data.role
          });
        }

        if (response.data.length < perPage) break;
        page++;
      }

      return members;
    } catch (error) {
      console.error('Error fetching team members:', error);
      return [];
    }
  }

  async getTeamsFromDatabase(companyId: string, filters?: {
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
        { name: { $regex: filters.search, $options: 'i' } },
        { slug: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const teams = await GitHubTeam.find(query)
      .sort({ name: 1 })
      .populate('connectionId', 'organizationName');

    // Get member counts
    const teamsWithMembers = await Promise.all(
      teams.map(async (team: any) => {
        const memberCount = await GitHubTeamMember.countDocuments({
          teamId: team._id,
          isActive: true
        });

        return {
          id: team._id.toString(),
          githubId: team.githubId,
          nodeId: team.nodeId,
          slug: team.slug,
          name: team.name,
          description: team.description,
          privacy: team.privacy,
          permission: team.permission,
          membersCount: memberCount,
          reposCount: team.reposCount,
          organization: team.organization,
          parentTeamId: team.parentTeamId,
          lastSync: team.lastSync,
          connection: {
            id: team.connectionId._id,
            organization: team.connectionId.organizationName
          }
        };
      })
    );

    return teamsWithMembers;
  }

  async getTeamMembersFromDatabase(teamId: string, companyId: string): Promise<any[]> {
    const members = await GitHubTeamMember.find({
      teamId: new mongoose.Types.ObjectId(teamId),
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    }).populate('userId');

    return members.map((member: any) => ({
      id: member._id.toString(),
      role: member.role,
      addedAt: member.addedAt,
      user: {
        id: member.userId._id,
        githubId: member.userId.githubId,
        login: member.userId.login,
        name: member.userId.name,
        email: member.userId.email,
        avatarUrl: member.userId.avatarUrl,
        type: member.userId.type
      }
    }));
  }

  async createTeam(connectionId: string, companyId: string, teamData: {
    name: string;
    description?: string;
    privacy?: 'closed' | 'secret';
    parentTeamId?: number;
  }): Promise<any> {
    try {
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      if (connection.scope !== 'organization' || !connection.organizationName) {
        throw new Error('Can only create teams in organizations');
      }

      const response = await axios.post(
        `https://api.github.com/orgs/${connection.organizationName}/teams`,
        {
          name: teamData.name,
          description: teamData.description,
          privacy: teamData.privacy || 'closed',
          parent_team_id: teamData.parentTeamId
        },
        {
          headers: {
            'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      // Sync to database
      const team = await this.syncTeamToDatabase(response.data, connectionId, companyId, connection.organizationName);

      return {
        success: true,
        team
      };
    } catch (error: any) {
      console.error('Error creating team:', error);
      throw new Error(error.response?.data?.message || 'Failed to create team');
    }
  }

  async updateTeam(connectionId: string, companyId: string, teamSlug: string, updates: {
    name?: string;
    description?: string;
    privacy?: 'closed' | 'secret';
  }): Promise<any> {
    try {
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      if (connection.scope !== 'organization' || !connection.organizationName) {
        throw new Error('Can only update teams in organizations');
      }

      const response = await axios.patch(
        `https://api.github.com/orgs/${connection.organizationName}/teams/${teamSlug}`,
        updates,
        {
          headers: {
            'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      // Update in database
      await GitHubTeam.findOneAndUpdate(
        {
          slug: teamSlug,
          companyId: new mongoose.Types.ObjectId(companyId),
          connectionId: new mongoose.Types.ObjectId(connectionId)
        },
        {
          name: response.data.name,
          description: response.data.description,
          privacy: response.data.privacy,
          lastSync: new Date()
        }
      );

      return {
        success: true,
        team: response.data
      };
    } catch (error: any) {
      console.error('Error updating team:', error);
      throw new Error(error.response?.data?.message || 'Failed to update team');
    }
  }

  async deleteTeam(connectionId: string, companyId: string, teamSlug: string): Promise<void> {
    try {
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      if (connection.scope !== 'organization' || !connection.organizationName) {
        throw new Error('Can only delete teams in organizations');
      }

      await axios.delete(
        `https://api.github.com/orgs/${connection.organizationName}/teams/${teamSlug}`,
        {
          headers: {
            'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      // Mark as inactive in database
      const team = await GitHubTeam.findOneAndUpdate(
        {
          slug: teamSlug,
          companyId: new mongoose.Types.ObjectId(companyId),
          connectionId: new mongoose.Types.ObjectId(connectionId)
        },
        { isActive: false }
      );

      // Mark team members as inactive
      if (team) {
        await GitHubTeamMember.updateMany(
          { teamId: team._id },
          { isActive: false }
        );
      }
    } catch (error: any) {
      console.error('Error deleting team:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete team');
    }
  }

  async addTeamMember(connectionId: string, companyId: string, teamSlug: string, username: string, role: 'member' | 'maintainer' = 'member'): Promise<void> {
    try {
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      if (connection.scope !== 'organization' || !connection.organizationName) {
        throw new Error('Can only manage team members in organizations');
      }

      await axios.put(
        `https://api.github.com/orgs/${connection.organizationName}/teams/${teamSlug}/memberships/${username}`,
        { role },
        {
          headers: {
            'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      // Update in database
      const team = await GitHubTeam.findOne({
        slug: teamSlug,
        companyId: new mongoose.Types.ObjectId(companyId),
        connectionId: new mongoose.Types.ObjectId(connectionId),
        isActive: true
      });

      const user = await GitHubUser.findOne({
        login: username,
        companyId: new mongoose.Types.ObjectId(companyId),
        isActive: true
      });

      if (team && user) {
        await GitHubTeamMember.findOneAndUpdate(
          {
            teamId: team._id,
            userId: user._id,
            companyId: new mongoose.Types.ObjectId(companyId)
          },
          {
            role,
            addedAt: new Date(),
            isActive: true
          },
          { upsert: true }
        );
      }
    } catch (error: any) {
      console.error('Error adding team member:', error);
      throw new Error(error.response?.data?.message || 'Failed to add team member');
    }
  }

  async removeTeamMember(connectionId: string, companyId: string, teamSlug: string, username: string): Promise<void> {
    try {
      const connection = await this.connectionService.getConnection(connectionId, companyId);
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);

      if (connection.scope !== 'organization' || !connection.organizationName) {
        throw new Error('Can only manage team members in organizations');
      }

      await axios.delete(
        `https://api.github.com/orgs/${connection.organizationName}/teams/${teamSlug}/memberships/${username}`,
        {
          headers: {
            'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      // Update in database
      const team = await GitHubTeam.findOne({
        slug: teamSlug,
        companyId: new mongoose.Types.ObjectId(companyId),
        connectionId: new mongoose.Types.ObjectId(connectionId),
        isActive: true
      });

      const user = await GitHubUser.findOne({
        login: username,
        companyId: new mongoose.Types.ObjectId(companyId),
        isActive: true
      });

      if (team && user) {
        await GitHubTeamMember.findOneAndUpdate(
          {
            teamId: team._id,
            userId: user._id,
            companyId: new mongoose.Types.ObjectId(companyId)
          },
          { isActive: false }
        );
      }
    } catch (error: any) {
      console.error('Error removing team member:', error);
      throw new Error(error.response?.data?.message || 'Failed to remove team member');
    }
  }

  async getTeamStats(companyId: string): Promise<any> {
    const stats = await GitHubTeam.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalTeams: { $sum: 1 },
          totalMembers: { $sum: '$membersCount' },
          totalRepos: { $sum: '$reposCount' }
        }
      }
    ]);

    return stats[0] || {
      totalTeams: 0,
      totalMembers: 0,
      totalRepos: 0
    };
  }
}
