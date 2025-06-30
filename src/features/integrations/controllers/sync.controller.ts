import { Request, Response } from 'express';
import { User, App, UserAppAccess, CompanyApp } from '../../../database/models';

// Mock external API integrations (replace with real APIs)
const mockExternalAPIs = {
  aws: {
    async getUsers(credentials: any) {
      // Mock AWS IAM users
      return [
        { UserId: 'aws-user-1', UserName: 'john.doe@company.com', CreateDate: new Date() },
        { UserId: 'aws-user-2', UserName: 'jane.smith@company.com', CreateDate: new Date() }
      ];
    },
    async createUser(userData: any, credentials: any) {
      return { UserId: `aws-${Date.now()}`, UserName: userData.email };
    }
  },
  slack: {
    async getUsers(token: string) {
      // Mock Slack users
      return [
        { id: 'slack-user-1', profile: { email: 'john.doe@company.com', real_name: 'John Doe' } },
        { id: 'slack-user-2', profile: { email: 'jane.smith@company.com', real_name: 'Jane Smith' } }
      ];
    },
    async inviteUser(userData: any, token: string) {
      return { user: { id: `slack-${Date.now()}`, email: userData.email } };
    }
  },
  google: {
    async getUsers(credentials: any) {
      // Mock Google Workspace users
      return [
        { id: 'google-user-1', primaryEmail: 'john.doe@company.com', name: { fullName: 'John Doe' } },
        { id: 'google-user-2', primaryEmail: 'jane.smith@company.com', name: { fullName: 'Jane Smith' } }
      ];
    },
    async createUser(userData: any, credentials: any) {
      return { id: `google-${Date.now()}`, primaryEmail: userData.email };
    }
  }
};

export const syncAllApps = async (req: Request, res: Response): Promise<void> => {
  try {
    let { companyId } = req.user!;

    // Fix: Extract ObjectId from company object if needed
    if (typeof companyId === 'string' && companyId.includes('_id')) {
      try {
        const companyObj = JSON.parse(companyId);
        companyId = companyObj._id;
      } catch (e) {
        const match = companyId.match(/ObjectId\('([^']+)'\)/);
        if (match) {
          companyId = match[1];
        }
      }
    }

    // Get all company apps
    const companyApps = await CompanyApp.find({ companyId }).populate('appId');
    
    const syncResults = [];

    for (const companyApp of companyApps) {
      const app = companyApp.appId as any;
      let syncResult = { appName: app.name, status: 'skipped', users: 0 };

      try {
        switch (app.name.toLowerCase()) {
          case 'amazon web services (aws)':
            syncResult = await syncAWSUsers(companyId, companyApp._id.toString());
            break;
          case 'slack':
            syncResult = await syncSlackUsers(companyId, companyApp._id.toString());
            break;
          case 'google workspace':
            syncResult = await syncGoogleUsers(companyId, companyApp._id.toString());
            break;
          default:
            syncResult = { appName: app.name, status: 'not_supported', users: 0 };
        }
      } catch (error: any) {
        console.error(`Error syncing ${app.name}:`, error);
        syncResult = { appName: app.name, status: 'error', users: 0 };
      }

      syncResults.push(syncResult);
    }

    res.status(200).json({
      success: true,
      message: 'Sync completed',
      data: {
        totalApps: companyApps.length,
        syncResults
      }
    });
  } catch (error) {
    console.error('Error syncing apps:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during sync'
    });
  }
};

export const syncSpecificApp = async (req: Request, res: Response): Promise<void> => {
  try {
    let { companyId } = req.user!;
    const { appId } = req.params;

    // Fix: Extract ObjectId from company object if needed
    if (typeof companyId === 'string' && companyId.includes('_id')) {
      try {
        const companyObj = JSON.parse(companyId);
        companyId = companyObj._id;
      } catch (e) {
        const match = companyId.match(/ObjectId\('([^']+)'\)/);
        if (match) {
          companyId = match[1];
        }
      }
    }

    const companyApp = await CompanyApp.findOne({ companyId, appId }).populate('appId');
    if (!companyApp) {
      res.status(404).json({
        success: false,
        message: 'App not found in company'
      });
      return;
    }

    const app = companyApp.appId as any;
    let syncResult;

    switch (app.name.toLowerCase()) {
      case 'amazon web services (aws)':
        syncResult = await syncAWSUsers(companyId, companyApp._id.toString());
        break;
      case 'slack':
        syncResult = await syncSlackUsers(companyId, companyApp._id.toString());
        break;
      case 'google workspace':
        syncResult = await syncGoogleUsers(companyId, companyApp._id.toString());
        break;
      default:
        res.status(400).json({
          success: false,
          message: 'App sync not supported'
        });
        return;
    }

    res.status(200).json({
      success: true,
      message: `${app.name} synced successfully`,
      data: syncResult
    });
  } catch (error) {
    console.error('Error syncing specific app:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during sync'
    });
  }
};

export const provisionUserInApp = async (req: Request, res: Response): Promise<void> => {
  try {
    let { companyId } = req.user!;
    const { userId, appId } = req.params;

    // Fix: Extract ObjectId from company object if needed
    if (typeof companyId === 'string' && companyId.includes('_id')) {
      try {
        const companyObj = JSON.parse(companyId);
        companyId = companyObj._id;
      } catch (e) {
        const match = companyId.match(/ObjectId\('([^']+)'\)/);
        if (match) {
          companyId = match[1];
        }
      }
    }

    const user = await User.findOne({ _id: userId, companyId });
    const companyApp = await CompanyApp.findOne({ companyId, appId }).populate('appId');

    if (!user || !companyApp) {
      res.status(404).json({
        success: false,
        message: 'User or app not found'
      });
      return;
    }

    const app = companyApp.appId as any;
    let provisionResult;

    switch (app.name.toLowerCase()) {
      case 'amazon web services (aws)':
        provisionResult = await provisionAWSUser(user);
        break;
      case 'slack':
        provisionResult = await provisionSlackUser(user);
        break;
      case 'google workspace':
        provisionResult = await provisionGoogleUser(user);
        break;
      default:
        res.status(400).json({
          success: false,
          message: 'App provisioning not supported'
        });
        return;
    }

    // Update user app access with external user ID
    await UserAppAccess.findOneAndUpdate(
      { userId, appId, companyId },
      { 
        externalUserId: provisionResult.externalUserId,
        lastSyncedAt: new Date()
      },
      { upsert: true }
    );

    res.status(200).json({
      success: true,
      message: `User provisioned in ${app.name} successfully`,
      data: provisionResult
    });
  } catch (error) {
    console.error('Error provisioning user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during provisioning'
    });
  }
};

// Helper functions for specific app sync
async function syncAWSUsers(companyId: string, companyAppId: string) {
  try {
    console.log('🔄 Syncing AWS users for company:', companyId);
    
    // Mock AWS credentials (in production, get from secure storage)
    const awsCredentials = { accessKeyId: 'mock', secretAccessKey: 'mock' };
    
    const awsUsers = await mockExternalAPIs.aws.getUsers(awsCredentials);
    let syncedCount = 0;
    let createdCount = 0;

    for (const awsUser of awsUsers) {
      console.log('📋 Processing AWS user:', awsUser.UserName);
      
      // Find or create user by email
      let user = await User.findOne({ 
        email: awsUser.UserName, 
        companyId 
      });

      if (!user) {
        // Create new user from AWS data
        console.log('👤 Creating new user from AWS:', awsUser.UserName);
        
        // Extract name from email or use default
        const emailParts = awsUser.UserName.split('@')[0].split('.');
        const firstName = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'AWS';
        const lastName = emailParts[1] ? emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1) : 'User';
        
        user = new User({
          companyId,
          email: awsUser.UserName,
          firstName,
          lastName,
          role: 'user',
          isActive: true,
          isEmailVerified: false,
          password: Math.random().toString(36).slice(-12), // Temporary password
          department: 'Imported from AWS'
        });
        
        await user.save();
        createdCount++;
        console.log('✅ Created user:', user.email);
      }

      // Create or update user app access
      await UserAppAccess.findOneAndUpdate(
        { userId: user._id, companyId },
        {
          externalUserId: awsUser.UserId,
          lastSyncedAt: new Date(),
          isActive: true,
          appId: companyAppId
        },
        { upsert: true }
      );
      syncedCount++;
    }

    console.log(`✅ AWS sync completed: ${syncedCount} synced, ${createdCount} created`);
    return { 
      appName: 'AWS', 
      status: 'success', 
      users: syncedCount,
      created: createdCount,
      details: `Synced ${syncedCount} users, created ${createdCount} new users`
    };
  } catch (error: any) {
    console.error('❌ AWS sync failed:', error);
    throw new Error(`AWS sync failed: ${error.message}`);
  }
}

async function syncSlackUsers(companyId: string, companyAppId: string) {
  try {
    console.log('🔄 Syncing Slack users for company:', companyId);
    
    // Mock Slack token (in production, get from secure storage)
    const slackToken = 'mock-slack-token';
    
    const slackUsers = await mockExternalAPIs.slack.getUsers(slackToken);
    let syncedCount = 0;
    let createdCount = 0;

    for (const slackUser of slackUsers) {
      console.log('📋 Processing Slack user:', slackUser.profile.email);
      
      // Find or create user by email
      let user = await User.findOne({ 
        email: slackUser.profile.email, 
        companyId 
      });

      if (!user) {
        // Create new user from Slack data
        console.log('👤 Creating new user from Slack:', slackUser.profile.email);
        
        // Parse real name or use email
        const nameParts = slackUser.profile.real_name ? slackUser.profile.real_name.split(' ') : slackUser.profile.email.split('@')[0].split('.');
        const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Slack';
        const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'User';
        
        user = new User({
          companyId,
          email: slackUser.profile.email,
          firstName,
          lastName,
          role: 'user',
          isActive: true,
          isEmailVerified: false,
          password: Math.random().toString(36).slice(-12), // Temporary password
          department: 'Imported from Slack'
        });
        
        await user.save();
        createdCount++;
        console.log('✅ Created user:', user.email);
      }

      // Create or update user app access
      await UserAppAccess.findOneAndUpdate(
        { userId: user._id, companyId },
        {
          externalUserId: slackUser.id,
          lastSyncedAt: new Date(),
          isActive: true,
          appId: companyAppId
        },
        { upsert: true }
      );
      syncedCount++;
    }

    console.log(`✅ Slack sync completed: ${syncedCount} synced, ${createdCount} created`);
    return { 
      appName: 'Slack', 
      status: 'success', 
      users: syncedCount,
      created: createdCount,
      details: `Synced ${syncedCount} users, created ${createdCount} new users`
    };
  } catch (error: any) {
    console.error('❌ Slack sync failed:', error);
    throw new Error(`Slack sync failed: ${error.message}`);
  }
}

async function syncGoogleUsers(companyId: string, companyAppId: string) {
  try {
    console.log('🔄 Syncing Google Workspace users for company:', companyId);
    
    // Mock Google credentials (in production, get from secure storage)
    const googleCredentials = { clientId: 'mock', clientSecret: 'mock' };
    
    const googleUsers = await mockExternalAPIs.google.getUsers(googleCredentials);
    let syncedCount = 0;
    let createdCount = 0;

    for (const googleUser of googleUsers) {
      console.log('📋 Processing Google user:', googleUser.primaryEmail);
      
      // Find or create user by email
      let user = await User.findOne({ 
        email: googleUser.primaryEmail, 
        companyId 
      });

      if (!user) {
        // Create new user from Google data
        console.log('👤 Creating new user from Google:', googleUser.primaryEmail);
        
        // Parse full name or use email
        const nameParts = googleUser.name?.fullName ? googleUser.name.fullName.split(' ') : googleUser.primaryEmail.split('@')[0].split('.');
        const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Google';
        const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'User';
        
        user = new User({
          companyId,
          email: googleUser.primaryEmail,
          firstName,
          lastName,
          role: 'user',
          isActive: true,
          isEmailVerified: false,
          password: Math.random().toString(36).slice(-12), // Temporary password
          department: 'Imported from Google Workspace'
        });
        
        await user.save();
        createdCount++;
        console.log('✅ Created user:', user.email);
      }

      // Create or update user app access
      await UserAppAccess.findOneAndUpdate(
        { userId: user._id, companyId },
        {
          externalUserId: googleUser.id,
          lastSyncedAt: new Date(),
          isActive: true,
          appId: companyAppId
        },
        { upsert: true }
      );
      syncedCount++;
    }

    console.log(`✅ Google sync completed: ${syncedCount} synced, ${createdCount} created`);
    return { 
      appName: 'Google Workspace', 
      status: 'success', 
      users: syncedCount,
      created: createdCount,
      details: `Synced ${syncedCount} users, created ${createdCount} new users`
    };
  } catch (error: any) {
    console.error('❌ Google sync failed:', error);
    throw new Error(`Google sync failed: ${error.message}`);
  }
}

// Helper functions for user provisioning
async function provisionAWSUser(user: any) {
  const awsCredentials = { accessKeyId: 'mock', secretAccessKey: 'mock' };
  const awsUser = await mockExternalAPIs.aws.createUser({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`
  }, awsCredentials);

  return {
    externalUserId: awsUser.UserId,
    platform: 'AWS',
    status: 'provisioned'
  };
}

async function provisionSlackUser(user: any) {
  const slackToken = 'mock-slack-token';
  const slackUser = await mockExternalAPIs.slack.inviteUser({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`
  }, slackToken);

  return {
    externalUserId: slackUser.user.id,
    platform: 'Slack',
    status: 'provisioned'
  };
}

async function provisionGoogleUser(user: any) {
  const googleCredentials = { clientId: 'mock', clientSecret: 'mock' };
  const googleUser = await mockExternalAPIs.google.createUser({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`
  }, googleCredentials);

  return {
    externalUserId: googleUser.id,
    platform: 'Google Workspace',
    status: 'provisioned'
  };
}

export const getAppUsageAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    let { companyId } = req.user!;

    // Fix: Extract ObjectId from company object if needed
    if (typeof companyId === 'string' && companyId.includes('_id')) {
      try {
        const companyObj = JSON.parse(companyId);
        companyId = companyObj._id;
      } catch (e) {
        const match = companyId.match(/ObjectId\('([^']+)'\)/);
        if (match) {
          companyId = match[1];
        }
      }
    }

    const analytics = await UserAppAccess.aggregate([
      { $match: { companyId: companyId } },
      {
        $lookup: {
          from: 'apps',
          localField: 'appId',
          foreignField: '_id',
          as: 'app'
        }
      },
      { $unwind: '$app' },
      {
        $group: {
          _id: '$appId',
          appName: { $first: '$app.name' },
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          lastAccessed: { $max: '$lastAccessed' },
          totalAccessCount: { $sum: '$accessCount' }
        }
      },
      { $sort: { totalUsers: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching app usage analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
