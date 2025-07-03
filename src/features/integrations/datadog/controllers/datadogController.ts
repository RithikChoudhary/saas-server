import { Request, Response } from 'express';
import { DatadogConnectionService } from '../services/datadogConnectionService';
import { DatadogUserService } from '../services/datadogUserService';
import { DatadogTeamService } from '../services/datadogTeamService';

export class DatadogController {
  private connectionService: DatadogConnectionService;
  private userService: DatadogUserService;
  private teamService: DatadogTeamService;

  constructor() {
    this.connectionService = new DatadogConnectionService();
    this.userService = new DatadogUserService();
    this.teamService = new DatadogTeamService();
  }

  // Connection Management
  async createConnection(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      
      const result = await this.connectionService.createConnection(companyId);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Datadog connection created successfully'
      });
    } catch (error: any) {
      console.error('Error creating Datadog connection:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getConnections(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      
      const connections = await this.connectionService.getConnections(companyId);
      
      res.json({
        success: true,
        data: connections
      });
    } catch (error: any) {
      console.error('Error fetching Datadog connections:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getConnectionStats(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId } = req.params;
      
      const stats = await this.connectionService.getConnectionStats(connectionId, companyId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Error fetching connection stats:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async testConnection(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId } = req.params;
      
      const result = await this.connectionService.testConnection(connectionId, companyId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error testing connection:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async disconnectConnection(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId } = req.params;
      
      const result = await this.connectionService.disconnectConnection(connectionId, companyId);
      
      res.json({
        success: true,
        data: result,
        message: 'Connection disconnected successfully'
      });
    } catch (error: any) {
      console.error('Error disconnecting connection:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  // Dashboard Overview
  async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId } = req.query;
      
      const [connections, userStats, teamStats] = await Promise.all([
        this.connectionService.getConnections(companyId),
        this.userService.getUserStats(companyId, connectionId as string),
        this.teamService.getTeamStats(companyId, connectionId as string)
      ]);

      const overview = {
        connections: connections.length,
        activeConnections: connections.filter(c => c.isActive).length,
        users: userStats,
        teams: teamStats,
        lastSync: connections.length > 0 ? Math.max(...connections.map(c => new Date(c.lastSync).getTime())) : null
      };
      
      res.json({
        success: true,
        data: overview
      });
    } catch (error: any) {
      console.error('Error fetching Datadog overview:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Sync Operations
  async syncAll(req: Request, res: Response): Promise<void> {
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

      // Start sync operations in parallel
      const [userSyncResult, teamSyncResult] = await Promise.all([
        this.userService.syncUsers(connectionId, companyId),
        this.teamService.syncTeams(connectionId, companyId)
      ]);

      res.json({
        success: true,
        data: {
          users: userSyncResult,
          teams: teamSyncResult
        },
        message: 'Sync completed successfully'
      });
    } catch (error: any) {
      console.error('Error syncing Datadog data:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSyncStatus(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const connections = await this.connectionService.getConnections(companyId);
      
      const syncStatus = connections.map(conn => ({
        connectionId: conn.id,
        organizationName: conn.organizationName,
        syncStatus: conn.syncStatus,
        lastSync: conn.lastSync,
        isActive: conn.isActive
      }));
      
      res.json({
        success: true,
        data: syncStatus
      });
    } catch (error: any) {
      console.error('Error fetching sync status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
