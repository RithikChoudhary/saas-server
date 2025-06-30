import { Router } from 'express';
import { CredentialsController } from '../controllers/credentialsController';
import { authenticate } from '../../../shared/middleware/auth';

const router = Router();
const credentialsController = new CredentialsController();

// Apply authentication middleware to all routes
router.use(authenticate);

// POST /api/credentials - Save credentials
router.post('/', async (req, res) => {
  await credentialsController.saveCredentials(req, res);
});

// GET /api/credentials - Get all credentials for company
router.get('/', async (req, res) => {
  await credentialsController.getAllCredentials(req, res);
});

// GET /api/credentials/requirements/:appType - Get credential requirements for app type
router.get('/requirements/:appType', async (req, res) => {
  await credentialsController.getRequirements(req, res);
});

// GET /api/credentials/:appType - Get credentials for specific app type
router.get('/:appType', async (req, res) => {
  await credentialsController.getCredentials(req, res);
});

// GET /api/credentials/:appType/check - Check if credentials exist
router.get('/:appType/check', async (req, res) => {
  await credentialsController.checkCredentials(req, res);
});

// POST /api/credentials/:appType/test - Test credentials
router.post('/:appType/test', async (req, res) => {
  await credentialsController.testCredentials(req, res);
});

// DELETE /api/credentials/:appType/:appName - Delete specific credentials
router.delete('/:appType/:appName', async (req, res) => {
  await credentialsController.deleteCredentials(req, res);
});

export default router;
