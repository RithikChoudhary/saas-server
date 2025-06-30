import { Request, Response } from 'express';
import { RealApiIntegrationService, createUserFromExternalApp } from '../services/realApiIntegration';
import { getIntegration } from '../index';
import { CompanyApp, UserAppAccess, User } from '../../../database/models';

// Model for storing app credentials securely
interface AppCredentials {
  appName: string;
  credentials: any;
  companyId: string;
}

// In-memory storage for demo (in production, use encrypted database storage)
const credentialsStore = new Map<string, AppCredentials>();

// Test real API connection
export const testRealApiConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    let { companyId } = req.user!;
    const { appName, credentials } = req.body;

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

    console.log(`🔍 Testing real API connection for ${appName}...`);
    console.log('📋 Credentials provided:', Object.keys(credentials));

    // Try to get the integration first
    const integration = getIntegration(appName);
    let connectionResult;
    
    if (integration) {
      // Use the new modular integration system
      connectionResult = await integration.testConnection(credentials);
    } else {
      // Fallback to the old service for apps not yet migrated
      connectionResult = await RealApiIntegrationService.testApiConnection(appName, credentials);
    }

    // Store credentials if connection successful (in production, encrypt these)
    const credentialKey = `${companyId}-${appName}`;
    credentialsStore.set(credentialKey, {
      appName,
      credentials,
      companyId
    });

    console.log(`✅ Real API connection test successful for ${appName}`);

    res.status(200).json({
      success: true,
      message: `Successfully connected to ${appName}`,
      data: {
        appName,
        connectionStatus: 'connected',
        details: connectionResult
      }
    });

  } catch (error: any) {
    console.error(`❌ Real API connection test failed:`, error.message);
    res.status(400).json({
      success: false,
      message: `Failed to connect to ${req.body.appName}: ${error.message}`,
      error: error.message
    });
  }
};

// Sync real users from external app
export const syncRealUsersFromApp = async (req: Request, res: Response): Promise<void> => {
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

    // Get the company app
    const companyApp = await CompanyApp.findOne({ companyId, appId }).populate('appId');
    if (!companyApp) {
      res.status(404).json({
        success: false,
        message: 'App not found in company'
      });
      return;
    }

    const app = companyApp.appId as any;
    const appName = app.name;

    console.log(`🔄 Starting real sync for ${appName}...`);

    // Get stored credentials
    const credentialKey = `${companyId}-${appName}`;
    const storedCredentials = credentialsStore.get(credentialKey);

    if (!storedCredentials) {
      res.status(400).json({
        success: false,
        message: `No credentials found for ${appName}. Please test connection first.`
      });
      return;
    }

    // Fetch real users from external app
    console.log(`👥 Fetching real users from ${appName}...`);
    
    let externalUsers;
    const integration = getIntegration(appName);
    
    if (integration) {
      // Use the new modular integration system
      externalUsers = await integration.getUsers(storedCredentials.credentials);
    } else {
      // Fallback to the old service for apps not yet migrated
      externalUsers = await RealApiIntegrationService.fetchUsersFromApp(
        appName, 
        storedCredentials.credentials
      );
    }

    let syncedCount = 0;
    let createdCount = 0;
    const syncResults = [];

    // Process each external user with simplified logic
    for (const externalUser of externalUsers) {
      try {
        console.log(`📋 Processing user: ${externalUser.email || externalUser.name || externalUser.id}`);

        // Extract user data
        const email = externalUser.email;
        const firstName = externalUser.firstName || externalUser.name?.split(' ')[0] || email?.split('@')[0] || 'Unknown';
        const lastName = externalUser.lastName || externalUser.name?.split(' ').slice(1).join(' ') || 'User';

        // Create or update user directly with upsert
        const platformUser = await User.findOneAndUpdate(
          { email, companyId },
          {
            email,
            companyId,
            firstName,
            lastName,
            role: externalUser.role || 'user',
            department: externalUser.department || `${appName}`,
            isActive: externalUser.isActive !== false,
            isEmailVerified: false,
            password: Math.random().toString(36).slice(-12), // Temporary password for new users
            // AWS-specific fields
            ...(appName.toLowerCase().includes('aws') && {
              awsUserId: externalUser.id,
              awsArn: externalUser.arn || `arn:aws:iam::account:user/${externalUser.name || email?.split('@')[0]}`,
              awsUserName: externalUser.name || email?.split('@')[0]
            })
          },
          { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true
          }
        );

        // Check if this was a new user
        const isNewUser = !platformUser.createdAt || 
          (new Date().getTime() - new Date(platformUser.createdAt).getTime()) < 5000; // Created within last 5 seconds

        if (isNewUser) {
          createdCount++;
          console.log(`✅ Created user: ${email} from ${appName}`);
        } else {
          console.log(`👤 Updated user: ${email} from ${appName}`);
        }

        // Create or update user app access with simplified structure
        await UserAppAccess.findOneAndUpdate(
          { userId: platformUser._id, companyId, appId },
          {
            userId: platformUser._id,
            companyId,
            appId,
            companyAppId: companyApp._id,
            externalUserId: externalUser.id,
            lastSyncedAt: new Date(),
            isActive: externalUser.isActive !== false,
            accessLevel: 'user',
            grantedBy: req.user!.userId,
            grantedAt: new Date(),
            accessCount: 0,
            permissions: []
          },
          { upsert: true }
        );

        syncedCount++;
        syncResults.push({
          email: platformUser.email,
          status: isNewUser ? 'created' : 'updated',
          externalId: externalUser.id
        });

      } catch (userError: any) {
        console.error(`❌ Failed to process user:`, userError.message);
        syncResults.push({
          email: externalUser.email || 'unknown',
          status: 'error',
          error: userError.message
        });
      }
    }

    // Update company app usage statistics
    await CompanyApp.findByIdAndUpdate(companyApp._id, {
      $set: {
        'usage.activeUsers': syncedCount,
        'usage.lastSyncedAt': new Date()
      }
    });

    console.log(`✅ Real sync completed: ${syncedCount} synced, ${createdCount} created`);

    res.status(200).json({
      success: true,
      message: `Successfully synced ${appName}`,
      data: {
        appName,
        totalUsers: externalUsers.length,
        syncedUsers: syncedCount,
        createdUsers: createdCount,
        syncResults,
        lastSyncedAt: new Date()
      }
    });

  } catch (error: any) {
    console.error('❌ Real sync failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Real sync failed',
      error: error.message
    });
  }
};

// Get real app connection status
export const getRealAppConnectionStatus = async (req: Request, res: Response): Promise<void> => {
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
    
    const connectionStatuses = companyApps.map(companyApp => {
      const app = companyApp.appId as any;
      const credentialKey = `${companyId}-${app.name}`;
      const hasCredentials = credentialsStore.has(credentialKey);

      return {
        appId: app._id,
        appName: app.name,
        isConnected: hasCredentials,
        lastSyncedAt: companyApp.usage?.lastSyncDate || null,
        activeUsers: companyApp.usage?.activeUsers || 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        totalApps: companyApps.length,
        connectedApps: connectionStatuses.filter(status => status.isConnected).length,
        connectionStatuses
      }
    });

  } catch (error: any) {
    console.error('❌ Failed to get connection status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get connection status',
      error: error.message
    });
  }
};

// Perform CRUD operations on external app users
export const performExternalUserCrud = async (req: Request, res: Response): Promise<void> => {
  try {
    let { companyId } = req.user!;
    const { appId, operation } = req.params;
    const { userData } = req.body;

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

    // Get the company app
    const companyApp = await CompanyApp.findOne({ companyId, appId }).populate('appId');
    if (!companyApp) {
      res.status(404).json({
        success: false,
        message: 'App not found in company'
      });
      return;
    }

    const app = companyApp.appId as any;
    const appName = app.name;

    console.log(`🔧 Performing ${operation} operation on ${appName}...`);

    // Get stored credentials
    const credentialKey = `${companyId}-${appName}`;
    const storedCredentials = credentialsStore.get(credentialKey);

    if (!storedCredentials) {
      res.status(400).json({
        success: false,
        message: `No credentials found for ${appName}. Please test connection first.`
      });
      return;
    }

    let result;

    switch (operation.toLowerCase()) {
      case 'create':
        // This would create a user in the external app
        // For now, we'll simulate this
        result = {
          operation: 'create',
          appName,
          userData,
          externalUserId: `${appName.toLowerCase()}-${Date.now()}`,
          status: 'simulated - would create user in external app'
        };
        break;

      case 'read':
        // Fetch users from external app
        let users;
        const readIntegration = getIntegration(appName);
        
        if (readIntegration) {
          // Use the new modular integration system
          users = await readIntegration.getUsers(storedCredentials.credentials);
        } else {
          // Fallback to the old service for apps not yet migrated
          users = await RealApiIntegrationService.fetchUsersFromApp(
            appName, 
            storedCredentials.credentials
          );
        }
        
        result = {
          operation: 'read',
          appName,
          users,
          count: users.length
        };
        break;

      case 'update':
        // This would update a user in the external app
        result = {
          operation: 'update',
          appName,
          userData,
          status: 'simulated - would update user in external app'
        };
        break;

      case 'delete':
        // This would delete a user from the external app
        result = {
          operation: 'delete',
          appName,
          userData,
          status: 'simulated - would delete user from external app'
        };
        break;

      default:
        res.status(400).json({
          success: false,
          message: `Unsupported operation: ${operation}`
        });
        return;
    }

    console.log(`✅ ${operation} operation completed for ${appName}`);

    res.status(200).json({
      success: true,
      message: `${operation} operation completed successfully`,
      data: result
    });

  } catch (error: any) {
    console.error(`❌ CRUD operation failed:`, error.message);
    res.status(500).json({
      success: false,
      message: 'CRUD operation failed',
      error: error.message
    });
  }
};

// Clear stored credentials (for security)
export const clearAppCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    let { companyId } = req.user!;
    const { appName } = req.params;

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

    const credentialKey = `${companyId}-${appName}`;
    const deleted = credentialsStore.delete(credentialKey);

    res.status(200).json({
      success: true,
      message: deleted ? 'Credentials cleared successfully' : 'No credentials found to clear',
      data: { appName, cleared: deleted }
    });

  } catch (error: any) {
    console.error('❌ Failed to clear credentials:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to clear credentials',
      error: error.message
    });
  }
};
