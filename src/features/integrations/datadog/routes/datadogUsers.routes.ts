import { Router } from 'express';
import { DatadogUsersController } from '../controllers/datadogUsersController';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const datadogUsersController = new DatadogUsersController();

// Apply authentication middleware to all routes
router.use(authenticate);

// User Management Routes
router.get('/', datadogUsersController.getUsers.bind(datadogUsersController));
router.get('/stats', datadogUsersController.getUserStats.bind(datadogUsersController));
router.get('/search', datadogUsersController.searchUsers.bind(datadogUsersController));
router.get('/export', datadogUsersController.exportUsers.bind(datadogUsersController));
router.get('/status/:status', datadogUsersController.getUsersByStatus.bind(datadogUsersController));
router.get('/correlation/:correlationStatus', datadogUsersController.getUsersByCorrelationStatus.bind(datadogUsersController));
router.get('/:userId', datadogUsersController.getUserById.bind(datadogUsersController));

// Sync Operations
router.post('/sync', datadogUsersController.syncUsers.bind(datadogUsersController));

export default router;
