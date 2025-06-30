import { Router } from 'express';
import { AWSResourcesController } from '../controllers/awsResources.controller';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const awsResourcesController = new AWSResourcesController();

// All routes require authentication
router.use(authenticate);

// GET /api/integrations/aws/resources/summary - Get resources summary for frontend
router.get('/summary', async (req, res) => {
  await awsResourcesController.getResourcesSummary(req, res);
});

// GET /api/integrations/aws/resources/ec2 - Get EC2 instances
router.get('/ec2', async (req, res) => {
  await awsResourcesController.getEC2Instances(req, res);
});

// GET /api/integrations/aws/resources - Get all resources
router.get('/', async (req, res) => {
  await awsResourcesController.getResources(req, res);
});

// GET /api/integrations/aws/resources/stats - Get resource statistics
router.get('/stats', async (req, res) => {
  await awsResourcesController.getResourceStats(req, res);
});

// POST /api/integrations/aws/resources/sync - Sync resources from AWS
router.post('/sync', async (req, res) => {
  await awsResourcesController.syncResources(req, res);
});

export default router;
