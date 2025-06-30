import { Router } from 'express';
import { SlackConnectionController } from '../controllers/slackConnectionController';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const connectionController = new SlackConnectionController();

// OAuth routes
router.post('/oauth/initiate', authenticate, async (req, res) => {
  await connectionController.initiateOAuth(req, res);
});

// Connection management routes
router.get('/', authenticate, async (req, res) => {
  await connectionController.getConnections(req, res);
});

router.get('/:id', authenticate, async (req, res) => {
  await connectionController.getConnection(req, res);
});

router.delete('/:id', authenticate, async (req, res) => {
  await connectionController.disconnectConnection(req, res);
});

router.post('/:id/refresh', authenticate, async (req, res) => {
  await connectionController.refreshConnection(req, res);
});

router.post('/:id/test', authenticate, async (req, res) => {
  await connectionController.testConnection(req, res);
});

export default router;
