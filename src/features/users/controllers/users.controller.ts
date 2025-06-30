import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { User, UserAppAccess, CompanyApp } from '../../../database/models';

// Get current user profile
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    let { companyId, userId } = req.user!;

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

    const user = await User.findOne({ _id: userId, companyId })
      .select('-password -emailVerificationToken -passwordResetToken');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update current user profile
export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
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

    let { companyId, userId } = req.user!;
    const updateData = req.body;

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

    // Remove sensitive fields from update
    delete updateData.password;
    delete updateData.emailVerificationToken;
    delete updateData.passwordResetToken;
    delete updateData.companyId;
    delete updateData.role; // Users can't change their own role

    const user = await User.findOneAndUpdate(
      { _id: userId, companyId },
      updateData,
      { new: true, runValidators: true }
    ).select('-password -emailVerificationToken -passwordResetToken');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all users in company
export const getCompanyUsers = async (req: Request, res: Response): Promise<void> => {
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

    const users = await User.find({ companyId, isActive: true })
      .select('-password -emailVerificationToken -passwordResetToken')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching company users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user app access
export const getUserAppAccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
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

    // Get user app access with app details
    const userAppAccess = await UserAppAccess.find({ 
      userId, 
      companyId,
      isActive: true 
    })
    .populate({
      path: 'companyAppId',
      populate: {
        path: 'appId',
        select: 'name category logo'
      }
    })
    .sort({ lastSyncedAt: -1 });

    // Format the response
    const apps = userAppAccess.map(access => {
      const companyApp = access.companyAppId as any;
      const app = companyApp?.appId;
      
      return {
        appName: app?.name || 'Unknown App',
        appCategory: app?.category || 'unknown',
        appLogo: app?.logo || null,
        accessLevel: access.accessLevel,
        lastSyncedAt: access.lastSyncedAt || access.grantedAt,
        grantedAt: access.grantedAt,
        externalUserId: access.externalUserId
      };
    });

    res.status(200).json({
      success: true,
      data: apps
    });
  } catch (error) {
    console.error('Error fetching user app access:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user details
export const getUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
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

    const user = await User.findOne({ _id: userId, companyId })
      .select('-password -emailVerificationToken -passwordResetToken');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user
export const updateUser = async (req: Request, res: Response): Promise<void> => {
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

    const { userId } = req.params;
    let { companyId } = req.user!;
    const updateData = req.body;

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

    // Remove sensitive fields from update
    delete updateData.password;
    delete updateData.emailVerificationToken;
    delete updateData.passwordResetToken;
    delete updateData.companyId;

    const user = await User.findOneAndUpdate(
      { _id: userId, companyId },
      updateData,
      { new: true, runValidators: true }
    ).select('-password -emailVerificationToken -passwordResetToken');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Deactivate user
export const deactivateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
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

    const user = await User.findOneAndUpdate(
      { _id: userId, companyId },
      { isActive: false },
      { new: true }
    ).select('-password -emailVerificationToken -passwordResetToken');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Also deactivate all user app access
    await UserAppAccess.updateMany(
      { userId, companyId },
      { isActive: false }
    );

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: user
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user statistics
export const getUserStatistics = async (req: Request, res: Response): Promise<void> => {
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

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      usersWithApps,
      awsUsers
    ] = await Promise.all([
      User.countDocuments({ companyId }),
      User.countDocuments({ companyId, isActive: true }),
      User.countDocuments({ companyId, isActive: false }),
      UserAppAccess.distinct('userId', { companyId, isActive: true }),
      User.countDocuments({ companyId, awsUserId: { $exists: true, $ne: null } })
    ]);

    // Get department breakdown
    const departmentStats = await User.aggregate([
      { $match: { companyId: companyId } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get recent users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsers = await User.countDocuments({
      companyId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        usersWithApps: usersWithApps.length,
        awsUsers,
        recentUsers,
        departmentBreakdown: departmentStats.map(stat => ({
          department: stat._id || 'No Department',
          count: stat.count
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
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

    const user = await User.findOneAndUpdate(
      { _id: userId, companyId },
      { isActive: false },
      { new: true }
    ).select('-password -emailVerificationToken -passwordResetToken');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Also deactivate all user app access
    await UserAppAccess.updateMany(
      { userId, companyId },
      { isActive: false }
    );

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: user
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Assign user to app
export const assignUserToApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, appId } = req.params;
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

    // Check if user exists
    const user = await User.findOne({ _id: userId, companyId });
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check if company app exists
    const companyApp = await CompanyApp.findOne({ companyId, appId });
    if (!companyApp) {
      res.status(404).json({
        success: false,
        message: 'App not found in company'
      });
      return;
    }

    // Check if user already has access
    const existingAccess = await UserAppAccess.findOne({ userId, companyId, appId });
    if (existingAccess) {
      res.status(409).json({
        success: false,
        message: 'User already has access to this app'
      });
      return;
    }

    // Create user app access
    const userAppAccess = new UserAppAccess({
      userId,
      companyId,
      appId,
      companyAppId: companyApp._id,
      accessLevel: 'full',
      grantedBy: req.user!.userId,
      grantedAt: new Date(),
      accessCount: 0,
      isActive: true,
      permissions: ['read', 'write', 'share', 'export']
    });

    await userAppAccess.save();

    res.status(201).json({
      success: true,
      message: 'User assigned to app successfully',
      data: userAppAccess
    });
  } catch (error) {
    console.error('Error assigning user to app:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Remove user from app
export const removeUserFromApp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, appId } = req.params;
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

    const userAppAccess = await UserAppAccess.findOneAndUpdate(
      { userId, companyId, appId },
      { isActive: false },
      { new: true }
    );

    if (!userAppAccess) {
      res.status(404).json({
        success: false,
        message: 'User app access not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User removed from app successfully',
      data: userAppAccess
    });
  } catch (error) {
    console.error('Error removing user from app:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new user
export const createUser = async (req: Request, res: Response): Promise<void> => {
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

    let { companyId } = req.user!;
    const userData = req.body;

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

    // Check if user already exists
    const existingUser = await User.findOne({ 
      email: userData.email, 
      companyId 
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }

    // Create new user
    const newUser = new User({
      ...userData,
      companyId,
      password: userData.password || Math.random().toString(36).slice(-12), // Generate random password if not provided
      isEmailVerified: false
    });

    await newUser.save();

    // Remove sensitive data from response
    const userResponse = newUser.toObject();
    const { password, emailVerificationToken, passwordResetToken, ...safeUserData } = userResponse;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: safeUserData
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get dashboard stats
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
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

    // Get dashboard statistics
    const [
      totalUsers,
      totalCompanyApps,
      companyApps
    ] = await Promise.all([
      User.countDocuments({ companyId, isActive: true }),
      CompanyApp.countDocuments({ companyId }),
      CompanyApp.find({ companyId }).select('monthlyCost')
    ]);

    // Calculate total monthly cost
    const totalMonthlyCost = companyApps.reduce((total, app) => {
      return total + (app.monthlyCost || 0);
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalCompanyApps,
        totalMonthlyCost
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
