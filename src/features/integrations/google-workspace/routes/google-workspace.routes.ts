import { Router } from 'express';
import { GoogleWorkspaceConnectionController } from '../controllers/googleWorkspaceConnectionController';
import googleWorkspaceConnectionRoutes from './googleWorkspaceConnectionRoutes';

const router = Router();
const connectionController = new GoogleWorkspaceConnectionController();

// OAuth callback route (no auth required)
router.get('/callback', async (req, res) => {
  await connectionController.handleOAuthCallback(req, res);
});

// Connection routes
router.use('/connections', googleWorkspaceConnectionRoutes);

export default router;
