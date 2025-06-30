import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, requireCompanyAdmin, requireManager } from '../../../shared/middleware/auth';
import { 
  getCompanyUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  getUserAppAccess,
  assignUserToApp,
  removeUserFromApp,
  getDashboardStats
} from '../controllers/users.controller';

const router = Router();

// Get dashboard stats
router.get('/dashboard-stats', authenticate, getDashboardStats);

// Get current user profile
router.get('/profile', authenticate, getUserProfile);

// Update current user profile
router.put('/profile', 
  authenticate,
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  updateUserProfile
);

// Get company users (admin only)
router.get('/company', 
  authenticate, 
  requireCompanyAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  getCompanyUsers
);

// Create new user (admin only)
router.post('/', 
  authenticate,
  requireCompanyAdmin,
  body('firstName').trim().isLength({ min: 1, max: 50 }),
  body('lastName').trim().isLength({ min: 1, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['user', 'dept_manager', 'it_manager', 'hr_manager']),
  body('department').optional().trim().isLength({ min: 1, max: 100 }),
  createUser
);

// Update user (admin only)
router.put('/:userId',
  authenticate,
  requireCompanyAdmin,
  param('userId').isMongoId(),
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['user', 'dept_manager', 'it_manager', 'hr_manager']),
  body('department').optional().trim().isLength({ min: 1, max: 100 }),
  body('isActive').optional().isBoolean(),
  updateUser
);

// Patch user (admin only) - for partial updates like status toggle
router.patch('/:userId',
  authenticate,
  requireCompanyAdmin,
  param('userId').isMongoId(),
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['user', 'dept_manager', 'it_manager', 'hr_manager']),
  body('department').optional().trim().isLength({ min: 1, max: 100 }),
  body('isActive').optional().isBoolean(),
  updateUser
);

// Delete user (admin only)
router.delete('/:userId',
  authenticate,
  requireCompanyAdmin,
  param('userId').isMongoId(),
  deleteUser
);

// Get user's app access
router.get('/:userId/apps',
  authenticate,
  param('userId').isMongoId(),
  getUserAppAccess
);

// Assign user to app
router.post('/:userId/apps/:appId',
  authenticate,
  requireCompanyAdmin,
  param('userId').isMongoId(),
  param('appId').isMongoId(),
  assignUserToApp
);

// Remove user from app
router.delete('/:userId/apps/:appId',
  authenticate,
  requireCompanyAdmin,
  param('userId').isMongoId(),
  param('appId').isMongoId(),
  removeUserFromApp
);

export default router;
