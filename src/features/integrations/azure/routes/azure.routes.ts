import { Router } from 'express';
import { authenticate } from '../../../../shared/middleware/auth';
import {
  getAzureOverview,
  getAzureSubscriptions,
  createAzureSubscription,
  updateAzureSubscription,
  deleteAzureSubscription,
  syncAzureSubscription,
  getAzureUsers,
  getAzureCostData,
  getAzureSecurityData,
  getAzureManagementGroups
} from '../controllers/azureConnections.controller';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Azure overview routes
router.get('/overview', async (req, res) => {
  await getAzureOverview(req, res);
});

// Azure subscription management routes
router.get('/subscriptions', async (req, res) => {
  await getAzureSubscriptions(req, res);
});

router.post('/subscriptions', async (req, res) => {
  await createAzureSubscription(req, res);
});

router.put('/subscriptions/:subscriptionId', async (req, res) => {
  await updateAzureSubscription(req, res);
});

router.delete('/subscriptions/:subscriptionId', async (req, res) => {
  await deleteAzureSubscription(req, res);
});

router.post('/subscriptions/:subscriptionId/sync', async (req, res) => {
  await syncAzureSubscription(req, res);
});

// Azure user management routes
router.get('/users', async (req, res) => {
  await getAzureUsers(req, res);
});

// Azure cost management routes
router.get('/cost', async (req, res) => {
  await getAzureCostData(req, res);
});

// Azure security routes
router.get('/security', async (req, res) => {
  await getAzureSecurityData(req, res);
});

// Azure management groups routes
router.get('/management-groups', async (req, res) => {
  await getAzureManagementGroups(req, res);
});

export default router;
