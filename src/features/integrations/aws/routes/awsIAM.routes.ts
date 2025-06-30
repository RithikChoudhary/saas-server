import { Router } from 'express';
import { AWSIAMController } from '../controllers/awsIAM.controller';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const awsIAMController = new AWSIAMController();

// All AWS IAM routes require authentication
router.use(authenticate);

// IAM Users routes
router.get('/users', async (req, res) => {
  await awsIAMController.getUsers(req, res);
});

router.post('/users', async (req, res) => {
  await awsIAMController.createUser(req, res);
});

router.put('/users/:id', async (req, res) => {
  await awsIAMController.updateUser(req, res);
});

router.delete('/users/:id', async (req, res) => {
  await awsIAMController.deleteUser(req, res);
});

router.post('/users/sync', async (req, res) => {
  await awsIAMController.syncUsers(req, res);
});

// IAM Groups routes
router.get('/groups', async (req, res) => {
  await awsIAMController.getGroups(req, res);
});

router.post('/groups', async (req, res) => {
  await awsIAMController.createGroup(req, res);
});

router.put('/groups/:id', async (req, res) => {
  await awsIAMController.updateGroup(req, res);
});

router.delete('/groups/:id', async (req, res) => {
  await awsIAMController.deleteGroup(req, res);
});

// IAM Policies routes
router.get('/policies', async (req, res) => {
  await awsIAMController.getAvailablePolicies(req, res);
});

// IAM Stats routes
router.get('/stats', async (req, res) => {
  await awsIAMController.getStats(req, res);
});

export default router;
