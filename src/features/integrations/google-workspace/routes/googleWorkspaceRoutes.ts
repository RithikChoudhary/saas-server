// @ts-nocheck
import { Router } from 'express';
import { GoogleWorkspaceController } from '../controllers/googleWorkspaceController';
import { GoogleWorkspaceConnectionService } from '../services/googleWorkspaceConnectionService';
import { authenticate } from '../../../../shared/middleware/auth';

const router = Router();
const controller = new GoogleWorkspaceController();
const connectionService = new GoogleWorkspaceConnectionService();

// ==================== CONNECTION ROUTES ====================

// Get all connections for a company
router.get('/connections', authenticate, (req, res) => {
  controller.getConnections(req, res);
});

// Get a specific connection
router.get('/connections/:connectionId', authenticate, (req, res) => {
  controller.getConnection(req, res);
});

// Delete a connection
router.delete('/connections/:connectionId', authenticate, (req, res) => {
  controller.deleteConnection(req, res);
});

// OAuth initiation
router.post('/oauth/initiate', (req, res) => {
  const { companyId } = req.body;
  
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  connectionService.initiateOAuth(companyId)
    .then(authUrl => {
      res.json({
        success: true,
        authUrl,
        message: 'OAuth URL generated successfully'
      });
    })
    .catch(error => {
      console.error('Error initiating OAuth:', error);
      res.status(500).json({ 
        error: 'Failed to initiate OAuth',
        details: error.message 
      });
    });
});

// OAuth callback
router.get('/callback', (req, res) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.status(400).json({ error: 'Missing OAuth parameters' });
  }

  connectionService.handleOAuthCallback(code as string, state as string)
    .then(result => {
      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/apps/google-workspace?success=true&domain=${result.domain}`);
    })
    .catch(error => {
      console.error('Error handling OAuth callback:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/apps/google-workspace?error=connection_failed`);
    });
});

// Test connection
router.post('/test-connection', (req, res) => {
  const { connectionId, companyId } = req.body;
  
  if (!connectionId || !companyId) {
    return res.status(400).json({ error: 'Connection ID and Company ID are required' });
  }

  connectionService.testConnection(connectionId, companyId)
    .then(result => {
      res.json({
        success: true,
        result,
        message: 'Connection test completed'
      });
    })
    .catch(error => {
      console.error('Error testing connection:', error);
      res.status(500).json({ 
        error: 'Failed to test connection',
        details: error.message 
      });
    });
});

// ==================== USER ROUTES ====================

// Get all users
router.get('/users', authenticate, (req, res) => {
  console.log('📥 GET /users - Request received:', req.query);
  controller.getUsers(req, res);
});

// Get a specific user
router.get('/users/:userId', authenticate, (req, res) => {
  console.log('📥 GET /users/:userId - Request received:', req.params);
  controller.getUser(req, res);
});

// Update a user (local data only)
router.put('/users/:userId', authenticate, (req, res) => {
  console.log('📥 PUT /users/:userId - Request received:', req.params);
  controller.updateUser(req, res);
});

// Delete a user (local data only)
router.delete('/users/:userId', authenticate, (req, res) => {
  console.log('📥 DELETE /users/:userId - Request received:', req.params);
  controller.deleteUser(req, res);
});

// ==================== GROUP ROUTES ====================

// Get all groups
router.get('/groups', authenticate, (req, res) => {
  console.log('📥 GET /groups - Request received:', req.query);
  controller.getGroups(req, res);
});

// Get a specific group
router.get('/groups/:groupId', authenticate, (req, res) => {
  console.log('📥 GET /groups/:groupId - Request received:', req.params);
  controller.getGroup(req, res);
});

// ==================== ORG UNIT ROUTES ====================

// Get all organizational units
router.get('/org-units', authenticate, (req, res) => {
  console.log('📥 GET /org-units - Request received:', req.query);
  controller.getOrgUnits(req, res);
});

// ==================== SYNC ROUTES ====================

// Sync users
router.post('/sync/users', authenticate, (req, res) => {
  console.log('📥 POST /sync/users - Request received:', req.body);
  controller.syncUsers(req, res);
});

// Sync groups
router.post('/sync/groups', authenticate, (req, res) => {
  console.log('📥 POST /sync/groups - Request received:', req.body);
  controller.syncGroups(req, res);
});

// Sync organizational units
router.post('/sync/org-units', authenticate, (req, res) => {
  console.log('📥 POST /sync/org-units - Request received:', req.body);
  controller.syncOrgUnits(req, res);
});

// Sync all data
router.post('/sync/all', authenticate, (req, res) => {
  console.log('📥 POST /sync/all - Request received:', req.body);
  controller.syncAll(req, res);
});

// ==================== ANALYTICS ROUTES ====================

// Get analytics data
router.get('/analytics', authenticate, (req, res) => {
  controller.getAnalytics(req, res);
});

export default router;
