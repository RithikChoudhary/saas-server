import { DatadogConnection, DatadogTeam, GoogleWorkspaceGroup } from '../../../../database/models';
import { decrypt } from '../../../../utils/encryption';
import axios from 'axios';

export class DatadogTeamService {
  
  async syncTeams(connectionId: string, companyId: string): Promise<any> {
    try {
      // First try to find a formal DatadogConnection
      let connection = await DatadogConnection.findOne({
        _id: connectionId,
        companyId,
        isActive: true
      });

      let apiKey: string = '';
      let applicationKey: string = '';
      let site: string = 'datadoghq.com';
      let organizationName: string = 'Unknown';
      let credentialsFound = false;

      if (connection) {
        // Formal connection found - check if it has valid credentials
        console.log('Using formal DatadogConnection for team sync');
        
        // Check if credentials exist and are properly formatted
        const hasValidApiKey = connection.apiKey && 
                              typeof connection.apiKey === 'object' && 
                              connection.apiKey.encrypted && 
                              connection.apiKey.iv && 
                              connection.apiKey.authTag;
                              
        const hasValidAppKey = connection.applicationKey && 
                              typeof connection.applicationKey === 'object' && 
                              connection.applicationKey.encrypted && 
                              connection.applicationKey.iv && 
                              connection.applicationKey.authTag;

        if (hasValidApiKey && hasValidAppKey) {
          try {
            apiKey = decrypt(connection.apiKey);
            applicationKey = decrypt(connection.applicationKey);
            site = connection.site;
            organizationName = connection.organizationName;
            console.log('Successfully decrypted formal connection credentials for teams');
          } catch (error) {
            console.error('Error decrypting Datadog credentials:', error);
            console.log('Falling back to credentials service due to decryption error');
            connection = null; // Force fallback to credentials service
          }
        } else {
          console.log('Formal connection found but credentials are invalid/undefined, falling back to credentials service');
          connection = null; // Force fallback to credentials service
        }
      }
      
      if (!connection) {
        // No formal connection - check if this is a credentials-based connection
        console.log('No formal connection found, checking credentials-based connection for teams');
        
        const credentialsService = new (require('../../../credentials/services/credentialsService').CredentialsService)();
        const credentialsData = await credentialsService.getDecryptedCredentials(companyId, 'datadog');
        
        if (!credentialsData) {
          throw new Error('Connection not found - no formal connection or credentials available');
        }

        apiKey = credentialsData.apiKey;
        applicationKey = credentialsData.applicationKey;
        site = credentialsData.site || 'datadoghq.com';
        organizationName = credentialsData.organizationName || 'Datadog Organization';

        console.log('Using credentials-based connection for team sync');
      }

      const baseUrl = `https://api.${site}`;

      // Fetch teams from Datadog API
      const response = await axios.get(`${baseUrl}/api/v2/team`, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': applicationKey,
          'Content-Type': 'application/json'
        },
        params: {
          'page[size]': 100
          // Removed invalid 'include': 'team_links,user_team_permissions' parameter
          // This was causing 403 errors due to invalid include values
        }
      });

      const datadogTeams = response.data.data;
      const syncResults = {
        total: datadogTeams.length,
        created: 0,
        updated: 0,
        errors: 0
      };

      // Process each team
      for (const ddTeam of datadogTeams) {
        try {
          const teamData = {
            companyId,
            connectionId,
            datadogTeamId: ddTeam.id,
            name: ddTeam.attributes.name,
            handle: ddTeam.attributes.handle,
            description: ddTeam.attributes.description,
            avatar: ddTeam.attributes.avatar,
            banner: ddTeam.attributes.banner,
            hiddenModules: ddTeam.attributes.hidden_modules || [],
            linkCount: ddTeam.attributes.link_count || 0,
            userCount: ddTeam.attributes.user_count || 0,
            summary: {
              dashboards: ddTeam.attributes.summary?.dashboard_count || 0,
              monitors: ddTeam.attributes.summary?.monitor_count || 0,
              slos: ddTeam.attributes.summary?.slo_count || 0
            }
          };

          const existingTeam = await DatadogTeam.findOne({
            companyId,
            datadogTeamId: ddTeam.id
          });

          if (existingTeam) {
            await DatadogTeam.findByIdAndUpdate((existingTeam as any)._id, teamData);
            syncResults.updated++;
          } else {
            await DatadogTeam.create(teamData);
            syncResults.created++;
          }
        } catch (error) {
          console.error(`Error syncing team ${ddTeam.id}:`, error);
          syncResults.errors++;
        }
      }

      // Correlate with Google Workspace groups
      await this.correlateWithGoogleWorkspace(companyId, connectionId);

      return {
        success: true,
        results: syncResults
      };

    } catch (error: any) {
      console.error('Error syncing Datadog teams:', error);
      throw error;
    }
  }

  async getTeams(companyId: string, connectionId?: string): Promise<any[]> {
    const filter: any = { companyId };
    if (connectionId) {
      filter.connectionId = connectionId;
    }

    const teams = await DatadogTeam.find(filter).sort({ name: 1 });

    return teams.map(team => ({
      id: (team as any)._id.toString(),
      datadogTeamId: team.datadogTeamId,
      name: team.name,
      handle: team.handle,
      description: team.description,
      avatar: team.avatar,
      banner: team.banner,
      hiddenModules: team.hiddenModules,
      linkCount: team.linkCount,
      userCount: team.userCount,
      summary: team.summary,
      correlationStatus: team.correlationStatus,
      googleWorkspaceGroupId: team.googleWorkspaceGroupId,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    }));
  }

  async getTeamById(teamId: string, companyId: string): Promise<any> {
    const team = await DatadogTeam.findOne({
      _id: teamId,
      companyId
    });

    if (!team) {
      throw new Error('Team not found');
    }

    return {
      id: (team as any)._id.toString(),
      datadogTeamId: team.datadogTeamId,
      name: team.name,
      handle: team.handle,
      description: team.description,
      avatar: team.avatar,
      banner: team.banner,
      hiddenModules: team.hiddenModules,
      linkCount: team.linkCount,
      userCount: team.userCount,
      summary: team.summary,
      correlationStatus: team.correlationStatus,
      googleWorkspaceGroupId: team.googleWorkspaceGroupId,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    };
  }

  async getTeamMembers(teamId: string, companyId: string, connectionId: string): Promise<any> {
    const team = await DatadogTeam.findOne({
      _id: teamId,
      companyId
    });

    if (!team) {
      throw new Error('Team not found');
    }

    // First try to find a formal DatadogConnection
    let connection = await DatadogConnection.findOne({
      _id: connectionId,
      companyId,
      isActive: true
    });

    let apiKey: string;
    let applicationKey: string;
    let site: string = 'datadoghq.com';

    if (connection) {
      // Formal connection found - use it
      console.log('Using formal DatadogConnection for team members');
      
      try {
        if (connection.apiKey && typeof connection.apiKey === 'object') {
          apiKey = decrypt(connection.apiKey);
        } else {
          throw new Error('API key not properly encrypted');
        }

        if (connection.applicationKey && typeof connection.applicationKey === 'object') {
          applicationKey = decrypt(connection.applicationKey);
        } else {
          throw new Error('Application key not properly encrypted');
        }
      } catch (error) {
        console.error('Error decrypting Datadog credentials:', error);
        throw new Error('Failed to decrypt Datadog credentials. Please reconnect your Datadog integration.');
      }

      site = connection.site;
    } else {
      // No formal connection - check if this is a credentials-based connection
      console.log('No formal connection found, checking credentials-based connection for team members');
      
      const credentialsService = new (require('../../../credentials/services/credentialsService').CredentialsService)();
      const credentialsData = await credentialsService.getDecryptedCredentials(companyId, 'datadog');
      
      if (!credentialsData) {
        throw new Error('Connection not found - no formal connection or credentials available');
      }

      apiKey = credentialsData.apiKey;
      applicationKey = credentialsData.applicationKey;
      site = credentialsData.site || 'datadoghq.com';

      console.log('Using credentials-based connection for team members');
    }

    try {
      const baseUrl = `https://api.${site}`;

      // Fetch team memberships from Datadog API
      const response = await axios.get(`${baseUrl}/api/v2/team/${team.datadogTeamId}/memberships`, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': applicationKey,
          'Content-Type': 'application/json'
        }
      });

      const memberships = response.data.data;
      
      return {
        teamId: team.datadogTeamId,
        teamName: team.name,
        members: memberships.map((membership: any) => ({
          userId: membership.id,
          role: membership.attributes.role,
          position: membership.attributes.position
        }))
      };

    } catch (error: any) {
      console.error('Error fetching team members:', error);
      throw new Error(`Failed to fetch team members: ${error.message}`);
    }
  }

  private async correlateWithGoogleWorkspace(companyId: string, connectionId: string): Promise<void> {
    try {
      // Get all Datadog teams for this connection
      const datadogTeams = await DatadogTeam.find({
        companyId,
        connectionId
      });

      // Get all Google Workspace groups for this company
      const googleGroups = await GoogleWorkspaceGroup.find({
        companyId
      });

      // Create name and email lookup maps for Google groups
      const googleGroupNameMap = new Map();
      const googleGroupEmailMap = new Map();
      
      googleGroups.forEach(group => {
        googleGroupNameMap.set(group.name.toLowerCase(), group);
        googleGroupEmailMap.set(group.email.toLowerCase(), group);
      });

      // Correlate teams based on name and email matching
      for (const ddTeam of datadogTeams) {
        let googleGroup = null;
        let correlationScore = 0;

        // Try exact name match first
        googleGroup = googleGroupNameMap.get(ddTeam.name.toLowerCase());
        if (googleGroup) {
          correlationScore = 1.0;
        } else {
          // Try partial name matching
          const partialMatch = this.findPartialGroupMatch(ddTeam, googleGroups);
          if (partialMatch) {
            googleGroup = partialMatch.group;
            correlationScore = partialMatch.score;
          }
        }

        if (googleGroup) {
          await DatadogTeam.findByIdAndUpdate((ddTeam as any)._id, {
            googleWorkspaceGroupId: googleGroup.googleGroupId,
            correlationStatus: correlationScore > 0.8 ? 'matched' : 'conflict',
            correlationScore: correlationScore
          });
        } else {
          await DatadogTeam.findByIdAndUpdate((ddTeam as any)._id, {
            correlationStatus: 'unmatched',
            correlationScore: 0
          });
        }
      }
    } catch (error) {
      console.error('Error correlating teams with Google Workspace:', error);
    }
  }

  private findPartialGroupMatch(datadogTeam: any, googleGroups: any[]): { group: any; score: number } | null {
    let bestMatch = null;
    let bestScore = 0;

    for (const googleGroup of googleGroups) {
      let score = 0;

      // Check name similarity
      const ddName = datadogTeam.name.toLowerCase();
      const googleName = googleGroup.name.toLowerCase();
      
      if (ddName === googleName) {
        score += 0.8;
      } else if (ddName.includes(googleName) || googleName.includes(ddName)) {
        score += 0.5;
      }

      // Check handle/email similarity
      if (datadogTeam.handle && googleGroup.email) {
        const ddHandle = datadogTeam.handle.toLowerCase();
        const googleEmail = googleGroup.email.toLowerCase();
        
        if (googleEmail.includes(ddHandle)) {
          score += 0.3;
        }
      }

      // Check description similarity
      if (datadogTeam.description && googleGroup.description) {
        const ddDesc = datadogTeam.description.toLowerCase();
        const googleDesc = googleGroup.description.toLowerCase();
        
        if (ddDesc === googleDesc) {
          score += 0.2;
        } else if (ddDesc.includes(googleDesc) || googleDesc.includes(ddDesc)) {
          score += 0.1;
        }
      }

      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = { group: googleGroup, score };
      }
    }

    return bestMatch;
  }

  async getTeamStats(companyId: string, connectionId?: string): Promise<any> {
    const filter: any = { companyId };
    if (connectionId) {
      filter.connectionId = connectionId;
    }

    const [
      totalTeams,
      matchedTeams,
      unmatchedTeams,
      totalMembers,
      totalDashboards,
      totalMonitors
    ] = await Promise.all([
      DatadogTeam.countDocuments(filter),
      DatadogTeam.countDocuments({ ...filter, correlationStatus: 'matched' }),
      DatadogTeam.countDocuments({ ...filter, correlationStatus: 'unmatched' }),
      DatadogTeam.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$userCount' } } }
      ]).then(result => result[0]?.total || 0),
      DatadogTeam.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$summary.dashboards' } } }
      ]).then(result => result[0]?.total || 0),
      DatadogTeam.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$summary.monitors' } } }
      ]).then(result => result[0]?.total || 0)
    ]);

    return {
      totalTeams,
      matchedTeams,
      unmatchedTeams,
      totalMembers,
      totalDashboards,
      totalMonitors,
      correlationRate: totalTeams > 0 ? (matchedTeams / totalTeams * 100).toFixed(1) : 0
    };
  }
}
