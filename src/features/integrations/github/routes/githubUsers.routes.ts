import { Router } from 'express';
import { GitHubUsersController } from '../controllers/githubUsers.controller';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const usersController = new GitHubUsersController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Sync users
router.post('/sync', async (req, res) => {
  await usersController.syncUsers(req, res);
});

// Get users
router.get('/', async (req, res) => {
  await usersController.getUsers(req, res);
});

// Get user stats
router.get('/stats', async (req, res) => {
  await usersController.getUserStats(req, res);
});

// Invite user
router.post('/invite', async (req, res) => {
  await usersController.inviteUser(req, res);
});

// Remove user
router.delete('/:username', async (req, res) => {
  await usersController.removeUser(req, res);
});

export default router;
