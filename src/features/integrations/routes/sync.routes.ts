import { Router } from 'express';
import { 
  syncAllApps, 
  syncSpecificApp, 
  provisionUserInApp, 
  getAppUsageAnalytics 
} from '../controllers/sync.controller';
import { authenticate } from '../../../shared/middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Sync all apps for the company
router.post('/all-apps', syncAllApps);

// Sync specific app
router.post('/app/:appId', syncSpecificApp);

// Provision user in specific app
router.post('/provision/:userId/:appId', provisionUserInApp);

// Get app usage analytics
router.get('/analytics', getAppUsageAnalytics);

export default router;
