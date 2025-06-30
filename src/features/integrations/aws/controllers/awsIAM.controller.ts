import { Request, Response } from 'express';
import { AWSIAMService } from '../services/awsIAMService';
import { AWSGroupsService } from '../services/awsGroupsService';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: any;
    email: string;
  };
}

export class AWSIAMController {
  private awsIAMService: AWSIAMService;
  private awsGroupsService: AWSGroupsService;

  constructor() {
    this.awsIAMService = new AWSIAMService();
    this.awsGroupsService = new AWSGroupsService();
  }

  // GET /api/integrations/aws/iam/users
  async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Fetching users...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { accountId } = req.query;

      // Get users from database (synced from AWS)
      const users = await this.awsIAMService.getUsersFromDatabase(
        companyId, 
        accountId as string
      );

      console.log(`✅ AWS IAM: Returning ${users.length} users`);
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('❌ AWS IAM Users Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS IAM users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/iam/groups
  async getGroups(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Fetching groups...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { accountId } = req.query;

      // Get groups from database (synced from AWS)
      const groups = await this.awsIAMService.getGroupsFromDatabase(
        companyId,
        accountId as string
      );

      console.log(`✅ AWS IAM: Returning ${groups.length} groups`);
      res.json({
        success: true,
        data: groups
      });
    } catch (error) {
      console.error('❌ AWS IAM Groups Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS IAM groups',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/aws/iam/users
  async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Creating user...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { userName, email, groups, accountId } = req.body;

      if (!userName || !accountId) {
        return res.status(400).json({
          success: false,
          message: 'userName and accountId are required'
        });
      }

      // Create user in AWS using real AWS SDK
      const newUser = await this.awsIAMService.createUserInAWS(companyId, accountId, {
        userName,
        email,
        groups
      });

      console.log(`✅ AWS IAM: User ${userName} created in AWS`);
      res.status(201).json({
        success: true,
        data: newUser,
        message: 'AWS IAM user created successfully'
      });
    } catch (error) {
      console.error('❌ AWS IAM Create User Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create AWS IAM user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // PUT /api/integrations/aws/iam/users/:id
  async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Updating user...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const { newUserName, groups } = req.body;

      // Update user in AWS using real AWS SDK
      const updatedUser = await this.awsIAMService.updateUserInAWS(companyId, id, {
        newUserName,
        groups
      });

      console.log(`✅ AWS IAM: User ${id} updated in AWS`);
      res.json({
        success: true,
        data: updatedUser,
        message: 'AWS IAM user updated successfully'
      });
    } catch (error) {
      console.error('❌ AWS IAM Update User Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update AWS IAM user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/integrations/aws/iam/users/:id
  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Deleting user...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;

      // Delete user from AWS using real AWS SDK
      await this.awsIAMService.deleteUserFromAWS(companyId, id);

      console.log(`✅ AWS IAM: User ${id} deleted from AWS`);
      res.json({
        success: true,
        message: 'AWS IAM user deleted successfully'
      });
    } catch (error) {
      console.error('❌ AWS IAM Delete User Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete AWS IAM user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/aws/iam/users/sync
  async syncUsers(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Syncing users from AWS...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      // Sync users from AWS using real AWS SDK
      const syncResult = await this.awsIAMService.syncUsersFromAWS(companyId);

      console.log('✅ AWS IAM: Users synced from AWS');
      res.json({
        success: true,
        message: 'AWS IAM users synced successfully',
        data: {
          syncedUsers: syncResult.syncedUsers,
          syncedGroups: syncResult.syncedGroups,
          lastSync: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ AWS IAM Sync Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync AWS IAM users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/iam/stats
  async getStats(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Fetching stats...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      // Get real stats from database
      const stats = await this.awsIAMService.getUserStats(companyId);

      console.log('✅ AWS IAM: Stats retrieved');
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ AWS IAM Stats Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS IAM stats',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // POST /api/integrations/aws/iam/groups
  async createGroup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Creating group...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { groupName, path, policies, accountId } = req.body;

      if (!groupName || !accountId) {
        return res.status(400).json({
          success: false,
          message: 'groupName and accountId are required'
        });
      }

      // Create group in AWS using real AWS SDK
      const newGroup = await this.awsGroupsService.createGroupInAWS(companyId, accountId, {
        groupName,
        path,
        policies
      });

      console.log(`✅ AWS IAM: Group ${groupName} created in AWS`);
      res.status(201).json({
        success: true,
        data: newGroup,
        message: 'AWS IAM group created successfully'
      });
    } catch (error) {
      console.error('❌ AWS IAM Create Group Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create AWS IAM group',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // PUT /api/integrations/aws/iam/groups/:id
  async updateGroup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Updating group...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;
      const { newGroupName, policies } = req.body;

      // Update group in AWS using real AWS SDK
      const updatedGroup = await this.awsGroupsService.updateGroupInAWS(companyId, id, {
        newGroupName,
        policies
      });

      console.log(`✅ AWS IAM: Group ${id} updated in AWS`);
      res.json({
        success: true,
        data: updatedGroup,
        message: 'AWS IAM group updated successfully'
      });
    } catch (error) {
      console.error('❌ AWS IAM Update Group Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update AWS IAM group',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // DELETE /api/integrations/aws/iam/groups/:id
  async deleteGroup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Deleting group...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { id } = req.params;

      // Delete group from AWS using real AWS SDK
      await this.awsGroupsService.deleteGroupFromAWS(companyId, id);

      console.log(`✅ AWS IAM: Group ${id} deleted from AWS`);
      res.json({
        success: true,
        message: 'AWS IAM group deleted successfully'
      });
    } catch (error) {
      console.error('❌ AWS IAM Delete Group Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete AWS IAM group',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // GET /api/integrations/aws/iam/policies
  async getAvailablePolicies(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 AWS IAM: Fetching available policies...');
      
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: 'Company ID not found in request'
        });
      }

      const { accountId } = req.query;

      if (!accountId) {
        return res.status(400).json({
          success: false,
          message: 'accountId is required'
        });
      }

      // Get available policies from AWS
      const policies = await this.awsGroupsService.getAvailablePolicies(
        companyId,
        accountId as string
      );

      console.log(`✅ AWS IAM: Returning ${policies.length} policies`);
      res.json({
        success: true,
        data: policies
      });
    } catch (error) {
      console.error('❌ AWS IAM Policies Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch AWS IAM policies',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
