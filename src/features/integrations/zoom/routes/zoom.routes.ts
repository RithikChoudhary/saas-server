import { Router } from 'express';
import { ZoomConnectionController } from '../controllers/zoomConnectionController';
import zoomConnectionRoutes from './zoomConnectionRoutes';

const router = Router();
const connectionController = new ZoomConnectionController();

// OAuth callback route (no auth required)
router.get('/callback', async (req, res) => {
  await connectionController.handleOAuthCallback(req, res);
});

// Connection routes
router.use('/connections', zoomConnectionRoutes);

export default router;
