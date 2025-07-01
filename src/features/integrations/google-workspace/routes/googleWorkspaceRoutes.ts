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
router.get('/connections', (req, res) => {
  controller.getConnections(req, res);
});

// Get a specific connection
router.get('/connections/:connectionId', (req, res) => {
  controller.getConnection(req, res);
});

// Delete a connection
router.delete('/connections/:connectionId', (req, res) => {
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
router.get('/users', (req, res) => {
  controller.getUsers(req, res);
});

// Get a specific user
router.get('/users/:userId', (req, res) => {
  controller.getUser(req, res);
});

// Update a user (local data only)
router.put('/users/:userId', (req, res) => {
  controller.updateUser(req, res);
});

// Delete a user (local data only)
router.delete('/users/:userId', (req, res) => {
  controller.deleteUser(req, res);
});

// ==================== GROUP ROUTES ====================

// Get all groups
router.get('/groups', (req, res) => {
  controller.getGroups(req, res);
});

// Get a specific group
router.get('/groups/:groupId', (req, res) => {
  controller.getGroup(req, res);
});

// ==================== ORG UNIT ROUTES ====================

// Get all organizational units
router.get('/org-units', (req, res) => {
  controller.getOrgUnits(req, res);
});

// ==================== SYNC ROUTES ====================

// Sync users
router.post('/sync/users', (req, res) => {
  controller.syncUsers(req, res);
});

// Sync groups
router.post('/sync/groups', (req, res) => {
  controller.syncGroups(req, res);
});

// Sync organizational units
router.post('/sync/org-units', (req, res) => {
  controller.syncOrgUnits(req, res);
});

// Sync all data
router.post('/sync/all', (req, res) => {
  controller.syncAll(req, res);
});

// ==================== ANALYTICS ROUTES ====================

// Get analytics data
router.get('/analytics', (req, res) => {
  controller.getAnalytics(req, res);
});

export default router;
