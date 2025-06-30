import { Router } from 'express';
import { AWSOrganizationsController } from '../controllers/awsOrganizations.controller';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const awsOrganizationsController = new AWSOrganizationsController();

// All AWS Organizations routes require authentication
router.use(authenticate);

// Organization routes
router.get('/', async (req, res) => {
  await awsOrganizationsController.getOrganization(req, res);
});

router.get('/units', async (req, res) => {
  await awsOrganizationsController.getOrganizationalUnits(req, res);
});

router.get('/accounts', async (req, res) => {
  await awsOrganizationsController.getAccounts(req, res);
});

router.post('/sync', async (req, res) => {
  await awsOrganizationsController.syncOrganizations(req, res);
});

export default router;
