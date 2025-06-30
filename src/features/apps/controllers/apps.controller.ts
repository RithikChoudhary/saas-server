import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { App, CompanyApp, UserAppAccess, User } from '../../../database/models';

export const getAvailableApps = async (req: Request, res: Response): Promise<void> => {
  try {
    const apps = await App.find({ isActive: true }).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      data: apps
    });
  } catch (error) {
    console.error('Error fetching available apps:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getCompanyApps = async (req: Request, res: Response): Promise<void> => {
  try {
    let { companyId } = req.user!;

    // Fix: Extract ObjectId from company object if needed
    if (typeof companyId === 'string' && companyId.includes('_id')) {
      try {
        const companyObj = JSON.parse(companyId);
        companyId = companyObj._id;
      } catch (e) {
        // If parsing fails, try to extract ObjectId from string
        const match = companyId.match(/ObjectId\('([^']+)'\)/);
        if (match) {
          companyId = match[1];
        }
      }
    }
    
    const companyApps = await CompanyApp.find({ companyId })
      .populate('appId');
    
    // Get user access for each app
    const companyAppsWithUsers = await Promise.all(
      companyApps.map(async (companyApp) => {
        const userAccess = await UserAppAccess.find({ 
          companyAppId: companyApp._id 
        }).populate('userId', 'firstName lastName email');
        
        return {
          ...companyApp.toObject(),
          users: userAccess.map(access => access.userId)
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: companyAppsWithUsers
    });
  } catch (error) {
    console.error('Error fetching company apps:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const addAppToCompany = async (req: Request, res: Response): Promise<void> => {
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
    let { companyId, userId } = req.user!;

    // Fix: Extract ObjectId from company object if needed
    if (typeof companyId === 'string' && companyId.includes('_id')) {
      try {
        const companyObj = JSON.parse(companyId);
        companyId = companyObj._id;
      } catch (e) {
        // If parsing fails, try to extract ObjectId from string
        const match = companyId.match(/ObjectId\('([^']+)'\)/);
        if (match) {
          companyId = match[1];
        }
      }
    }

    console.log('Processed CompanyId:', companyId, 'Type:', typeof companyId);

    // Check if app exists
    const app = await App.findById(appId);
    if (!app) {
      res.status(404).json({
        success: false,
        message: 'App not found'
      });
      return;
    }

    // Check if app is already added to company
    const existingCompanyApp = await CompanyApp.findOne({ companyId, appId });
    if (existingCompanyApp) {
      res.status(409).json({
        success: false,
        message: 'App is already added to your company'
      });
      return;
    }

    // Create company app with required fields
    const companyApp = new CompanyApp({
      companyId,
      appId,
      subscriptionTier: 'basic', // Default tier
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      monthlyCost: 0, // Default cost
      licenseCount: 1 // Default license count
    });

    await companyApp.save();

    // Populate the app details for response
    await companyApp.populate('appId');

    res.status(201).json({
      success: true,
      message: 'App added to company successfully',
      data: companyApp
    });
  } catch (error) {
    console.error('Error adding app to company:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const removeAppFromCompany = async (req: Request, res: Response): Promise<void> => {
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
    let { companyId } = req.user!;

    // Fix: Extract ObjectId from company object if needed
    if (typeof companyId === 'string' && companyId.includes('_id')) {
      try {
        const companyObj = JSON.parse(companyId);
        companyId = companyObj._id;
      } catch (e) {
        // If parsing fails, try to extract ObjectId from string
        const match = companyId.match(/ObjectId\('([^']+)'\)/);
        if (match) {
          companyId = match[1];
        }
      }
    }

    // Find and remove company app
    const companyApp = await CompanyApp.findOneAndDelete({ companyId, appId });
    if (!companyApp) {
      res.status(404).json({
        success: false,
        message: 'App not found in your company'
      });
      return;
    }

    // Remove all user app access records for this company app
    await UserAppAccess.deleteMany({ companyAppId: companyApp._id });

    res.status(200).json({
      success: true,
      message: 'App removed from company successfully'
    });
  } catch (error) {
    console.error('Error removing app from company:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const updateAppUsers = async (req: Request, res: Response): Promise<void> => {
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
    const { userIds } = req.body;
    const { companyId, userId: currentUserId } = req.user!;

    // Find company app
    const companyApp = await CompanyApp.findOne({ companyId, appId });
    if (!companyApp) {
      res.status(404).json({
        success: false,
        message: 'App not found in your company'
      });
      return;
    }

    // Verify all users belong to the same company
    const users = await User.find({ 
      _id: { $in: userIds }, 
      companyId,
      isActive: true 
    });

    if (users.length !== userIds.length) {
      res.status(400).json({
        success: false,
        message: 'Some users not found or not active in your company'
      });
      return;
    }

    // Remove existing user app access records
    await UserAppAccess.deleteMany({ companyAppId: companyApp._id });

    // Create new user app access records
    const userAppAccessRecords = userIds.map((userId: string) => ({
      userId,
      companyId,
      appId,
      grantedBy: currentUserId,
      accessLevel: 'full' as const,
      permissions: [],
      grantedAt: new Date(),
      accessCount: 0,
      isActive: true
    }));

    await UserAppAccess.insertMany(userAppAccessRecords);

    // Update active users count
    companyApp.usage.activeUsers = userIds.length;
    await companyApp.save();

    // Get updated user access for response
    const userAccess = await UserAppAccess.find({ 
      companyAppId: companyApp._id 
    }).populate('userId', 'firstName lastName email');

    // Populate app details for response
    await companyApp.populate('appId');

    res.status(200).json({
      success: true,
      message: 'App users updated successfully',
      data: {
        ...companyApp.toObject(),
        users: userAccess.map(access => access.userId)
      }
    });
  } catch (error) {
    console.error('Error updating app users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
