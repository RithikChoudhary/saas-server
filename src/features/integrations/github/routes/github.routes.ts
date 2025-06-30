import { Router } from 'express';
import githubConnectionRoutes from './githubConnection.routes';
import githubUsersRoutes from './githubUsers.routes';
import githubTeamsRoutes from './githubTeams.routes';
import githubRepositoriesRoutes from './githubRepositories.routes';
import { GitHubConnectionController } from '../controllers/githubConnection.controller';

const router = Router();
const connectionController = new GitHubConnectionController();

// GitHub connection routes (OAuth, PAT, etc.)
router.use('/connections', githubConnectionRoutes);

// GitHub users routes
router.use('/users', githubUsersRoutes);

// GitHub teams routes
router.use('/teams', githubTeamsRoutes);

// GitHub repositories routes
router.use('/repositories', githubRepositoriesRoutes);

// GitHub OAuth callback route (special case - no /connections prefix)
router.get('/callback', async (req, res) => {
  await connectionController.handleOAuthCallback(req, res);
});

export default router;
