import { SlackConnection, SlackWorkspace } from '../../../../database/models';
import mongoose from 'mongoose';
import { encrypt, decrypt } from '../../../../utils/encryption';
import { AppCredentialsService } from '../../../apps/services/appCredentialsService';
import axios from 'axios';

export class SlackConnectionService {
  private appCredentialsService: AppCredentialsService;

  constructor() {
    this.appCredentialsService = new AppCredentialsService();
  }

  async initiateOAuth(companyId: string): Promise<string> {
    // Get company-specific Slack credentials
    const credentialsData = await this.appCredentialsService.getCredentials(companyId, 'slack');
    
    if (!credentialsData) {
      throw new Error('Slack credentials not configured for this company. Please add your Slack app credentials first.');
    }

    const { clientId, clientSecret } = credentialsData.credentials;
    
    if (!clientId || !clientSecret) {
      throw new Error('Slack credentials are incomplete. Please ensure both Client ID and Client Secret are provided.');
    }

    // Generate state for CSRF protection
    const state = Buffer.from(JSON.stringify({
      companyId,
      timestamp: Date.now()
    })).toString('base64');

    // Slack OAuth scopes
    const scopes = [
      'channels:read',
      'channels:history',
      'groups:read',
      'groups:history',
      'im:read',
      'im:history',
      'mpim:read',
      'mpim:history',
      'users:read',
      'users:read.email',
      'team:read',
      'chat:write',
      'files:read'
    ].join(',');

    const redirectUri = credentialsData.credentials.redirectUri || 'http://localhost:5000/api/integrations/slack/callback';

    const authUrl = `https://slack.com/oauth/v2/authorize?` +
      `client_id=${clientId}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;

    return authUrl;
  }

  async handleOAuthCallback(code: string, state: string): Promise<any> {
    try {
      // Decode and validate state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      
      // Get company-specific Slack credentials
      const credentialsData = await this.appCredentialsService.getCredentials(stateData.companyId, 'slack');
      
      if (!credentialsData) {
        throw new Error('Slack credentials not found for this company');
      }

      const { clientId, clientSecret } = credentialsData.credentials;
      const redirectUri = credentialsData.credentials.redirectUri || 'http://localhost:5000/api/integrations/slack/callback';
      
      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokenData = tokenResponse.data;

      if (!tokenData.ok) {
        throw new Error(tokenData.error || 'Failed to obtain access token');
      }

      // Get team info
      const teamResponse = await axios.get('https://slack.com/api/team.info', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (!teamResponse.data.ok) {
        throw new Error('Failed to get team information');
      }

      const teamData = teamResponse.data.team;

      // Encrypt tokens
      const encryptedAccessToken = encrypt(tokenData.access_token);
      const encryptedBotToken = tokenData.bot_token ? encrypt(tokenData.bot_token) : undefined;

      // Create or update connection
      const connection = await SlackConnection.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(stateData.companyId),
          teamId: teamData.id
        },
        {
          workspaceId: teamData.id,
          workspaceName: teamData.name,
          workspaceDomain: teamData.domain,
          teamId: teamData.id,
          accessToken: encryptedAccessToken,
          botToken: encryptedBotToken,
          scope: tokenData.scope.split(','),
          connectionType: 'oauth',
          isActive: true,
          lastSync: new Date()
        },
        {
          upsert: true,
          new: true
        }
      );

      // Create or update workspace
      await SlackWorkspace.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(stateData.companyId),
          slackId: teamData.id
        },
        {
          connectionId: connection._id,
          name: teamData.name,
          domain: teamData.domain,
          emailDomain: teamData.email_domain,
          icon: teamData.icon,
          enterpriseId: teamData.enterprise_id,
          enterpriseName: teamData.enterprise_name,
          isActive: true,
          lastSync: new Date()
        },
        {
          upsert: true,
          new: true
        }
      );

      return {
        success: true,
        connectionId: connection._id,
        workspaceName: teamData.name,
        workspaceDomain: teamData.domain
      };
    } catch (error) {
      console.error('Slack OAuth callback error:', error);
      throw error;
    }
  }

  async getConnections(companyId: string): Promise<any[]> {
    const connections = await SlackConnection.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    }).select('-accessToken -botToken -refreshToken');

    return connections.map((conn: any) => ({
      id: conn._id.toString(),
      workspaceId: conn.workspaceId,
      workspaceName: conn.workspaceName,
      workspaceDomain: conn.workspaceDomain,
      connectionType: conn.connectionType,
      scope: conn.scope,
      isActive: conn.isActive,
      lastSync: conn.lastSync,
      createdAt: conn.createdAt
    }));
  }

  async getConnection(connectionId: string, companyId: string): Promise<any> {
    const connection = await SlackConnection.findOne({
      _id: new mongoose.Types.ObjectId(connectionId),
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    return connection;
  }

  async getDecryptedToken(connectionId: string, companyId: string): Promise<string> {
    const connection = await this.getConnection(connectionId, companyId);
    return decrypt(connection.accessToken);
  }

  async getDecryptedBotToken(connectionId: string, companyId: string): Promise<string | null> {
    const connection = await this.getConnection(connectionId, companyId);
    return connection.botToken ? decrypt(connection.botToken) : null;
  }

  async disconnectConnection(connectionId: string, companyId: string): Promise<void> {
    await SlackConnection.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(connectionId),
        companyId: new mongoose.Types.ObjectId(companyId)
      },
      {
        isActive: false
      }
    );

    // Also mark all related data as inactive
    const { SlackWorkspace, SlackChannel, SlackUser, SlackChannelMember } = await import('../../../../database/models');
    
    await Promise.all([
      SlackWorkspace.updateMany({ connectionId, companyId }, { isActive: false }),
      SlackChannel.updateMany({ connectionId, companyId }, { isActive: false }),
      SlackUser.updateMany({ connectionId, companyId }, { isActive: false }),
      SlackChannelMember.updateMany({ connectionId, companyId }, { isActive: false })
    ]);
  }

  async refreshConnection(connectionId: string, companyId: string): Promise<void> {
    const connection = await this.getConnection(connectionId, companyId);
    const token = await this.getDecryptedToken(connectionId, companyId);

    try {
      // Test the token
      const response = await axios.get('https://slack.com/api/auth.test', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Token validation failed');
      }

      // Update last sync if successful
      await SlackConnection.findByIdAndUpdate(connectionId, {
        lastSync: new Date()
      });
    } catch (error: any) {
      console.error('Slack token refresh error:', error);
      
      // Mark connection as inactive if token is invalid
      await SlackConnection.findByIdAndUpdate(connectionId, {
        isActive: false
      });
      
      throw error;
    }
  }

  async testConnection(connectionId: string, companyId: string): Promise<any> {
    const token = await this.getDecryptedToken(connectionId, companyId);

    const response = await axios.get('https://slack.com/api/auth.test', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.data.ok) {
      throw new Error(response.data.error || 'Connection test failed');
    }

    return {
      success: true,
      team: response.data.team,
      user: response.data.user,
      url: response.data.url
    };
  }
}
