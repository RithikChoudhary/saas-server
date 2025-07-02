import { Request, Response } from 'express';
import { GoogleWorkspaceConnectionService } from '../services/googleWorkspaceConnectionService';
import { GoogleWorkspaceUser } from '../../../../database/models/GoogleWorkspaceUser';
import { GoogleWorkspaceGroup } from '../../../../database/models/GoogleWorkspaceGroup';
import { GoogleWorkspaceOrgUnit } from '../../../../database/models/GoogleWorkspaceOrgUnit';
import { GoogleWorkspaceConnection } from '../../../../database/models/GoogleWorkspaceConnection';
import mongoose from 'mongoose';

export class GoogleWorkspaceController {
  private connectionService: GoogleWorkspaceConnectionService;

  constructor() {
    this.connectionService = new GoogleWorkspaceConnectionService();
  }

  // ==================== CONNECTION CRUD ====================

  /**
   * GET /api/integrations/google-workspace/connections
   * Get all Google Workspace connections for a company
   */
  async getConnections(req: Request, res: Response) {
    try {
      // Get companyId from authenticated user (set by auth middleware)
      const companyId = (req as any).user?.companyId || req.query.companyId;
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const connections = await this.connectionService.getConnections(companyId as string);
      
      res.json({
        success: true,
        connections,
        count: connections.length
      });
    } catch (error) {
      console.error('Error fetching connections:', error);
      res.status(500).json({ 
        error: 'Failed to fetch connections',
        details: (error as Error).message 
      });
    }
  }

  /**
   * GET /api/integrations/google-workspace/connections/:connectionId
   * Get a specific Google Workspace connection
   */
  async getConnection(req: Request, res: Response) {
    try {
      const { connectionId } = req.params;
      const { companyId } = req.query;
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const connection = await this.connectionService.getConnection(connectionId, companyId as string);
      
      res.json({
        success: true,
        connection
      });
    } catch (error) {
      console.error('Error fetching connection:', error);
      res.status(500).json({ 
        error: 'Failed to fetch connection',
        details: (error as Error).message 
      });
    }
  }

  /**
   * DELETE /api/integrations/google-workspace/connections/:connectionId
   * Delete a Google Workspace connection
   */
  async deleteConnection(req: Request, res: Response) {
    try {
      const { connectionId } = req.params;
      const { companyId } = req.query;
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      await this.connectionService.disconnectConnection(connectionId, companyId as string);
      
      res.json({
        success: true,
        message: 'Connection deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting connection:', error);
      res.status(500).json({ 
        error: 'Failed to delete connection',
        details: (error as Error).message 
      });
    }
  }

  // ==================== USER CRUD ====================

  /**
   * GET /api/integrations/google-workspace/users
   * Get all Google Workspace users for a company
   */
  async getUsers(req: Request, res: Response) {
    try {
      console.log('🔍 CONTROLLER: getUsers called');
      console.log('📋 Query params:', req.query);
      console.log('👤 User from auth:', req.user);
      
      const { companyId, connectionId, page = 1, limit = 50, search, isActive } = req.query;
      
      // Use companyId from auth middleware if not provided in query
      const finalCompanyId = companyId || req.user?.companyId;
      
      console.log('🏢 Final companyId:', finalCompanyId);
      
      if (!finalCompanyId) {
        console.log('❌ No company ID available');
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const query: any = { companyId: new mongoose.Types.ObjectId(finalCompanyId as string) };
      
      if (connectionId) {
        query.connectionId = new mongoose.Types.ObjectId(connectionId as string);
      }
      
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }
      
      if (search) {
        query.$or = [
          { primaryEmail: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } }
        ];
      }

      console.log('🔍 MongoDB query:', JSON.stringify(query, null, 2));

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      console.log('📄 Pagination: page', pageNum, 'limit', limitNum, 'skip', skip);

      const [users, total] = await Promise.all([
        GoogleWorkspaceUser.find(query)
          .sort({ lastSync: -1, primaryEmail: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        GoogleWorkspaceUser.countDocuments(query)
      ]);

      console.log('📊 Query results: found', users.length, 'users, total', total);

      res.json({
        success: true,
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      res.status(500).json({ 
        error: 'Failed to fetch users',
        details: (error as Error).message 
      });
    }
  }

  /**
   * GET /api/integrations/google-workspace/users/:userId
   * Get a specific Google Workspace user
   */
  async getUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { companyId } = req.query;
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const user = await GoogleWorkspaceUser.findOne({
        _id: new mongoose.Types.ObjectId(userId),
        companyId: new mongoose.Types.ObjectId(companyId as string)
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ 
        error: 'Failed to fetch user',
        details: (error as Error).message 
      });
    }
  }

  /**
   * PUT /api/integrations/google-workspace/users/:userId
   * Update a Google Workspace user (local data only)
   */
  async updateUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { companyId } = req.query;
      const updateData = req.body;
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      // Only allow updating certain fields locally
      const allowedFields = ['isActive', 'notes', 'tags'];
      const filteredUpdate = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj: any, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});

      const user = await GoogleWorkspaceUser.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(userId),
          companyId: new mongoose.Types.ObjectId(companyId as string)
        },
        { ...filteredUpdate, updatedAt: new Date() },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        user,
        message: 'User updated successfully'
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ 
        error: 'Failed to update user',
        details: (error as Error).message 
      });
    }
  }

  /**
   * DELETE /api/integrations/google-workspace/users/:userId
   * Delete a Google Workspace user (local data only)
   */
  async deleteUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { companyId } = req.query;
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const user = await GoogleWorkspaceUser.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(userId),
        companyId: new mongoose.Types.ObjectId(companyId as string)
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ 
        error: 'Failed to delete user',
        details: (error as Error).message 
      });
    }
  }

  // ==================== GROUP CRUD ====================

  /**
   * GET /api/integrations/google-workspace/groups
   * Get all Google Workspace groups for a company
   */
  async getGroups(req: Request, res: Response) {
    try {
      console.log('🔍 CONTROLLER: getGroups called');
      console.log('📋 Query params:', req.query);
      console.log('👤 User from auth:', req.user);
      
      const { companyId, connectionId, page = 1, limit = 50, search, isActive } = req.query;
      
      // Use companyId from auth middleware if not provided in query
      const finalCompanyId = companyId || req.user?.companyId;
      
      console.log('🏢 Final companyId:', finalCompanyId);
      
      if (!finalCompanyId) {
        console.log('❌ No company ID available');
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const query: any = { companyId: new mongoose.Types.ObjectId(finalCompanyId as string) };
      
      if (connectionId) {
        query.connectionId = new mongoose.Types.ObjectId(connectionId as string);
      }
      
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }
      
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      console.log('🔍 MongoDB query:', JSON.stringify(query, null, 2));

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      console.log('📄 Pagination: page', pageNum, 'limit', limitNum, 'skip', skip);

      const [groups, total] = await Promise.all([
        GoogleWorkspaceGroup.find(query)
          .sort({ lastSync: -1, email: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        GoogleWorkspaceGroup.countDocuments(query)
      ]);

      console.log('📊 Query results: found', groups.length, 'groups, total', total);

      res.json({
        success: true,
        groups,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('❌ Error fetching groups:', error);
      res.status(500).json({ 
        error: 'Failed to fetch groups',
        details: (error as Error).message 
      });
    }
  }

  /**
   * GET /api/integrations/google-workspace/groups/:groupId
   * Get a specific Google Workspace group
   */
  async getGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { companyId } = req.query;
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const group = await GoogleWorkspaceGroup.findOne({
        _id: new mongoose.Types.ObjectId(groupId),
        companyId: new mongoose.Types.ObjectId(companyId as string)
      });

      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      res.json({
        success: true,
        group
      });
    } catch (error) {
      console.error('Error fetching group:', error);
      res.status(500).json({ 
        error: 'Failed to fetch group',
        details: (error as Error).message 
      });
    }
  }

  // ==================== ORG UNIT CRUD ====================

  /**
   * GET /api/integrations/google-workspace/org-units
   * Get all Google Workspace organizational units for a company
   */
  async getOrgUnits(req: Request, res: Response) {
    try {
      const { companyId, connectionId, isActive } = req.query;
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const query: any = { companyId: new mongoose.Types.ObjectId(companyId as string) };
      
      if (connectionId) {
        query.connectionId = new mongoose.Types.ObjectId(connectionId as string);
      }
      
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const orgUnits = await GoogleWorkspaceOrgUnit.find(query)
        .sort({ orgUnitPath: 1 })
        .lean();

      res.json({
        success: true,
        orgUnits,
        count: orgUnits.length
      });
    } catch (error) {
      console.error('Error fetching org units:', error);
      res.status(500).json({ 
        error: 'Failed to fetch org units',
        details: (error as Error).message 
      });
    }
  }

  // ==================== SYNC OPERATIONS ====================

  /**
   * POST /api/integrations/google-workspace/sync/users
   * Sync users for a specific connection
   */
  async syncUsers(req: Request, res: Response) {
    try {
      const { connectionId, companyId } = req.body;
      
      if (!connectionId || !companyId) {
        return res.status(400).json({ error: 'Connection ID and Company ID are required' });
      }

      const result = await this.connectionService.syncUsers(connectionId, companyId);
      
      res.json({
        success: true,
        result,
        message: 'Users sync completed'
      });
    } catch (error) {
      console.error('Error syncing users:', error);
      res.status(500).json({ 
        error: 'Failed to sync users',
        details: (error as Error).message 
      });
    }
  }

  /**
   * POST /api/integrations/google-workspace/sync/groups
   * Sync groups for a specific connection
   */
  async syncGroups(req: Request, res: Response) {
    try {
      const { connectionId, companyId } = req.body;
      
      if (!connectionId || !companyId) {
        return res.status(400).json({ error: 'Connection ID and Company ID are required' });
      }

      const result = await this.connectionService.syncGroups(connectionId, companyId);
      
      res.json({
        success: true,
        result,
        message: 'Groups sync completed'
      });
    } catch (error) {
      console.error('Error syncing groups:', error);
      res.status(500).json({ 
        error: 'Failed to sync groups',
        details: (error as Error).message 
      });
    }
  }

  /**
   * POST /api/integrations/google-workspace/sync/org-units
   * Sync organizational units for a specific connection
   */
  async syncOrgUnits(req: Request, res: Response) {
    try {
      const { connectionId, companyId } = req.body;
      
      if (!connectionId || !companyId) {
        return res.status(400).json({ error: 'Connection ID and Company ID are required' });
      }

      const result = await this.connectionService.syncOrgUnits(connectionId, companyId);
      
      res.json({
        success: true,
        result,
        message: 'Organizational units sync completed'
      });
    } catch (error) {
      console.error('Error syncing org units:', error);
      res.status(500).json({ 
        error: 'Failed to sync org units',
        details: (error as Error).message 
      });
    }
  }

  /**
   * POST /api/integrations/google-workspace/sync/all
   * Sync all data (users, groups, org units) for a specific connection
   */
  async syncAll(req: Request, res: Response) {
    try {
      const { connectionId, companyId } = req.body;
      
      if (!connectionId || !companyId) {
        return res.status(400).json({ error: 'Connection ID and Company ID are required' });
      }

      const [usersResult, groupsResult, orgUnitsResult] = await Promise.all([
        this.connectionService.syncUsers(connectionId, companyId),
        this.connectionService.syncGroups(connectionId, companyId),
        this.connectionService.syncOrgUnits(connectionId, companyId)
      ]);
      
      res.json({
        success: true,
        results: {
          users: usersResult,
          groups: groupsResult,
          orgUnits: orgUnitsResult
        },
        message: 'Full sync completed'
      });
    } catch (error) {
      console.error('Error syncing all data:', error);
      res.status(500).json({ 
        error: 'Failed to sync all data',
        details: (error as Error).message 
      });
    }
  }

  // ==================== ANALYTICS ====================

  /**
   * GET /api/integrations/google-workspace/analytics
   * Get analytics data for Google Workspace
   */
  async getAnalytics(req: Request, res: Response) {
    try {
      // Get companyId from authenticated user (set by auth middleware)
      const companyId = (req as any).user?.companyId || req.query.companyId;
      
      console.log('📊 Analytics: Getting analytics for companyId:', companyId);
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const companyObjectId = new mongoose.Types.ObjectId(companyId as string);

      console.log('🔍 Analytics: Querying with companyObjectId:', companyObjectId);

      const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        archivedUsers,
        adminUsers,
        superAdminUsers,
        delegatedAdminUsers,
        users2svEnrolled,
        users2svEnforced,
        totalGroups,
        adminCreatedGroups,
        totalOrgUnits,
        connections
      ] = await Promise.all([
        GoogleWorkspaceUser.countDocuments({ companyId: companyObjectId }),
        GoogleWorkspaceUser.countDocuments({ companyId: companyObjectId, isActive: true }),
        GoogleWorkspaceUser.countDocuments({ companyId: companyObjectId, suspended: true }),
        GoogleWorkspaceUser.countDocuments({ companyId: companyObjectId, archived: true }),
        GoogleWorkspaceUser.countDocuments({ companyId: companyObjectId, isAdmin: true }),
        GoogleWorkspaceUser.countDocuments({ companyId: companyObjectId, isSuperAdmin: true }),
        GoogleWorkspaceUser.countDocuments({ companyId: companyObjectId, isDelegatedAdmin: true }),
        GoogleWorkspaceUser.countDocuments({ companyId: companyObjectId, isEnrolledIn2Sv: true }),
        GoogleWorkspaceUser.countDocuments({ companyId: companyObjectId, isEnforcedIn2Sv: true }),
        GoogleWorkspaceGroup.countDocuments({ companyId: companyObjectId }),
        GoogleWorkspaceGroup.countDocuments({ companyId: companyObjectId, adminCreated: true }),
        GoogleWorkspaceOrgUnit.countDocuments({ companyId: companyObjectId }),
        GoogleWorkspaceConnection.countDocuments({ companyId: companyObjectId, isActive: true })
      ]);

      console.log('📊 Analytics results:', {
        totalUsers,
        activeUsers,
        suspendedUsers,
        archivedUsers,
        adminUsers,
        superAdminUsers,
        delegatedAdminUsers,
        users2svEnrolled,
        users2svEnforced,
        totalGroups,
        adminCreatedGroups,
        totalOrgUnits,
        connections
      });

      const analytics = {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          archived: archivedUsers,
          admins: adminUsers,
          superAdmins: superAdminUsers,
          delegatedAdmins: delegatedAdminUsers,
          twoFactorEnrolled: users2svEnrolled,
          twoFactorEnforced: users2svEnforced
        },
        groups: {
          total: totalGroups,
          adminCreated: adminCreatedGroups,
          userCreated: totalGroups - adminCreatedGroups
        },
        orgUnits: {
          total: totalOrgUnits
        },
        connections: {
          total: connections
        },
        security: {
          twoFactorPercentage: totalUsers > 0 ? Math.round((users2svEnrolled / totalUsers) * 100) : 0,
          adminPercentage: totalUsers > 0 ? Math.round((adminUsers / totalUsers) * 100) : 0,
          activePercentage: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0
        }
      };

      console.log('✅ Analytics: Sending response:', analytics);

      res.json({
        success: true,
        analytics
      });
    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      res.status(500).json({ 
        error: 'Failed to fetch analytics',
        details: (error as Error).message 
      });
    }
  }
}
