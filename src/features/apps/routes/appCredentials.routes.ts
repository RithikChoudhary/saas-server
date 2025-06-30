import { Router } from 'express';
import { AppCredentialsController } from '../controllers/appCredentialsController';
import { authenticate } from '../../../shared/middleware/auth';

const router = Router();
const appCredentialsController = new AppCredentialsController();

// All routes require authentication
router.use(authenticate);

// POST /api/apps/credentials - Save app credentials
router.post('/', async (req, res) => {
  await appCredentialsController.saveCredentials(req, res);
});

// GET /api/apps/credentials - Get all credentials for company
router.get('/', async (req, res) => {
  await appCredentialsController.getAllCredentials(req, res);
});

// GET /api/apps/credentials/requirements/:appType - Get requirements for app type
router.get('/requirements/:appType', async (req, res) => {
  await appCredentialsController.getRequirements(req, res);
});

// GET /api/apps/credentials/:appType/check - Check if credentials exist
router.get('/:appType/check', async (req, res) => {
  await appCredentialsController.checkCredentials(req, res);
});

// GET /api/apps/credentials/:appType - Get credentials for app type
router.get('/:appType', async (req, res) => {
  await appCredentialsController.getCredentials(req, res);
});

// DELETE /api/apps/credentials/:appType/:appName - Delete credentials
router.delete('/:appType/:appName', async (req, res) => {
  await appCredentialsController.deleteCredentials(req, res);
});

export default router;
