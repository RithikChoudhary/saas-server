import { Router } from 'express';
import { DatadogTeamsController } from '../controllers/datadogTeamsController';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const datadogTeamsController = new DatadogTeamsController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Team Management Routes
router.get('/', datadogTeamsController.getTeams.bind(datadogTeamsController));
router.get('/stats', datadogTeamsController.getTeamStats.bind(datadogTeamsController));
router.get('/analytics', datadogTeamsController.getTeamAnalytics.bind(datadogTeamsController));
router.get('/search', datadogTeamsController.searchTeams.bind(datadogTeamsController));
router.get('/export', datadogTeamsController.exportTeams.bind(datadogTeamsController));
router.get('/correlation/:correlationStatus', datadogTeamsController.getTeamsByCorrelationStatus.bind(datadogTeamsController));
router.get('/:teamId', datadogTeamsController.getTeamById.bind(datadogTeamsController));
router.get('/:teamId/summary', datadogTeamsController.getTeamSummary.bind(datadogTeamsController));
router.get('/:teamId/members', datadogTeamsController.getTeamMembers.bind(datadogTeamsController));

// Sync Operations
router.post('/sync', datadogTeamsController.syncTeams.bind(datadogTeamsController));

export default router;
