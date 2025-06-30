import { Router } from 'express';
import { AWSBillingController } from '../controllers/awsBilling.controller';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const awsBillingController = new AWSBillingController();

// All routes require authentication
router.use(authenticate);

// GET /api/integrations/aws/billing/summary - Get billing summary for frontend
router.get('/summary', async (req, res) => {
  await awsBillingController.getBillingSummary(req, res);
});

// GET /api/integrations/aws/billing - Get billing data
router.get('/', async (req, res) => {
  await awsBillingController.getBilling(req, res);
});

// GET /api/integrations/aws/billing/trends - Get billing trends
router.get('/trends', async (req, res) => {
  await awsBillingController.getBillingTrends(req, res);
});

// POST /api/integrations/aws/billing/sync - Sync billing from AWS
router.post('/sync', async (req, res) => {
  await awsBillingController.syncBilling(req, res);
});

export default router;
