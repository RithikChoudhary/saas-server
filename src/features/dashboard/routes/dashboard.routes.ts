import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../../../shared/middleware/auth';

const router = Router();
const dashboardController = new DashboardController();

// All dashboard routes require authentication
router.use(authenticate);

// GET /api/dashboard/overview - Get dashboard overview with aggregated stats
router.get('/overview', async (req, res) => {
  await dashboardController.getOverview(req, res);
});

// GET /api/dashboard/connected-services - Get all connected services
router.get('/connected-services', async (req, res) => {
  await dashboardController.getConnectedServices(req, res);
});

// GET /api/dashboard/recent-activity - Get recent activity across all services
router.get('/recent-activity', async (req, res) => {
  await dashboardController.getRecentActivity(req, res);
});

export default router;
