import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, requireCompanyAdmin } from '../../../shared/middleware/auth';
import {
  testRealApiConnection,
  syncRealUsersFromApp,
  getRealAppConnectionStatus,
  performExternalUserCrud,
  clearAppCredentials
} from '../controllers/realSync.controller';

const router = Router();

// Test real API connection
router.post('/test-connection',
  authenticate,
  requireCompanyAdmin,
  body('appName').trim().isLength({ min: 1 }),
  body('credentials').isObject(),
  testRealApiConnection
);

// Get connection status for all apps
router.get('/connection-status',
  authenticate,
  requireCompanyAdmin,
  getRealAppConnectionStatus
);

// Sync real users from specific app
router.post('/sync/:appId',
  authenticate,
  requireCompanyAdmin,
  param('appId').isMongoId(),
  syncRealUsersFromApp
);

// Perform CRUD operations on external app users
router.post('/crud/:appId/:operation',
  authenticate,
  requireCompanyAdmin,
  param('appId').isMongoId(),
  param('operation').isIn(['create', 'read', 'update', 'delete']),
  body('userData').optional().isObject(),
  performExternalUserCrud
);

// Clear app credentials
router.delete('/credentials/:appName',
  authenticate,
  requireCompanyAdmin,
  param('appName').trim().isLength({ min: 1 }),
  clearAppCredentials
);

export default router;
