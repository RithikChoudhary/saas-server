import mongoose from 'mongoose';
import { CrossPlatformUser, ICrossPlatformUser } from '../../../database/models/analytics';
import { GoogleWorkspaceUser } from '../../../database/models/GoogleWorkspaceUser';
import { GitHubUser } from '../../../database/models/GitHubUser';
import { SlackUser } from '../../../database/models/SlackUser';
import { ZoomUser } from '../../../database/models/ZoomUser';
import { AWSUser } from '../../../database/models/AWSUser';

export class CrossPlatformAnalyticsService {
  
  /**
   * Correlate users across all platforms by email
   */
  async correlateUsers(companyId: string): Promise<ICrossPlatformUser[]> {
    console.log('🔍 Analytics: Starting cross-platform user correlation...');
    
    try {
      // Fetch users from all platforms
      const [googleUsers, githubUsers, slackUsers, zoomUsers, awsUsers] = await Promise.all([
        GoogleWorkspaceUser.find({ companyId: new mongoose.Types.ObjectId(companyId), isActive: true }),
        GitHubUser.find({ companyId: new mongoose.Types.ObjectId(companyId), isActive: true }),
        SlackUser.find({ companyId: new mongoose.Types.ObjectId(companyId), isActive: true }),
        ZoomUser.find({ companyId: new mongoose.Types.ObjectId(companyId), isActive: true }),
        AWSUser.find({ companyId: new mongoose.Types.ObjectId(companyId), isActive: true })
      ]);

      console.log(`📊 Analytics: Found users - Google: ${googleUsers.length}, GitHub: ${githubUsers.length}, Slack: ${slackUsers.length}, Zoom: ${zoomUsers.length}, AWS: ${awsUsers.length}`);

      // Create email-based correlation map
      const userMap = new Map<string, any>();

      // Process Google Workspace users
      googleUsers.forEach(user => {
        const email = user.primaryEmail.toLowerCase();
        if (!userMap.has(email)) {
          userMap.set(email, {
            primaryEmail: email,
            platforms: {}
          });
        }
        userMap.get(email).platforms.googleWorkspace = {
          userId: (user._id as mongoose.Types.ObjectId).toString(),
          lastLogin: user.lastLoginTime,
          isAdmin: user.isAdmin,
          has2FA: user.isEnrolledIn2Sv,
          suspended: user.suspended,
          orgUnitPath: user.orgUnitPath
        };
      });

      // Process GitHub users
      githubUsers.forEach(user => {
        if (!user.email) return; // Skip users without email
        const email = user.email.toLowerCase();
        if (!userMap.has(email)) {
          userMap.set(email, {
            primaryEmail: email,
            platforms: {}
          });
        }
        userMap.get(email).platforms.github = {
          userId: (user._id as mongoose.Types.ObjectId).toString(),
          lastActivity: user.updatedAt, // Use updatedAt as proxy for last activity
          isAdmin: user.siteAdmin, // Use siteAdmin as admin indicator
          suspended: false, // GitHub model doesn't have suspended field
          login: user.login
        };
      });

      // Process Slack users
      slackUsers.forEach(user => {
        if (!user.email) return; // Skip users without email
        const email = user.email.toLowerCase();
        if (!userMap.has(email)) {
          userMap.set(email, {
            primaryEmail: email,
            platforms: {}
          });
        }
        userMap.get(email).platforms.slack = {
          userId: (user._id as mongoose.Types.ObjectId).toString(),
          lastActivity: user.updatedAt, // Use updatedAt as proxy for last activity
          isAdmin: user.isAdmin,
          suspended: user.isDeleted, // Use isDeleted as suspended indicator
          workspaceId: (user.workspaceId as mongoose.Types.ObjectId).toString()
        };
      });

      // Process Zoom users
      zoomUsers.forEach(user => {
        const email = user.email.toLowerCase();
        if (!userMap.has(email)) {
          userMap.set(email, {
            primaryEmail: email,
            platforms: {}
          });
        }
        userMap.get(email).platforms.zoom = {
          userId: (user._id as mongoose.Types.ObjectId).toString(),
          lastLogin: user.lastLoginTime,
          licenseType: user.userType === 2 ? 'Licensed' : user.userType === 1 ? 'Basic' : 'On-prem',
          suspended: user.status !== 'active',
          accountId: user.accountId ? (user.accountId as mongoose.Types.ObjectId).toString() : undefined
        };
      });

      // Process AWS users
      awsUsers.forEach(user => {
        if (!user.email) return; // Skip users without email
        const email = user.email.toLowerCase();
        if (!userMap.has(email)) {
          userMap.set(email, {
            primaryEmail: email,
            platforms: {}
          });
        }
        userMap.get(email).platforms.aws = {
          userId: user._id.toString(),
          lastActivity: user.lastActivity,
          isAdmin: user.policies.some(policy => policy.includes('Admin') || policy.includes('PowerUser')), // Check for admin policies
          suspended: user.status !== 'active',
          accountId: user.accountId
        };
      });

      // Create or update CrossPlatformUser records
      const correlatedUsers: ICrossPlatformUser[] = [];
      
      for (const [email, userData] of userMap) {
        // Calculate ghost status
        const ghostStatus = this.calculateGhostStatus(userData.platforms);
        
        // Calculate security risks
        const securityRisks = this.calculateSecurityRisks(userData.platforms);
        
        // Calculate license waste (basic calculation)
        const licenseWaste = this.calculateLicenseWaste(userData.platforms);

        const crossPlatformUserData = {
          companyId: new mongoose.Types.ObjectId(companyId),
          primaryEmail: email,
          platforms: userData.platforms,
          ghostStatus,
          securityRisks,
          licenseWaste,
          isActive: true,
          lastSync: new Date()
        };

        // Upsert the cross-platform user
        const crossPlatformUser = await CrossPlatformUser.findOneAndUpdate(
          { companyId: new mongoose.Types.ObjectId(companyId), primaryEmail: email },
          crossPlatformUserData,
          { upsert: true, new: true }
        );

        correlatedUsers.push(crossPlatformUser);
      }

      console.log(`✅ Analytics: Successfully correlated ${correlatedUsers.length} users across platforms`);
      return correlatedUsers;

    } catch (error) {
      console.error('❌ Analytics: Error correlating users:', error);
      throw error;
    }
  }

  /**
   * Calculate ghost status for a user across platforms
   */
  private calculateGhostStatus(platforms: any) {
    const neverLoggedInPlatforms: string[] = [];
    let totalInactiveDays = 0;
    let platformCount = 0;

    // Check Google Workspace
    if (platforms.googleWorkspace) {
      platformCount++;
      if (!platforms.googleWorkspace.lastLogin) {
        neverLoggedInPlatforms.push('google-workspace');
      } else {
        const daysSinceLogin = Math.floor((Date.now() - new Date(platforms.googleWorkspace.lastLogin).getTime()) / (1000 * 60 * 60 * 24));
        totalInactiveDays += daysSinceLogin;
      }
    }

    // Check GitHub
    if (platforms.github) {
      platformCount++;
      if (!platforms.github.lastActivity) {
        neverLoggedInPlatforms.push('github');
      } else {
        const daysSinceActivity = Math.floor((Date.now() - new Date(platforms.github.lastActivity).getTime()) / (1000 * 60 * 60 * 24));
        totalInactiveDays += daysSinceActivity;
      }
    }

    // Check Slack
    if (platforms.slack) {
      platformCount++;
      if (!platforms.slack.lastActivity) {
        neverLoggedInPlatforms.push('slack');
      } else {
        const daysSinceActivity = Math.floor((Date.now() - new Date(platforms.slack.lastActivity).getTime()) / (1000 * 60 * 60 * 24));
        totalInactiveDays += daysSinceActivity;
      }
    }

    // Check Zoom
    if (platforms.zoom) {
      platformCount++;
      if (!platforms.zoom.lastLogin) {
        neverLoggedInPlatforms.push('zoom');
      } else {
        const daysSinceLogin = Math.floor((Date.now() - new Date(platforms.zoom.lastLogin).getTime()) / (1000 * 60 * 60 * 24));
        totalInactiveDays += daysSinceLogin;
      }
    }

    // Check AWS
    if (platforms.aws) {
      platformCount++;
      if (!platforms.aws.lastActivity) {
        neverLoggedInPlatforms.push('aws');
      } else {
        const daysSinceActivity = Math.floor((Date.now() - new Date(platforms.aws.lastActivity).getTime()) / (1000 * 60 * 60 * 24));
        totalInactiveDays += daysSinceActivity;
      }
    }

    const averageInactiveDays = platformCount > 0 ? Math.floor(totalInactiveDays / platformCount) : 0;
    const isGhost = neverLoggedInPlatforms.length > 0 || averageInactiveDays > 90;

    return {
      isGhost,
      neverLoggedInPlatforms,
      inactiveDays: averageInactiveDays,
      lastCalculated: new Date()
    };
  }

  /**
   * Calculate security risks for a user across platforms
   */
  private calculateSecurityRisks(platforms: any) {
    const adminWithout2FA: string[] = [];
    const suspendedWithAccess: string[] = [];
    let riskScore = 0;

    // Check Google Workspace security
    if (platforms.googleWorkspace) {
      if (platforms.googleWorkspace.isAdmin && !platforms.googleWorkspace.has2FA) {
        adminWithout2FA.push('google-workspace');
        riskScore += 25;
      }
      if (platforms.googleWorkspace.suspended) {
        // Check if user has access on other platforms
        const hasAccessElsewhere = Object.keys(platforms).some(platform => 
          platform !== 'googleWorkspace' && platforms[platform] && !platforms[platform].suspended
        );
        if (hasAccessElsewhere) {
          suspendedWithAccess.push('google-workspace');
          riskScore += 20;
        }
      }
    }

    // Check GitHub security
    if (platforms.github) {
      if (platforms.github.isAdmin) {
        riskScore += 10; // GitHub admin always has some risk
      }
      if (platforms.github.suspended) {
        const hasAccessElsewhere = Object.keys(platforms).some(platform => 
          platform !== 'github' && platforms[platform] && !platforms[platform].suspended
        );
        if (hasAccessElsewhere) {
          suspendedWithAccess.push('github');
          riskScore += 15;
        }
      }
    }

    // Check other platforms for admin roles
    if (platforms.slack?.isAdmin) riskScore += 10;
    if (platforms.aws?.isAdmin) riskScore += 20;

    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);

    return {
      adminWithout2FA,
      suspendedWithAccess,
      riskScore,
      lastCalculated: new Date()
    };
  }

  /**
   * Calculate license waste for a user across platforms
   */
  private calculateLicenseWaste(platforms: any) {
    let totalMonthlyCost = 0;
    let wastedCost = 0;
    const recommendations: string[] = [];

    // Google Workspace license costs (estimated)
    if (platforms.googleWorkspace) {
      const googleCost = 12; // $12/month for Business Standard
      totalMonthlyCost += googleCost;
      
      if (!platforms.googleWorkspace.lastLogin) {
        wastedCost += googleCost;
        recommendations.push('Remove unused Google Workspace license');
      }
    }

    // GitHub license costs (estimated)
    if (platforms.github) {
      const githubCost = 4; // $4/month for Team
      totalMonthlyCost += githubCost;
      
      if (!platforms.github.lastActivity) {
        wastedCost += githubCost;
        recommendations.push('Remove unused GitHub license');
      }
    }

    // Slack license costs (estimated)
    if (platforms.slack) {
      const slackCost = 8; // $8/month for Pro
      totalMonthlyCost += slackCost;
      
      if (!platforms.slack.lastActivity) {
        wastedCost += slackCost;
        recommendations.push('Remove unused Slack license');
      }
    }

    // Zoom license costs (estimated)
    if (platforms.zoom) {
      const zoomCost = platforms.zoom.licenseType === 'Pro' ? 15 : 20; // $15-20/month
      totalMonthlyCost += zoomCost;
      
      if (!platforms.zoom.lastLogin) {
        wastedCost += zoomCost;
        recommendations.push('Remove unused Zoom license');
      }
    }

    return {
      totalMonthlyCost,
      wastedCost,
      recommendations,
      lastCalculated: new Date()
    };
  }

  /**
   * Get cross-platform users for a company
   */
  async getCrossPlatformUsers(companyId: string): Promise<ICrossPlatformUser[]> {
    try {
      return await CrossPlatformUser.find({ 
        companyId: new mongoose.Types.ObjectId(companyId), 
        isActive: true 
      }).sort({ updatedAt: -1 });
    } catch (error) {
      console.error('❌ Analytics: Error fetching cross-platform users:', error);
      throw error;
    }
  }

  /**
   * Get ghost users for a company
   */
  async getGhostUsers(companyId: string): Promise<ICrossPlatformUser[]> {
    try {
      return await CrossPlatformUser.find({ 
        companyId: new mongoose.Types.ObjectId(companyId), 
        isActive: true,
        'ghostStatus.isGhost': true
      }).sort({ 'ghostStatus.inactiveDays': -1 });
    } catch (error) {
      console.error('❌ Analytics: Error fetching ghost users:', error);
      throw error;
    }
  }

  /**
   * Get users with security risks
   */
  async getSecurityRisks(companyId: string): Promise<ICrossPlatformUser[]> {
    try {
      return await CrossPlatformUser.find({ 
        companyId: new mongoose.Types.ObjectId(companyId), 
        isActive: true,
        'securityRisks.riskScore': { $gt: 0 }
      }).sort({ 'securityRisks.riskScore': -1 });
    } catch (error) {
      console.error('❌ Analytics: Error fetching security risks:', error);
      throw error;
    }
  }

  /**
   * Get license optimization opportunities
   */
  async getLicenseWaste(companyId: string): Promise<ICrossPlatformUser[]> {
    try {
      return await CrossPlatformUser.find({ 
        companyId: new mongoose.Types.ObjectId(companyId), 
        isActive: true,
        'licenseWaste.wastedCost': { $gt: 0 }
      }).sort({ 'licenseWaste.wastedCost': -1 });
    } catch (error) {
      console.error('❌ Analytics: Error fetching license waste:', error);
      throw error;
    }
  }
}
