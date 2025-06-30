import { Router } from 'express';
import { GoogleWorkspaceConnectionController } from '../controllers/googleWorkspaceConnectionController';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const connectionController = new GoogleWorkspaceConnectionController();

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

// Sync routes
router.post('/:id/sync', authenticate, async (req, res) => {
  await connectionController.syncConnection(req, res);
});

router.post('/:id/sync/users', authenticate, async (req, res) => {
  await connectionController.syncUsers(req, res);
});

router.post('/:id/sync/groups', authenticate, async (req, res) => {
  await connectionController.syncGroups(req, res);
});

router.post('/:id/sync/org-units', authenticate, async (req, res) => {
  await connectionController.syncOrgUnits(req, res);
});

export default router;
