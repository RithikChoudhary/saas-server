import { ZoomConnection, ZoomUser, ZoomAccount } from '../../../../database/models';
import mongoose from 'mongoose';
import axios from 'axios';
import { ZoomConnectionService } from './zoomConnectionService';

export class ZoomUserService {
  private connectionService: ZoomConnectionService;

  constructor() {
    this.connectionService = new ZoomConnectionService();
  }

  async syncUsers(connectionId: string, companyId: string): Promise<any[]> {
    try {
      const token = await this.connectionService.getDecryptedToken(connectionId, companyId);
      const connection = await this.connectionService.getConnection(connectionId, companyId);

      // Fetch users from Zoom API
      const response = await axios.get('https://api.zoom.us/v2/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          status: 'active',
          page_size: 300
        }
      });

      if (!response.data.users) {
        throw new Error('Failed to fetch users from Zoom API');
      }

      const users = response.data.users;
      const syncedUsers = [];

      for (const user of users) {
        const userData = {
          companyId: new mongoose.Types.ObjectId(companyId),
          connectionId: new mongoose.Types.ObjectId(connectionId),
          zoomUserId: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          displayName: user.display_name || `${user.first_name} ${user.last_name}`,
          userType: user.type, // 1=Basic, 2=Licensed, 3=On-prem
          pmi: user.pmi,
          timezone: user.timezone,
          verified: user.verified || false,
          department: user.dept,
          jobTitle: user.job_title,
          location: user.location,
          phoneNumber: user.phone_number,
          phoneCountry: user.phone_country,
          status: user.status,
          roleId: user.role_id,
          roleName: user.role_name,
          accountId: user.account_id,
          language: user.language,
          loginTypes: user.login_types || [],
          createdAt: user.created_at ? new Date(user.created_at) : new Date(),
          lastLoginTime: user.last_login_time ? new Date(user.last_login_time) : null,
          lastClientVersion: user.last_client_version,
          isActive: user.status === 'active',
          lastSync: new Date()
        };

        const syncedUser = await ZoomUser.findOneAndUpdate(
          {
            companyId: new mongoose.Types.ObjectId(companyId),
            zoomUserId: user.id
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
      await ZoomConnection.findByIdAndUpdate(connectionId, {
        lastSync: new Date()
      });

      return syncedUsers;
    } catch (error) {
      console.error('Zoom user sync error:', error);
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

    const users = await ZoomUser.find(filter)
      .populate('connectionId', 'accountName accountType')
      .sort({ lastName: 1, firstName: 1 });

    return users.map((user: any) => ({
      id: user._id?.toString(),
      zoomUserId: user.zoomUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      userType: user.userType,
      userTypeName: this.getUserTypeName(user.userType),
      pmi: user.pmi,
      timezone: user.timezone,
      verified: user.verified,
      department: user.department,
      jobTitle: user.jobTitle,
      location: user.location,
      phoneNumber: user.phoneNumber,
      phoneCountry: user.phoneCountry,
      status: user.status,
      roleId: user.roleId,
      roleName: user.roleName,
      language: user.language,
      loginTypes: user.loginTypes,
      createdAt: user.createdAt,
      lastLoginTime: user.lastLoginTime,
      lastClientVersion: user.lastClientVersion,
      lastSync: user.lastSync,
      account: user.connectionId && typeof user.connectionId === 'object' ? {
        name: (user.connectionId as any).accountName,
        type: (user.connectionId as any).accountType
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
      basicUsers,
      licensedUsers,
      onPremUsers,
      verifiedUsers,
      activeUsers,
      recentLogins
    ] = await Promise.all([
      ZoomUser.countDocuments(filter),
      ZoomUser.countDocuments({ ...filter, userType: 1 }),
      ZoomUser.countDocuments({ ...filter, userType: 2 }),
      ZoomUser.countDocuments({ ...filter, userType: 3 }),
      ZoomUser.countDocuments({ ...filter, verified: true }),
      ZoomUser.countDocuments({ ...filter, status: 'active' }),
      ZoomUser.countDocuments({ 
        ...filter, 
        lastLoginTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      })
    ]);

    return {
      totalUsers,
      basicUsers,
      licensedUsers,
      onPremUsers,
      verifiedUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      recentLogins,
      licenseUtilization: totalUsers > 0 ? Math.round((licensedUsers / totalUsers) * 100) : 0,
      verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0
    };
  }

  async getUser(userId: string, companyId: string): Promise<any> {
    const user = await ZoomUser.findOne({
      _id: new mongoose.Types.ObjectId(userId),
      companyId: new mongoose.Types.ObjectId(companyId)
    }).populate('connectionId', 'accountName accountType');

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: (user._id as mongoose.Types.ObjectId).toString(),
      zoomUserId: user.zoomUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      userType: user.userType,
      userTypeName: this.getUserTypeName(user.userType),
      pmi: user.pmi,
      timezone: user.timezone,
      verified: user.verified,
      department: user.department,
      jobTitle: user.jobTitle,
      location: user.location,
      phoneNumber: user.phoneNumber,
      phoneCountry: user.phoneCountry,
      status: user.status,
      roleId: user.roleId,
      roleName: user.roleName,
      language: user.language,
      loginTypes: user.loginTypes,
      createdAt: user.createdAt,
      lastLoginTime: user.lastLoginTime,
      lastClientVersion: user.lastClientVersion,
      lastSync: user.lastSync,
      account: user.connectionId && typeof user.connectionId === 'object' ? {
        name: (user.connectionId as any).accountName,
        type: (user.connectionId as any).accountType
      } : null
    };
  }

  async syncAllConnections(companyId: string): Promise<void> {
    const connections = await ZoomConnection.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    });

    for (const connection of connections) {
      try {
        await this.syncUsers((connection._id as mongoose.Types.ObjectId).toString(), companyId);
        console.log(`✅ Synced users for Zoom account: ${connection.accountName}`);
      } catch (error) {
        console.error(`❌ Failed to sync users for account ${connection.accountName}:`, error);
      }
    }
  }

  async getInactiveUsers(companyId: string, inactiveDays: number = 90): Promise<any[]> {
    const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
    
    const inactiveUsers = await ZoomUser.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true,
      $or: [
        { lastLoginTime: { $lt: cutoffDate } },
        { lastLoginTime: null }
      ]
    }).populate('connectionId', 'accountName accountType');

    return inactiveUsers.map((user: any) => ({
      id: user._id.toString(),
      zoomUserId: user.zoomUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      userType: user.userType,
      userTypeName: this.getUserTypeName(user.userType),
      department: user.department,
      jobTitle: user.jobTitle,
      lastLoginTime: user.lastLoginTime,
      daysSinceLogin: user.lastLoginTime ? 
        Math.floor((Date.now() - user.lastLoginTime.getTime()) / (24 * 60 * 60 * 1000)) : 
        null,
      account: user.connectionId && typeof user.connectionId === 'object' ? {
        name: (user.connectionId as any).accountName,
        type: (user.connectionId as any).accountType
      } : null
    }));
  }

  async getLicenseOptimization(companyId: string): Promise<any> {
    const stats = await this.getUserStats(companyId);
    
    // Calculate potential savings
    const unusedLicenses = stats.licensedUsers - stats.recentLogins;
    const potentialSavings = Math.max(0, unusedLicenses);
    
    // Get inactive licensed users
    const inactiveLicensedUsers = await ZoomUser.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true,
      userType: 2, // Licensed users
      $or: [
        { lastLoginTime: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        { lastLoginTime: null }
      ]
    }).select('email firstName lastName lastLoginTime');

    return {
      totalLicenses: stats.licensedUsers,
      activeLicenses: stats.recentLogins,
      unusedLicenses: potentialSavings,
      utilizationRate: stats.licenseUtilization,
      inactiveLicensedUsers: inactiveLicensedUsers.map((user: any) => ({
        id: user._id.toString(),
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        lastLogin: user.lastLoginTime,
        daysSinceLogin: user.lastLoginTime ? 
          Math.floor((Date.now() - user.lastLoginTime.getTime()) / (24 * 60 * 60 * 1000)) : 
          null
      })),
      recommendations: this.generateLicenseRecommendations(stats, potentialSavings)
    };
  }

  private getUserTypeName(userType: number): string {
    switch (userType) {
      case 1: return 'Basic';
      case 2: return 'Licensed';
      case 3: return 'On-Premise';
      default: return 'Unknown';
    }
  }

  private generateLicenseRecommendations(stats: any, unusedLicenses: number): string[] {
    const recommendations = [];

    if (unusedLicenses > 0) {
      recommendations.push(`Consider downgrading ${unusedLicenses} unused licensed users to basic accounts`);
    }

    if (stats.verificationRate < 80) {
      recommendations.push('Encourage users to verify their accounts for better security');
    }

    if (stats.licenseUtilization < 70) {
      recommendations.push('Review license allocation - utilization is below 70%');
    }

    if (stats.recentLogins / stats.totalUsers < 0.5) {
      recommendations.push('Many users haven\'t logged in recently - consider user engagement initiatives');
    }

    return recommendations;
  }
}
