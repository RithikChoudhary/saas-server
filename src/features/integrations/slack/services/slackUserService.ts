import { SlackConnection, SlackUser, SlackWorkspace } from '../../../../database/models';
import mongoose from 'mongoose';
import axios from 'axios';
import { SlackConnectionService } from './slackConnectionService';

export class SlackUserService {
  private connectionService: SlackConnectionService;

  constructor() {
    this.connectionService = new SlackConnectionService();
  }

  async syncUsers(connectionId: string, companyId: string): Promise<any[]> {
    try {
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);
      const connection = await this.connectionService.getConnection(connectionId, companyId);

      // Fetch users from Slack API
      const response = await axios.get('https://slack.com/api/users.list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Failed to fetch users');
      }

      const users = response.data.members;
      const syncedUsers = [];

      for (const user of users) {
        // Skip bots and deleted users unless specifically requested
        if (user.deleted || (user.is_bot && !user.is_app_user)) {
          continue;
        }

        const userData = {
          companyId: new mongoose.Types.ObjectId(companyId),
          connectionId: new mongoose.Types.ObjectId(connectionId),
          slackId: user.id,
          teamId: user.team_id,
          name: user.name,
          realName: user.real_name || user.name,
          displayName: user.profile?.display_name || user.real_name || user.name,
          email: user.profile?.email,
          phone: user.profile?.phone,
          title: user.profile?.title,
          department: user.profile?.fields?.department?.value,
          avatar: user.profile?.image_192 || user.profile?.image_72,
          timezone: user.tz,
          timezoneLabel: user.tz_label,
          timezoneOffset: user.tz_offset,
          isAdmin: user.is_admin || false,
          isOwner: user.is_owner || false,
          isPrimaryOwner: user.is_primary_owner || false,
          isRestricted: user.is_restricted || false,
          isUltraRestricted: user.is_ultra_restricted || false,
          isBot: user.is_bot || false,
          isAppUser: user.is_app_user || false,
          isDeleted: user.deleted || false,
          has2FA: user.has_2fa || false,
          lastActiveAt: user.updated ? new Date(user.updated * 1000) : null,
          isActive: !user.deleted,
          lastSync: new Date()
        };

        const syncedUser = await SlackUser.findOneAndUpdate(
          {
            companyId: new mongoose.Types.ObjectId(companyId),
            slackId: user.id
          },
          userData,
          {
            upsert: true,
            new: true
          }
        );

        syncedUsers.push(syncedUser);
      }

      // Update connection last sync
      await SlackConnection.findByIdAndUpdate(connectionId, {
        lastSync: new Date()
      });

      return syncedUsers;
    } catch (error) {
      console.error('Slack user sync error:', error);
      throw error;
    }
  }

  async getUsers(companyId: string, connectionId?: string): Promise<any[]> {
    const filter: any = {
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    };

    if (connectionId) {
      filter.connectionId = new mongoose.Types.ObjectId(connectionId);
    }

    const users = await SlackUser.find(filter)
      .populate('connectionId', 'workspaceName workspaceDomain')
      .sort({ realName: 1 });

    return users.map((user: any) => ({
      id: user._id?.toString(),
      slackId: user.slackId,
      name: user.name,
      realName: user.realName,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      title: user.title,
      department: user.department,
      avatar: user.avatar,
      timezone: user.timezone,
      timezoneLabel: user.timezoneLabel,
      isAdmin: user.isAdmin,
      isOwner: user.isOwner,
      isPrimaryOwner: user.isPrimaryOwner,
      isRestricted: user.isRestricted,
      isUltraRestricted: user.isUltraRestricted,
      isBot: user.isBot,
      isAppUser: user.isAppUser,
      has2FA: user.has2FA,
      lastActiveAt: user.lastActiveAt,
      lastSync: user.lastSync,
      workspace: user.connectionId && typeof user.connectionId === 'object' ? {
        name: (user.connectionId as any).workspaceName,
        domain: (user.connectionId as any).workspaceDomain
      } : null
    }));
  }

  async getUserStats(companyId: string, connectionId?: string): Promise<any> {
    const filter: any = {
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    };

    if (connectionId) {
      filter.connectionId = new mongoose.Types.ObjectId(connectionId);
    }

    const [
      totalUsers,
      adminUsers,
      botUsers,
      restrictedUsers,
      users2FA,
      activeUsers
    ] = await Promise.all([
      SlackUser.countDocuments(filter),
      SlackUser.countDocuments({ ...filter, isAdmin: true }),
      SlackUser.countDocuments({ ...filter, isBot: true }),
      SlackUser.countDocuments({ ...filter, $or: [{ isRestricted: true }, { isUltraRestricted: true }] }),
      SlackUser.countDocuments({ ...filter, has2FA: true }),
      SlackUser.countDocuments({ 
        ...filter, 
        lastActiveAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Active in last 30 days
      })
    ]);

    return {
      totalUsers,
      adminUsers,
      botUsers,
      restrictedUsers,
      users2FA,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      twoFactorPercentage: totalUsers > 0 ? Math.round((users2FA / totalUsers) * 100) : 0
    };
  }

  async getUser(userId: string, companyId: string): Promise<any> {
    const user = await SlackUser.findOne({
      _id: new mongoose.Types.ObjectId(userId),
      companyId: new mongoose.Types.ObjectId(companyId)
    }).populate('connectionId', 'workspaceName workspaceDomain');

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: (user._id as mongoose.Types.ObjectId).toString(),
      slackId: user.slackId,
      name: user.name,
      realName: user.realName,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      title: user.title,
      department: user.department,
      avatar: user.avatar,
      timezone: user.timezone,
      timezoneLabel: user.timezoneLabel,
      timezoneOffset: user.timezoneOffset,
      isAdmin: user.isAdmin,
      isOwner: user.isOwner,
      isPrimaryOwner: user.isPrimaryOwner,
      isRestricted: user.isRestricted,
      isUltraRestricted: user.isUltraRestricted,
      isBot: user.isBot,
      isAppUser: user.isAppUser,
      has2FA: user.has2FA,
      lastActiveAt: user.lastActiveAt,
      lastSync: user.lastSync,
      workspace: user.connectionId && typeof user.connectionId === 'object' ? {
        name: (user.connectionId as any).workspaceName,
        domain: (user.connectionId as any).workspaceDomain
      } : null
    };
  }

  async syncAllConnections(companyId: string): Promise<void> {
    const connections = await SlackConnection.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    });

    for (const connection of connections) {
      try {
        await this.syncUsers((connection._id as mongoose.Types.ObjectId).toString(), companyId);
        console.log(`✅ Synced users for Slack workspace: ${connection.workspaceName}`);
      } catch (error) {
        console.error(`❌ Failed to sync users for workspace ${connection.workspaceName}:`, error);
      }
    }
  }

  async getGhostUsers(companyId: string, inactiveDays: number = 90): Promise<any[]> {
    const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
    
    const ghostUsers = await SlackUser.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true,
      isBot: false,
      $or: [
        { lastActiveAt: { $lt: cutoffDate } },
        { lastActiveAt: null }
      ]
    }).populate('connectionId', 'workspaceName workspaceDomain');

    return ghostUsers.map((user: any) => ({
      id: user._id.toString(),
      slackId: user.slackId,
      name: user.name,
      realName: user.realName,
      displayName: user.displayName,
      email: user.email,
      title: user.title,
      department: user.department,
      lastActiveAt: user.lastActiveAt,
      daysSinceActive: user.lastActiveAt ? 
        Math.floor((Date.now() - user.lastActiveAt.getTime()) / (24 * 60 * 60 * 1000)) : 
        null,
      workspace: user.connectionId ? {
        name: user.connectionId.workspaceName,
        domain: user.connectionId.workspaceDomain
      } : null
    }));
  }
}
