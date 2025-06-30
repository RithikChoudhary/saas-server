import { Request, Response } from 'express';
import { CrossPlatformAnalyticsService } from '../services/crossPlatformAnalytics.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class AnalyticsController {
  private analyticsService: CrossPlatformAnalyticsService;

  constructor() {
    this.analyticsService = new CrossPlatformAnalyticsService();
  }

  // GET /api/analytics/dashboard
  async getDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Analytics: Fetching dashboard data...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      // Get all analytics data in parallel
      const [crossPlatformUsers, ghostUsers, securityRisks, licenseWaste] = await Promise.all([
        this.analyticsService.getCrossPlatformUsers(companyId),
        this.analyticsService.getGhostUsers(companyId),
        this.analyticsService.getSecurityRisks(companyId),
        this.analyticsService.getLicenseWaste(companyId)
      ]);

      // Calculate dashboard metrics
      const totalUsers = crossPlatformUsers.length;
      const totalGhostUsers = ghostUsers.length;
      const totalSecurityRisks = securityRisks.length;
      const totalWastedCost = licenseWaste.reduce((sum, user) => sum + user.licenseWaste.wastedCost, 0);
      const totalLicenseCost = crossPlatformUsers.reduce((sum, user) => sum + user.licenseWaste.totalMonthlyCost, 0);

      // Platform breakdown
      const platformBreakdown = {
        googleWorkspace: crossPlatformUsers.filter(u => u.platforms.googleWorkspace).length,
        github: crossPlatformUsers.filter(u => u.platforms.github).length,
        slack: crossPlatformUsers.filter(u => u.platforms.slack).length,
        zoom: crossPlatformUsers.filter(u => u.platforms.zoom).length,
        aws: crossPlatformUsers.filter(u => u.platforms.aws).length
      };

      // Ghost users by platform
      const ghostUsersByPlatform = {
        googleWorkspace: ghostUsers.filter(u => u.ghostStatus.neverLoggedInPlatforms.includes('google-workspace')).length,
        github: ghostUsers.filter(u => u.ghostStatus.neverLoggedInPlatforms.includes('github')).length,
        slack: ghostUsers.filter(u => u.ghostStatus.neverLoggedInPlatforms.includes('slack')).length,
        zoom: ghostUsers.filter(u => u.ghostStatus.neverLoggedInPlatforms.includes('zoom')).length,
        aws: ghostUsers.filter(u => u.ghostStatus.neverLoggedInPlatforms.includes('aws')).length
      };

      // Security risk breakdown
      const securityRiskBreakdown = {
        critical: securityRisks.filter(u => u.securityRisks.riskScore >= 75).length,
        high: securityRisks.filter(u => u.securityRisks.riskScore >= 50 && u.securityRisks.riskScore < 75).length,
        medium: securityRisks.filter(u => u.securityRisks.riskScore >= 25 && u.securityRisks.riskScore < 50).length,
        low: securityRisks.filter(u => u.securityRisks.riskScore > 0 && u.securityRisks.riskScore < 25).length
      };

      // Top recommendations
      const recommendations = [];
      
      if (totalGhostUsers > 0) {
        recommendations.push({
          type: 'cost',
          priority: 'high',
          title: `Remove ${totalGhostUsers} ghost users`,
          description: `Save $${totalWastedCost.toFixed(2)}/month by removing unused licenses`,
          impact: `$${(totalWastedCost * 12).toFixed(2)}/year potential savings`
        });
      }

      if (securityRiskBreakdown.critical > 0) {
        recommendations.push({
          type: 'security',
          priority: 'critical',
          title: `Fix ${securityRiskBreakdown.critical} critical security risks`,
          description: 'Admin users without 2FA and suspended users with active access',
          impact: 'High security vulnerability'
        });
      }

      if (totalLicenseCost > 0) {
        const wastePercentage = ((totalWastedCost / totalLicenseCost) * 100).toFixed(1);
        recommendations.push({
          type: 'cost',
          priority: 'medium',
          title: `${wastePercentage}% license waste detected`,
          description: 'Optimize license allocation across platforms',
          impact: `${wastePercentage}% cost reduction opportunity`
        });
      }

      const dashboardData = {
        overview: {
          totalUsers,
          totalGhostUsers,
          totalSecurityRisks,
          totalWastedCost,
          totalLicenseCost,
          wastePercentage: totalLicenseCost > 0 ? ((totalWastedCost / totalLicenseCost) * 100).toFixed(1) : 0
        },
        platformBreakdown,
        ghostUsersByPlatform,
        securityRiskBreakdown,
        recommendations: recommendations.slice(0, 5), // Top 5 recommendations
        lastUpdated: new Date()
      };

      console.log('✅ Analytics: Dashboard data fetched successfully');
      res.json({
        success: true,
        data: dashboardData
      });

    } catch (error) {
      console.error('❌ Analytics: Dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/analytics/correlate
  async correlateUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Analytics: Starting user correlation...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const correlatedUsers = await this.analyticsService.correlateUsers(companyId);

      console.log('✅ Analytics: User correlation completed');
      res.json({
        success: true,
        message: `Successfully correlated ${correlatedUsers.length} users across platforms`,
        data: {
          totalUsers: correlatedUsers.length,
          ghostUsers: correlatedUsers.filter(u => u.ghostStatus.isGhost).length,
          securityRisks: correlatedUsers.filter(u => u.securityRisks.riskScore > 0).length,
          licenseWaste: correlatedUsers.filter(u => u.licenseWaste.wastedCost > 0).length
        }
      });

    } catch (error) {
      console.error('❌ Analytics: Correlation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to correlate users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/analytics/cross-platform-users
  async getCrossPlatformUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Analytics: Fetching cross-platform users...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const users = await this.analyticsService.getCrossPlatformUsers(companyId);

      console.log('✅ Analytics: Cross-platform users fetched successfully');
      res.json({
        success: true,
        data: users.map(user => ({
          id: user._id,
          email: user.primaryEmail,
          platforms: user.platforms,
          ghostStatus: user.ghostStatus,
          securityRisks: user.securityRisks,
          licenseWaste: user.licenseWaste,
          lastSync: user.lastSync
        }))
      });

    } catch (error) {
      console.error('❌ Analytics: Cross-platform users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch cross-platform users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/analytics/ghost-users
  async getGhostUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Analytics: Fetching ghost users...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const ghostUsers = await this.analyticsService.getGhostUsers(companyId);

      console.log('✅ Analytics: Ghost users fetched successfully');
      res.json({
        success: true,
        data: ghostUsers.map(user => ({
          id: user._id,
          email: user.primaryEmail,
          platforms: user.platforms,
          ghostStatus: user.ghostStatus,
          licenseWaste: user.licenseWaste,
          potentialSavings: user.licenseWaste.wastedCost,
          neverLoggedInPlatforms: user.ghostStatus.neverLoggedInPlatforms,
          inactiveDays: user.ghostStatus.inactiveDays
        }))
      });

    } catch (error) {
      console.error('❌ Analytics: Ghost users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch ghost users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/analytics/security-risks
  async getSecurityRisks(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Analytics: Fetching security risks...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const securityRisks = await this.analyticsService.getSecurityRisks(companyId);

      console.log('✅ Analytics: Security risks fetched successfully');
      res.json({
        success: true,
        data: securityRisks.map(user => ({
          id: user._id,
          email: user.primaryEmail,
          platforms: user.platforms,
          securityRisks: user.securityRisks,
          riskScore: user.securityRisks.riskScore,
          adminWithout2FA: user.securityRisks.adminWithout2FA,
          suspendedWithAccess: user.securityRisks.suspendedWithAccess
        }))
      });

    } catch (error) {
      console.error('❌ Analytics: Security risks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch security risks',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/analytics/license-optimization
  async getLicenseOptimization(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 Analytics: Fetching license optimization data...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const licenseWaste = await this.analyticsService.getLicenseWaste(companyId);

      // Calculate optimization metrics
      const totalWastedCost = licenseWaste.reduce((sum, user) => sum + user.licenseWaste.wastedCost, 0);
      const totalLicenseCost = licenseWaste.reduce((sum, user) => sum + user.licenseWaste.totalMonthlyCost, 0);
      
      // Group by platform
      const platformWaste = {
        googleWorkspace: 0,
        github: 0,
        slack: 0,
        zoom: 0,
        aws: 0
      };

      licenseWaste.forEach(user => {
        user.licenseWaste.recommendations.forEach(rec => {
          if (rec.includes('Google Workspace')) platformWaste.googleWorkspace += 12;
          if (rec.includes('GitHub')) platformWaste.github += 4;
          if (rec.includes('Slack')) platformWaste.slack += 8;
          if (rec.includes('Zoom')) platformWaste.zoom += 15;
        });
      });

      console.log('✅ Analytics: License optimization data fetched successfully');
      res.json({
        success: true,
        data: {
          summary: {
            totalWastedCost,
            totalLicenseCost,
            wastePercentage: totalLicenseCost > 0 ? ((totalWastedCost / totalLicenseCost) * 100).toFixed(1) : 0,
            annualSavingsPotential: totalWastedCost * 12,
            affectedUsers: licenseWaste.length
          },
          platformWaste,
          users: licenseWaste.map(user => ({
            id: user._id,
            email: user.primaryEmail,
            platforms: user.platforms,
            licenseWaste: user.licenseWaste,
            monthlySavings: user.licenseWaste.wastedCost,
            annualSavings: user.licenseWaste.wastedCost * 12,
            recommendations: user.licenseWaste.recommendations
          }))
        }
      });

    } catch (error) {
      console.error('❌ Analytics: License optimization error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch license optimization data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
