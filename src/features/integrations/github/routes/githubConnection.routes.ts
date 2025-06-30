import { Router } from 'express';
import { GitHubConnectionController } from '../controllers/githubConnection.controller';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const connectionController = new GitHubConnectionController();

// OAuth flow
router.post('/oauth/initiate', authenticate, async (req, res) => {
  await connectionController.initiateOAuth(req, res);
});

router.get('/callback', async (req, res) => {
  await connectionController.handleOAuthCallback(req, res);
}); // No auth for OAuth callback

// Personal Access Token
router.post('/pat', authenticate, async (req, res) => {
  await connectionController.createPersonalAccessTokenConnection(req, res);
});

// Connection management
router.get('/', authenticate, async (req, res) => {
  await connectionController.getConnections(req, res);
});

router.get('/:connectionId', authenticate, async (req, res) => {
  await connectionController.getConnection(req, res);
});

router.delete('/:connectionId', authenticate, async (req, res) => {
  await connectionController.disconnectConnection(req, res);
});

router.post('/:connectionId/refresh', authenticate, async (req, res) => {
  await connectionController.refreshConnection(req, res);
});

export default router;
