import { DatadogConnection, DatadogUsageStats } from '../../../../database/models';
import { DatadogConnectionService } from './datadogConnectionService';
import { DatadogUserService } from './datadogUserService';
import { DatadogTeamService } from './datadogTeamService';
import { decrypt } from '../../../../utils/encryption';
import axios from 'axios';
import * as cron from 'node-cron';

export class DatadogSyncService {
  private connectionService: DatadogConnectionService;
  private userService: DatadogUserService;
  private teamService: DatadogTeamService;
  private syncJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.connectionService = new DatadogConnectionService();
    this.userService = new DatadogUserService();
    this.teamService = new DatadogTeamService();
  }

  // Manual sync for all connections of a company
  async syncCompanyData(companyId: string): Promise<any> {
    try {
      const connections = await DatadogConnection.find({
        companyId,
        isActive: true
      });

      const results = {
        totalConnections: connections.length,
        successful: 0,
        failed: 0,
        details: [] as any[]
      };

      for (const connection of connections) {
        try {
          const connectionId = (connection as any)._id.toString();
          
          await DatadogConnection.findByIdAndUpdate(connectionId, {
            syncStatus: 'syncing'
          });

          // Sync users and teams in parallel
          const [userResult, teamResult] = await Promise.all([
            this.userService.syncUsers(connectionId, companyId),
            this.teamService.syncTeams(connectionId, companyId)
          ]);

          // Collect usage stats
          await this.collectUsageStats(connectionId, companyId);

          await DatadogConnection.findByIdAndUpdate(connectionId, {
            syncStatus: 'completed',
            lastSync: new Date(),
            errorMessage: null
          });

          results.successful++;
          results.details.push({
            connectionId: connectionId,
            organizationName: connection.organizationName,
            status: 'success',
            users: userResult,
            teams: teamResult
          });

        } catch (error: any) {
          const connectionId = (connection as any)._id.toString();
          
          await DatadogConnection.findByIdAndUpdate(connectionId, {
            syncStatus: 'failed',
            errorMessage: error.message
          });

          results.failed++;
          results.details.push({
            connectionId: connectionId,
            organizationName: connection.organizationName,
            status: 'failed',
            error: error.message
          });
        }
      }

      return results;
    } catch (error: any) {
      console.error('Error syncing company Datadog data:', error);
      throw error;
    }
  }

  // Collect usage statistics from Datadog API
  async collectUsageStats(connectionId: string, companyId: string): Promise<void> {
    try {
      const connection = await DatadogConnection.findOne({
        _id: connectionId,
        companyId,
        isActive: true
      });

      if (!connection) {
        throw new Error('Connection not found');
      }

      const apiKey = decrypt(connection.apiKey);
      const applicationKey = decrypt(connection.applicationKey);
      const baseUrl = `https://api.${connection.site}`;

      // Get current date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Collect various usage metrics
      const usagePromises = [
        this.getLogsUsage(baseUrl, apiKey, applicationKey, startDateStr, endDateStr),
        this.getMetricsUsage(baseUrl, apiKey, applicationKey, startDateStr, endDateStr),
        this.getTracesUsage(baseUrl, apiKey, applicationKey, startDateStr, endDateStr),
        this.getSyntheticUsage(baseUrl, apiKey, applicationKey, startDateStr, endDateStr),
        this.getRumUsage(baseUrl, apiKey, applicationKey, startDateStr, endDateStr)
      ];

      const [logsUsage, metricsUsage, tracesUsage, syntheticUsage, rumUsage] = await Promise.allSettled(usagePromises);

      // Process and store usage data
      const usageData = {
        companyId,
        connectionId,
        date: new Date(),
        period: 'monthly' as const,
        metrics: {
          logsIngested: this.extractUsageValue(logsUsage),
          metricsIngested: this.extractUsageValue(metricsUsage),
          tracesIngested: this.extractUsageValue(tracesUsage),
          syntheticTestRuns: this.extractUsageValue(syntheticUsage),
          rumSessions: this.extractUsageValue(rumUsage)
        }
      };

      // Store usage stats
      await DatadogUsageStats.create(usageData);

    } catch (error: any) {
      console.error('Error collecting usage stats:', error);
      // Don't throw error to avoid breaking the sync process
    }
  }

  private async getLogsUsage(baseUrl: string, apiKey: string, applicationKey: string, startDate: string, endDate: string): Promise<number> {
    try {
      const response = await axios.get(`${baseUrl}/api/v1/usage/logs`, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': applicationKey
        },
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      
      return response.data.usage?.reduce((sum: number, day: any) => sum + (day.ingested_events || 0), 0) || 0;
    } catch (error) {
      console.error('Error fetching logs usage:', error);
      return 0;
    }
  }

  private async getMetricsUsage(baseUrl: string, apiKey: string, applicationKey: string, startDate: string, endDate: string): Promise<number> {
    try {
      const response = await axios.get(`${baseUrl}/api/v1/usage/timeseries`, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': applicationKey
        },
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      
      return response.data.usage?.reduce((sum: number, day: any) => sum + (day.num_custom_timeseries || 0), 0) || 0;
    } catch (error) {
      console.error('Error fetching metrics usage:', error);
      return 0;
    }
  }

  private async getTracesUsage(baseUrl: string, apiKey: string, applicationKey: string, startDate: string, endDate: string): Promise<number> {
    try {
      const response = await axios.get(`${baseUrl}/api/v1/usage/traces`, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': applicationKey
        },
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      
      return response.data.usage?.reduce((sum: number, day: any) => sum + (day.trace_search_indexed_events_count || 0), 0) || 0;
    } catch (error) {
      console.error('Error fetching traces usage:', error);
      return 0;
    }
  }

  private async getSyntheticUsage(baseUrl: string, apiKey: string, applicationKey: string, startDate: string, endDate: string): Promise<number> {
    try {
      const response = await axios.get(`${baseUrl}/api/v1/usage/synthetics`, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': applicationKey
        },
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      
      return response.data.usage?.reduce((sum: number, day: any) => sum + (day.check_calls_count || 0), 0) || 0;
    } catch (error) {
      console.error('Error fetching synthetic usage:', error);
      return 0;
    }
  }

  private async getRumUsage(baseUrl: string, apiKey: string, applicationKey: string, startDate: string, endDate: string): Promise<number> {
    try {
      const response = await axios.get(`${baseUrl}/api/v1/usage/rum`, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': applicationKey
        },
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
      
      return response.data.usage?.reduce((sum: number, day: any) => sum + (day.session_count || 0), 0) || 0;
    } catch (error) {
      console.error('Error fetching RUM usage:', error);
      return 0;
    }
  }

  private extractUsageValue(result: PromiseSettledResult<number>): number {
    return result.status === 'fulfilled' ? result.value : 0;
  }

  // Schedule periodic sync for a company
  schedulePeriodicSync(companyId: string, cronExpression: string = '0 2 * * *'): void {
    // Default: Run daily at 2 AM
    const jobKey = `datadog-sync-${companyId}`;
    
    // Cancel existing job if it exists
    if (this.syncJobs.has(jobKey)) {
      this.syncJobs.get(jobKey)?.stop();
      this.syncJobs.delete(jobKey);
    }

    // Schedule new job
    const job = cron.schedule(cronExpression, async () => {
      console.log(`🔄 Starting scheduled Datadog sync for company ${companyId}`);
      try {
        await this.syncCompanyData(companyId);
        console.log(`✅ Completed scheduled Datadog sync for company ${companyId}`);
      } catch (error) {
        console.error(`❌ Failed scheduled Datadog sync for company ${companyId}:`, error);
      }
    });

    this.syncJobs.set(jobKey, job);
    
    console.log(`📅 Scheduled Datadog sync for company ${companyId} with cron: ${cronExpression}`);
  }

  // Cancel scheduled sync for a company
  cancelPeriodicSync(companyId: string): void {
    const jobKey = `datadog-sync-${companyId}`;
    
    if (this.syncJobs.has(jobKey)) {
      this.syncJobs.get(jobKey)?.stop();
      this.syncJobs.delete(jobKey);
      console.log(`🛑 Cancelled scheduled Datadog sync for company ${companyId}`);
    }
  }

  // Get sync status for all companies
  getSyncStatus(): any {
    const activeJobs = Array.from(this.syncJobs.keys()).map(key => ({
      companyId: key.replace('datadog-sync-', ''),
      status: 'scheduled',
      nextRun: 'Based on cron schedule'
    }));

    return {
      totalScheduledJobs: activeJobs.length,
      activeJobs
    };
  }

  // Initialize periodic sync for all active connections
  async initializePeriodicSync(): Promise<void> {
    try {
      const activeConnections = await DatadogConnection.find({
        isActive: true
      }).distinct('companyId');

      for (const companyId of activeConnections) {
        this.schedulePeriodicSync(companyId);
      }

      console.log(`🚀 Initialized periodic Datadog sync for ${activeConnections.length} companies`);
    } catch (error) {
      console.error('Error initializing periodic sync:', error);
    }
  }

  // Cleanup - stop all scheduled jobs
  cleanup(): void {
    for (const [key, job] of this.syncJobs) {
      job.stop();
    }
    this.syncJobs.clear();
    console.log('🧹 Cleaned up all Datadog sync jobs');
  }
}

// Export singleton instance
export const datadogSyncService = new DatadogSyncService();
