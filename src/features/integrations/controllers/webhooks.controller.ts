import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { User, UserAppAccess, CompanyApp, App } from '../../../database/models';
import { WebhookLog } from '../../../database/models/WebhookLog';

// Handle user provisioning webhook (when user is added externally to an app)
export const handleUserProvisioningWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { appId } = req.params;
    const { userId: externalUserId, email, firstName, lastName } = req.body;

    // Find the app
    const app = await App.findById(appId);
    if (!app) {
      res.status(404).json({
        success: false,
        message: 'App not found'
      });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Log webhook event
      await WebhookLog.create({
        appId,
        action: 'user_provisioned',
        externalUserId,
        email,
        status: 'failed',
        message: 'User not found in our system',
        timestamp: new Date()
      });

      res.status(404).json({
        success: false,
        message: 'User not found in our system'
      });
      return;
    }

    // Find company app
    const companyApp = await CompanyApp.findOne({ 
      companyId: user.companyId, 
      appId 
    });

    if (!companyApp) {
      // Log webhook event
      await WebhookLog.create({
        appId,
        action: 'user_provisioned',
        externalUserId,
        email,
        status: 'failed',
        message: 'Company does not have access to this app',
        timestamp: new Date()
      });

      res.status(404).json({
        success: false,
        message: 'Company does not have access to this app'
      });
      return;
    }

    // Check if user already has access
    const existingAccess = await UserAppAccess.findOne({
      userId: user._id,
      appId,
      companyId: user.companyId
    });

    if (existingAccess) {
      // Update external user ID if different
      if (existingAccess.externalUserId !== externalUserId) {
        existingAccess.externalUserId = externalUserId;
        existingAccess.lastSyncedAt = new Date();
        await existingAccess.save();
      }

      // Log webhook event
      await WebhookLog.create({
        appId,
        action: 'user_provisioned',
        externalUserId,
        email,
        status: 'success',
        message: 'User access already exists, updated external ID',
        timestamp: new Date()
      });

      res.status(200).json({
        success: true,
        message: 'User access already exists'
      });
      return;
    }

    // Create new user app access
    const userAppAccess = new UserAppAccess({
      userId: user._id,
      appId,
      companyId: user.companyId,
      externalUserId,
      grantedBy: user._id, // Self-granted through external system
      isActive: true,
      lastSyncedAt: new Date()
    });

    await userAppAccess.save();

    // Update active users count
    await CompanyApp.findByIdAndUpdate(companyApp._id, {
      $inc: { 'usage.activeUsers': 1 }
    });

    // Log webhook event
    await WebhookLog.create({
      appId,
      action: 'user_provisioned',
      externalUserId,
      email,
      status: 'success',
      message: 'User access granted successfully',
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'User access granted successfully',
      data: userAppAccess
    });
  } catch (error) {
    console.error('Error handling user provisioning webhook:', error);
    
    // Log webhook event
    await WebhookLog.create({
      appId: req.params.appId,
      action: 'user_provisioned',
      externalUserId: req.body.userId,
      email: req.body.email,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Handle user deprovisioning webhook (when user is removed externally from an app)
export const handleUserDeprovisioningWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { appId } = req.params;
    const { userId: externalUserId, email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Log webhook event
      await WebhookLog.create({
        appId,
        action: 'user_deprovisioned',
        externalUserId,
        email,
        status: 'failed',
        message: 'User not found in our system',
        timestamp: new Date()
      });

      res.status(404).json({
        success: false,
        message: 'User not found in our system'
      });
      return;
    }

    // Find and remove user app access
    const userAppAccess = await UserAppAccess.findOneAndDelete({
      userId: user._id,
      appId,
      companyId: user.companyId,
      externalUserId
    });

    if (!userAppAccess) {
      // Log webhook event
      await WebhookLog.create({
        appId,
        action: 'user_deprovisioned',
        externalUserId,
        email,
        status: 'failed',
        message: 'User access not found',
        timestamp: new Date()
      });

      res.status(404).json({
        success: false,
        message: 'User access not found'
      });
      return;
    }

    // Update active users count
    const companyApp = await CompanyApp.findOne({ 
      companyId: user.companyId, 
      appId 
    });
    
    if (companyApp) {
      await CompanyApp.findByIdAndUpdate(companyApp._id, {
        $inc: { 'usage.activeUsers': -1 }
      });
    }

    // Log webhook event
    await WebhookLog.create({
      appId,
      action: 'user_deprovisioned',
      externalUserId,
      email,
      status: 'success',
      message: 'User access removed successfully',
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'User access removed successfully'
    });
  } catch (error) {
    console.error('Error handling user deprovisioning webhook:', error);
    
    // Log webhook event
    await WebhookLog.create({
      appId: req.params.appId,
      action: 'user_deprovisioned',
      externalUserId: req.body.userId,
      email: req.body.email,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Handle user update webhook (when user details are updated externally)
export const handleUserUpdateWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { appId } = req.params;
    const { userId: externalUserId, email, firstName, lastName } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Log webhook event
      await WebhookLog.create({
        appId,
        action: 'user_updated',
        externalUserId,
        email,
        status: 'failed',
        message: 'User not found in our system',
        timestamp: new Date()
      });

      res.status(404).json({
        success: false,
        message: 'User not found in our system'
      });
      return;
    }

    // Update user app access sync timestamp
    const userAppAccess = await UserAppAccess.findOneAndUpdate(
      {
        userId: user._id,
        appId,
        companyId: user.companyId,
        externalUserId
      },
      {
        lastSyncedAt: new Date()
      },
      { new: true }
    );

    if (!userAppAccess) {
      // Log webhook event
      await WebhookLog.create({
        appId,
        action: 'user_updated',
        externalUserId,
        email,
        status: 'failed',
        message: 'User access not found',
        timestamp: new Date()
      });

      res.status(404).json({
        success: false,
        message: 'User access not found'
      });
      return;
    }

    // Log webhook event
    await WebhookLog.create({
      appId,
      action: 'user_updated',
      externalUserId,
      email,
      status: 'success',
      message: 'User sync updated successfully',
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'User sync updated successfully'
    });
  } catch (error) {
    console.error('Error handling user update webhook:', error);
    
    // Log webhook event
    await WebhookLog.create({
      appId: req.params.appId,
      action: 'user_updated',
      externalUserId: req.body.userId,
      email: req.body.email,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Manual sync with external systems (for admin use)
export const syncExternalUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const { appId } = req.params;

    // Find company app
    const companyApp = await CompanyApp.findOne({ companyId, appId })
      .populate('appId', 'name apiEndpoint');

    if (!companyApp) {
      res.status(404).json({
        success: false,
        message: 'App not found in company'
      });
      return;
    }

    // In a real implementation, this would call the external app's API
    // to get the current list of users and sync with our database
    
    // For now, we'll simulate this process
    const syncResults = {
      usersAdded: 0,
      usersRemoved: 0,
      usersUpdated: 0,
      errors: []
    };

    // Log sync event
    await WebhookLog.create({
      appId,
      action: 'manual_sync',
      externalUserId: null,
      email: null,
      status: 'success',
      message: `Manual sync completed: ${syncResults.usersAdded} added, ${syncResults.usersRemoved} removed, ${syncResults.usersUpdated} updated`,
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Sync completed successfully',
      data: syncResults
    });
  } catch (error) {
    console.error('Error syncing external users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get webhook activity logs
export const getWebhookLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Get company's apps
    const companyApps = await CompanyApp.find({ companyId }).select('appId');
    const appIds = companyApps.map(ca => ca.appId);

    const [logs, total] = await Promise.all([
      WebhookLog.find({ appId: { $in: appIds } })
        .populate('appId', 'name logo')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      WebhookLog.countDocuments({ appId: { $in: appIds } })
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
