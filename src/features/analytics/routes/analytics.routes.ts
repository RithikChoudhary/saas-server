import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../../../shared/middleware/auth';

const router = Router();
const analyticsController = new AnalyticsController();

// Executive dashboard
router.get('/dashboard', authenticate, async (req, res) => {
  await analyticsController.getDashboard(req, res);
});

// User correlation
router.post('/correlate', authenticate, async (req, res) => {
  await analyticsController.correlateUsers(req, res);
});

// Cross-platform users
router.get('/cross-platform-users', authenticate, async (req, res) => {
  await analyticsController.getCrossPlatformUsers(req, res);
});

// Ghost users
router.get('/ghost-users', authenticate, async (req, res) => {
  await analyticsController.getGhostUsers(req, res);
});

// Security risks
router.get('/security-risks', authenticate, async (req, res) => {
  await analyticsController.getSecurityRisks(req, res);
});

// License optimization
router.get('/license-optimization', authenticate, async (req, res) => {
  await analyticsController.getLicenseOptimization(req, res);
});

export default router;
