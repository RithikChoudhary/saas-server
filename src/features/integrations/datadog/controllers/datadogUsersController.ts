import { Request, Response } from 'express';
import { DatadogUserService } from '../services/datadogUserService';

export class DatadogUsersController {
  private userService: DatadogUserService;

  constructor() {
    this.userService = new DatadogUserService();
  }

  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId, status, correlationStatus, page = 1, limit = 50 } = req.query;
      
      let users = await this.userService.getUsers(companyId, connectionId as string);
      
      // Apply filters
      if (status) {
        users = users.filter(user => user.status === status);
      }
      
      if (correlationStatus) {
        users = users.filter(user => user.correlationStatus === correlationStatus);
      }
      
      // Apply pagination
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedUsers = users.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: {
          users: paginatedUsers,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: users.length,
            totalPages: Math.ceil(users.length / Number(limit))
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching Datadog users:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { userId } = req.params;
      
      const user = await this.userService.getUserById(userId, companyId);
      
      res.json({
        success: true,
        data: user
      });
    } catch (error: any) {
      console.error('Error fetching user:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async syncUsers(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId } = req.body;
      
      if (!connectionId) {
        res.status(400).json({
          success: false,
          error: 'Connection ID is required'
        });
        return;
      }

      const result = await this.userService.syncUsers(connectionId, companyId);
      
      res.json({
        success: true,
        data: result,
        message: 'User sync completed successfully'
      });
    } catch (error: any) {
      console.error('Error syncing users:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId } = req.query;
      
      const stats = await this.userService.getUserStats(companyId, connectionId as string);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUsersByStatus(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { status } = req.params;
      const { connectionId } = req.query;
      
      const users = await this.userService.getUsers(companyId, connectionId as string);
      const filteredUsers = users.filter(user => user.status.toLowerCase() === status.toLowerCase());
      
      res.json({
        success: true,
        data: {
          users: filteredUsers,
          count: filteredUsers.length
        }
      });
    } catch (error: any) {
      console.error('Error fetching users by status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUsersByCorrelationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { correlationStatus } = req.params;
      const { connectionId } = req.query;
      
      const users = await this.userService.getUsers(companyId, connectionId as string);
      const filteredUsers = users.filter(user => user.correlationStatus === correlationStatus);
      
      res.json({
        success: true,
        data: {
          users: filteredUsers,
          count: filteredUsers.length
        }
      });
    } catch (error: any) {
      console.error('Error fetching users by correlation status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { q, connectionId } = req.query;
      
      if (!q) {
        res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
        return;
      }

      const users = await this.userService.getUsers(companyId, connectionId as string);
      const searchTerm = (q as string).toLowerCase();
      
      const filteredUsers = users.filter(user => 
        user.name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.handle.toLowerCase().includes(searchTerm) ||
        (user.title && user.title.toLowerCase().includes(searchTerm))
      );
      
      res.json({
        success: true,
        data: {
          users: filteredUsers,
          count: filteredUsers.length,
          query: q
        }
      });
    } catch (error: any) {
      console.error('Error searching users:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async exportUsers(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId, format = 'json' } = req.query;
      
      const users = await this.userService.getUsers(companyId, connectionId as string);
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvHeaders = 'Name,Email,Handle,Title,Status,Verified,Disabled,Roles,Teams,Correlation Status,Created At\n';
        const csvRows = users.map(user => 
          `"${user.name}","${user.email}","${user.handle}","${user.title || ''}","${user.status}","${user.verified}","${user.disabled}","${user.roles.join(';')}","${user.teams.join(';')}","${user.correlationStatus}","${user.createdAt}"`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="datadog-users.csv"');
        res.send(csvHeaders + csvRows);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="datadog-users.json"');
        res.json({
          success: true,
          data: users,
          exportedAt: new Date().toISOString(),
          count: users.length
        });
      }
    } catch (error: any) {
      console.error('Error exporting users:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
