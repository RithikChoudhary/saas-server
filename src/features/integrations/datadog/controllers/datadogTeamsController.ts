import { Request, Response } from 'express';
import { DatadogTeamService } from '../services/datadogTeamService';

export class DatadogTeamsController {
  private teamService: DatadogTeamService;

  constructor() {
    this.teamService = new DatadogTeamService();
  }

  async getTeams(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId, correlationStatus, page = 1, limit = 50 } = req.query;
      
      let teams = await this.teamService.getTeams(companyId, connectionId as string);
      
      // Apply filters
      if (correlationStatus) {
        teams = teams.filter(team => team.correlationStatus === correlationStatus);
      }
      
      // Apply pagination
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedTeams = teams.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: {
          teams: paginatedTeams,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: teams.length,
            totalPages: Math.ceil(teams.length / Number(limit))
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching Datadog teams:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getTeamById(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { teamId } = req.params;
      
      const team = await this.teamService.getTeamById(teamId, companyId);
      
      res.json({
        success: true,
        data: team
      });
    } catch (error: any) {
      console.error('Error fetching team:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async getTeamMembers(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { teamId } = req.params;
      const { connectionId } = req.query;
      
      if (!connectionId) {
        res.status(400).json({
          success: false,
          error: 'Connection ID is required'
        });
        return;
      }

      const members = await this.teamService.getTeamMembers(teamId, companyId, connectionId as string);
      
      res.json({
        success: true,
        data: members
      });
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async syncTeams(req: Request, res: Response): Promise<void> {
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

      const result = await this.teamService.syncTeams(connectionId, companyId);
      
      res.json({
        success: true,
        data: result,
        message: 'Team sync completed successfully'
      });
    } catch (error: any) {
      console.error('Error syncing teams:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getTeamStats(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId } = req.query;
      
      const stats = await this.teamService.getTeamStats(companyId, connectionId as string);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Error fetching team stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getTeamsByCorrelationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { correlationStatus } = req.params;
      const { connectionId } = req.query;
      
      const teams = await this.teamService.getTeams(companyId, connectionId as string);
      const filteredTeams = teams.filter(team => team.correlationStatus === correlationStatus);
      
      res.json({
        success: true,
        data: {
          teams: filteredTeams,
          count: filteredTeams.length
        }
      });
    } catch (error: any) {
      console.error('Error fetching teams by correlation status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async searchTeams(req: Request, res: Response): Promise<void> {
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

      const teams = await this.teamService.getTeams(companyId, connectionId as string);
      const searchTerm = (q as string).toLowerCase();
      
      const filteredTeams = teams.filter(team => 
        team.name.toLowerCase().includes(searchTerm) ||
        team.handle.toLowerCase().includes(searchTerm) ||
        (team.description && team.description.toLowerCase().includes(searchTerm))
      );
      
      res.json({
        success: true,
        data: {
          teams: filteredTeams,
          count: filteredTeams.length,
          query: q
        }
      });
    } catch (error: any) {
      console.error('Error searching teams:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getTeamSummary(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { teamId } = req.params;
      
      const team = await this.teamService.getTeamById(teamId, companyId);
      
      const summary = {
        id: team.id,
        name: team.name,
        handle: team.handle,
        description: team.description,
        userCount: team.userCount,
        linkCount: team.linkCount,
        summary: team.summary,
        correlationStatus: team.correlationStatus,
        googleWorkspaceGroupId: team.googleWorkspaceGroupId
      };
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error: any) {
      console.error('Error fetching team summary:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async exportTeams(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId, format = 'json' } = req.query;
      
      const teams = await this.teamService.getTeams(companyId, connectionId as string);
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvHeaders = 'Name,Handle,Description,User Count,Link Count,Dashboards,Monitors,SLOs,Correlation Status,Created At\n';
        const csvRows = teams.map(team => 
          `"${team.name}","${team.handle}","${team.description || ''}","${team.userCount}","${team.linkCount}","${team.summary?.dashboards || 0}","${team.summary?.monitors || 0}","${team.summary?.slos || 0}","${team.correlationStatus}","${team.createdAt}"`
        ).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="datadog-teams.csv"');
        res.send(csvHeaders + csvRows);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="datadog-teams.json"');
        res.json({
          success: true,
          data: teams,
          exportedAt: new Date().toISOString(),
          count: teams.length
        });
      }
    } catch (error: any) {
      console.error('Error exporting teams:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getTeamAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.user as any;
      const { connectionId } = req.query;
      
      const teams = await this.teamService.getTeams(companyId, connectionId as string);
      
      // Calculate analytics
      const analytics = {
        totalTeams: teams.length,
        totalMembers: teams.reduce((sum, team) => sum + team.userCount, 0),
        totalDashboards: teams.reduce((sum, team) => sum + (team.summary?.dashboards || 0), 0),
        totalMonitors: teams.reduce((sum, team) => sum + (team.summary?.monitors || 0), 0),
        totalSLOs: teams.reduce((sum, team) => sum + (team.summary?.slos || 0), 0),
        averageTeamSize: teams.length > 0 ? Math.round(teams.reduce((sum, team) => sum + team.userCount, 0) / teams.length) : 0,
        correlationBreakdown: {
          matched: teams.filter(t => t.correlationStatus === 'matched').length,
          unmatched: teams.filter(t => t.correlationStatus === 'unmatched').length,
          conflict: teams.filter(t => t.correlationStatus === 'conflict').length
        },
        topTeamsBySize: teams
          .sort((a, b) => b.userCount - a.userCount)
          .slice(0, 10)
          .map(team => ({
            name: team.name,
            handle: team.handle,
            userCount: team.userCount,
            dashboards: team.summary?.dashboards || 0,
            monitors: team.summary?.monitors || 0
          })),
        topTeamsByResources: teams
          .sort((a, b) => ((b.summary?.dashboards || 0) + (b.summary?.monitors || 0)) - ((a.summary?.dashboards || 0) + (a.summary?.monitors || 0)))
          .slice(0, 10)
          .map(team => ({
            name: team.name,
            handle: team.handle,
            totalResources: (team.summary?.dashboards || 0) + (team.summary?.monitors || 0),
            dashboards: team.summary?.dashboards || 0,
            monitors: team.summary?.monitors || 0
          }))
      };
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      console.error('Error fetching team analytics:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
