import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader } from '../utils/jwt';
import { User } from '../../database/models';
import { UserRole } from '../types';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        companyId: string;
        role: UserRole;
        email: string;
      };
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('🔐 AUTH MIDDLEWARE HIT');
    console.log('📋 Authorization header:', req.headers.authorization);
    
    const token = extractTokenFromHeader(req.headers.authorization);
    console.log('🎫 Extracted token:', token ? 'Present' : 'Missing');
    
    if (!token) {
      console.log('❌ No token provided');
      res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
      return;
    }

    const decoded = verifyAccessToken(token);
    
    // Verify user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
      return;
    }

    // Check if user account is locked
    if (user.isLocked) {
      res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts'
      });
      return;
    }

    // Handle malformed companyId (defensive parsing for existing tokens)
    let companyId: string = decoded.companyId;
    console.log('🔍 Original companyId type:', typeof companyId);
    console.log('🔍 Original companyId value:', companyId);
    
    if (typeof companyId === 'object' && (companyId as any)._id) {
      console.log('📝 Extracting _id from object');
      companyId = (companyId as any)._id.toString();
    } else if (typeof companyId === 'string' && companyId.includes('{')) {
      console.log('📝 Parsing stringified object');
      // Handle stringified object case
      try {
        const parsed = JSON.parse(companyId);
        companyId = parsed._id || parsed.id;
        console.log('✅ Parsed companyId:', companyId);
      } catch (e) {
        console.log('❌ JSON parse failed, trying regex');
        // If parsing fails, try to extract ObjectId from string
        const match = companyId.match(/ObjectId\('([^']+)'\)/);
        if (match) {
          companyId = match[1];
          console.log('✅ Regex extracted companyId:', companyId);
        }
      }
    }
    
    console.log('🎯 Final companyId:', companyId);

    req.user = {
      userId: decoded.userId,
      companyId: companyId,
      role: decoded.role,
      email: decoded.email
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
    return;
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

export const requireCompanyAdmin = authorize(
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_ADMIN
);

export const requireManager = authorize(
  UserRole.SUPER_ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.DEPT_MANAGER,
  UserRole.IT_MANAGER,
  UserRole.HR_MANAGER
);

export const requireSuperAdmin = authorize(UserRole.SUPER_ADMIN);

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (token) {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive && !user.isLocked) {
        req.user = {
          userId: decoded.userId,
          companyId: decoded.companyId,
          role: decoded.role,
          email: decoded.email
        };
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};
