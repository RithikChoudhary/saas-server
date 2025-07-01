import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { 
  getAvailableApps, 
  getCompanyApps, 
  addAppToCompany, 
  removeAppFromCompany,
  updateAppUsers 
} from '../controllers/apps.controller';
import { AppsDashboardController } from '../controllers/appsDashboard.controller';
import appCredentialsRoutes from './appCredentials.routes';

const router = Router();
const appsDashboardController = new AppsDashboardController();

// App credentials routes
router.use('/credentials', appCredentialsRoutes);

// Apps dashboard - comprehensive overview with real data
router.get('/dashboard', authenticate, appsDashboardController.getDashboard.bind(appsDashboardController));

// Get all available apps
router.get('/available', authenticate, getAvailableApps);

// Get company's apps
router.get('/company', authenticate, getCompanyApps);

// Add app to company
router.post('/company/:appId', 
  authenticate,
  param('appId').isMongoId().withMessage('Invalid app ID'),
  addAppToCompany
);

// Remove app from company
router.delete('/company/:appId',
  authenticate,
  param('appId').isMongoId().withMessage('Invalid app ID'),
  removeAppFromCompany
);

// Update app users
router.put('/company/:appId/users',
  authenticate,
  param('appId').isMongoId().withMessage('Invalid app ID'),
  body('userIds').isArray().withMessage('User IDs must be an array'),
  body('userIds.*').isMongoId().withMessage('Invalid user ID'),
  updateAppUsers
);

export default router;
