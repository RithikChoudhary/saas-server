import { Router } from 'express';
import { body, param } from 'express-validator';
import { 
  handleUserProvisioningWebhook,
  handleUserDeprovisioningWebhook,
  handleUserUpdateWebhook,
  syncExternalUsers,
  getWebhookLogs
} from '../controllers/webhooks.controller';
import { authenticate, requireCompanyAdmin } from '../../../shared/middleware/auth';

const router = Router();

// Webhook endpoints for external SaaS applications
// These endpoints will be called by external services when users are added/removed

// User provisioning webhook (when user is added externally)
router.post('/user-provisioned/:appId',
  body('userId').notEmpty(),
  body('email').isEmail(),
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('action').equals('provisioned'),
  handleUserProvisioningWebhook
);

// User deprovisioning webhook (when user is removed externally)
router.post('/user-deprovisioned/:appId',
  body('userId').notEmpty(),
  body('email').isEmail(),
  body('action').equals('deprovisioned'),
  handleUserDeprovisioningWebhook
);

// User update webhook (when user details are updated externally)
router.post('/user-updated/:appId',
  body('userId').notEmpty(),
  body('email').isEmail(),
  body('action').equals('updated'),
  handleUserUpdateWebhook
);

// Manual sync endpoint for admins to trigger sync with external systems
router.post('/sync/:appId',
  authenticate,
  requireCompanyAdmin,
  param('appId').isMongoId(),
  syncExternalUsers
);

// Get webhook activity logs
router.get('/logs',
  authenticate,
  requireCompanyAdmin,
  getWebhookLogs
);

export default router;
