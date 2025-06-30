import { Router } from 'express';
import { SlackConnectionController } from '../controllers/slackConnectionController';
import { SlackUserController } from '../controllers/slackUserController';
import slackConnectionRoutes from './slackConnectionRoutes';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const connectionController = new SlackConnectionController();
const userController = new SlackUserController();

// OAuth callback route (no auth required)
router.get('/callback', async (req, res) => {
  await connectionController.handleOAuthCallback(req, res);
});

// Connection routes
router.use('/connections', slackConnectionRoutes);

// User routes (require authentication)
router.get('/users', authenticate, async (req, res) => {
  await userController.getUsers(req, res);
});

router.get('/users/stats', authenticate, async (req, res) => {
  await userController.getUserStats(req, res);
});

router.get('/users/ghost', authenticate, async (req, res) => {
  await userController.getGhostUsers(req, res);
});

router.get('/users/:id', authenticate, async (req, res) => {
  await userController.getUser(req, res);
});

router.post('/users/sync', authenticate, async (req, res) => {
  await userController.syncUsers(req, res);
});

export default router;
