import { Router } from 'express';
import { AWSConnectionsController } from '../controllers/awsConnections.controller';
import { authenticate } from '../../../../shared/middleware/auth';
import awsIAMRoutes from './awsIAM.routes';
import awsOrganizationsRoutes from './awsOrganizations.routes';
import awsResourcesRoutes from './awsResources.routes';
import awsBillingRoutes from './awsBilling.routes';

const router = Router();
const awsController = new AWSConnectionsController();

// Apply authentication middleware to all routes
router.use(authenticate);

// AWS Overview
router.get('/overview', async (req, res) => {
  await awsController.getOverview(req, res);
});

// AWS Accounts Management
router.get('/accounts', async (req, res) => {
  await awsController.getAccounts(req, res);
});

router.post('/accounts', async (req, res) => {
  await awsController.createAccount(req, res);
});

router.put('/accounts/:id', async (req, res) => {
  await awsController.updateAccount(req, res);
});

router.delete('/accounts/:id', async (req, res) => {
  await awsController.deleteAccount(req, res);
});

router.post('/accounts/:id/sync', async (req, res) => {
  await awsController.syncAccount(req, res);
});

// AWS Users Management
router.get('/users', async (req, res) => {
  await awsController.getUsers(req, res);
});

// AWS Billing & Cost Management (old endpoint - kept for backward compatibility)
router.get('/billing', async (req, res) => {
  await awsController.getBilling(req, res);
});

// AWS Security & Compliance
router.get('/security', async (req, res) => {
  await awsController.getSecurity(req, res);
});

// AWS Organizations (old endpoint - kept for backward compatibility)
router.get('/organizations', async (req, res) => {
  await awsController.getOrganizations(req, res);
});

// AWS IAM routes
router.use('/iam', awsIAMRoutes);

// AWS Organizations routes
router.use('/organizations', awsOrganizationsRoutes);

// AWS Resources routes
router.use('/resources', awsResourcesRoutes);

// AWS Billing routes
router.use('/billing', awsBillingRoutes);

export default router;
