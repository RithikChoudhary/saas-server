import { Router } from 'express';
import { GitHubTeamsController } from '../controllers/githubTeams.controller';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const teamsController = new GitHubTeamsController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Sync teams
router.post('/sync', async (req, res) => {
  await teamsController.syncTeams(req, res);
});

// Get teams
router.get('/', async (req, res) => {
  await teamsController.getTeams(req, res);
});

// Get team stats
router.get('/stats', async (req, res) => {
  await teamsController.getTeamStats(req, res);
});

// Create team
router.post('/', async (req, res) => {
  await teamsController.createTeam(req, res);
});

// Get team members
router.get('/:teamId/members', async (req, res) => {
  await teamsController.getTeamMembers(req, res);
});

// Update team
router.patch('/:teamSlug', async (req, res) => {
  await teamsController.updateTeam(req, res);
});

// Delete team
router.delete('/:teamSlug', async (req, res) => {
  await teamsController.deleteTeam(req, res);
});

// Add team member
router.post('/:teamSlug/members', async (req, res) => {
  await teamsController.addTeamMember(req, res);
});

// Remove team member
router.delete('/:teamSlug/members/:username', async (req, res) => {
  await teamsController.removeTeamMember(req, res);
});

export default router;
