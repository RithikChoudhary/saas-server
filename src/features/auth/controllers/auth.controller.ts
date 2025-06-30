import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { User, Company } from '../../../database/models';
import { generateTokenPair } from '../../../shared/utils/jwt';
import { UserRole, SubscriptionPlan, SubscriptionStatus, ApiResponse, LoginRequest, RegisterRequest } from '../../../shared/types';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔥 REGISTER ENDPOINT HIT');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    console.log('📋 Request headers:', req.headers);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }
    
    console.log('✅ Validation passed');

    const {
      companyName,
      companyDomain,
      industry,
      companySize,
      firstName,
      lastName,
      email,
      password
    }: RegisterRequest = req.body;

    // Check if company domain already exists
    const existingCompany = await Company.findOne({ domain: companyDomain.toLowerCase() });
    if (existingCompany) {
      res.status(409).json({
        success: false,
        message: 'Company domain already registered'
      });
      return;
    }

    // Check if user email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'Email address already registered'
      });
      return;
    }

    // Email domain validation removed for flexibility

    // Create company
    const company = new Company({
      name: companyName,
      domain: companyDomain.toLowerCase(),
      industry,
      size: companySize,
      subscription: {
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.TRIAL,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
        maxUsers: 25,
        maxApps: 10
      },
      billing: {
        email: email.toLowerCase(),
        address: 'To be updated'
      }
    });

    await company.save();

    // Create admin user
    const user = new User({
      companyId: company._id,
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      isEmailVerified: false // Will be verified via email
    });

    await user.save();

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Generate JWT tokens
    const tokenPayload = {
      userId: user._id.toString(),
      companyId: company._id.toString(),
      role: user.role,
      email: user.email
    };

    const tokens = generateTokenPair(tokenPayload);

    // TODO: Send verification email
    console.log(`Verification token for ${email}: ${verificationToken}`);

    const response: ApiResponse = {
      success: true,
      message: 'Company and admin account created successfully. Please check your email for verification.',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        },
        company: {
          id: company._id,
          name: company.name,
          domain: company.domain,
          subscription: company.subscription
        },
        tokens
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { email, password, rememberMe }: LoginRequest = req.body;

    // Find user with password field included
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password +loginAttempts +lockUntil')
      .populate('companyId');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Check if account is locked
    if (user.isLocked) {
      res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.'
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact your administrator.'
      });
      return;
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT tokens
    const tokenPayload = {
      userId: user._id.toString(),
      companyId: user.companyId._id.toString(),
      role: user.role,
      email: user.email
    };

    const tokens = generateTokenPair(tokenPayload);

    const response: ApiResponse = {
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role,
          department: user.department,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
          preferences: user.preferences
        },
        company: user.companyId,
        tokens
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
      return;
    }

    // TODO: Implement refresh token logic with token rotation
    // For now, return error
    res.status(501).json({
      success: false,
      message: 'Refresh token functionality not implemented yet'
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during token refresh'
    });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Implement token blacklisting or session invalidation
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
      return;
    }

    // Hash the token to match stored version
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      isEmailVerified: false
    });

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
      return;
    }

    // Verify email
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during email verification'
    });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists or not
      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
      return;
    }

    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // TODO: Send password reset email
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during password reset request'
    });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
      return;
    }

    // Hash the token to match stored version
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
      return;
    }

    // Reset password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during password reset'
    });
  }
};
