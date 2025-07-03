import { Router } from 'express';
import { DatadogController } from '../controllers/datadogController';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const datadogController = new DatadogController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Connection Management Routes
router.post('/connect', datadogController.createConnection.bind(datadogController));
router.get('/connections', datadogController.getConnections.bind(datadogController));
router.get('/connections/:connectionId/stats', datadogController.getConnectionStats.bind(datadogController));
router.post('/connections/:connectionId/test', datadogController.testConnection.bind(datadogController));
router.delete('/connections/:connectionId', datadogController.disconnectConnection.bind(datadogController));

// Dashboard Overview
router.get('/overview', datadogController.getOverview.bind(datadogController));

// Sync Operations
router.post('/sync', datadogController.syncAll.bind(datadogController));
router.get('/sync/status', datadogController.getSyncStatus.bind(datadogController));

export default router;
