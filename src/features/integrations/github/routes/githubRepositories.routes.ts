import { Router } from 'express';
import { GitHubRepositoriesController } from '../controllers/githubRepositories.controller';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const repositoriesController = new GitHubRepositoriesController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Sync repositories
router.post('/sync', async (req, res) => {
  await repositoriesController.syncRepositories(req, res);
});

// Get repositories
router.get('/', async (req, res) => {
  await repositoriesController.getRepositories(req, res);
});

// Get repository stats
router.get('/stats', async (req, res) => {
  await repositoriesController.getRepositoryStats(req, res);
});

// Get repository details
router.get('/:owner/:repo', async (req, res) => {
  await repositoriesController.getRepositoryDetails(req, res);
});

// Get repository languages
router.get('/:owner/:repo/languages', async (req, res) => {
  await repositoriesController.getRepositoryLanguages(req, res);
});

// Get repository contributors
router.get('/:owner/:repo/contributors', async (req, res) => {
  await repositoriesController.getRepositoryContributors(req, res);
});

export default router;
