import { GitHubConnection } from '../../../../database/models';
import mongoose from 'mongoose';
import { encrypt, decrypt } from '../../../../utils/encryption';
import axios from 'axios';

export class GitHubConnectionService {
  private readonly GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
  private readonly GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
  private readonly GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:5000/api/integrations/github/callback';

  async initiateOAuth(companyId: string, scope: 'user' | 'organization', organizationName?: string): Promise<string> {
    // Generate state for CSRF protection
    const state = Buffer.from(JSON.stringify({
      companyId,
      scope,
      organizationName,
      timestamp: Date.now()
    })).toString('base64');

    // GitHub OAuth scopes based on requirements
    const scopes = [
      'read:user',
      'user:email',
      'read:org',
      'admin:org',
      'repo',
      'read:packages'
    ].join(' ');

    const authUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${this.GITHUB_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(this.GITHUB_REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${state}`;

    return authUrl;
  }

  async handleOAuthCallback(code: string, state: string): Promise<any> {
    try {
      // Decode and validate state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      
      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.GITHUB_CLIENT_ID,
          client_secret: this.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: this.GITHUB_REDIRECT_URI
        },
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      const { access_token, scope: grantedScopes, token_type } = tokenResponse.data;

      if (!access_token) {
        throw new Error('Failed to obtain access token');
      }

      // Get user info
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const userData = userResponse.data;

      // Encrypt the access token
      const encryptedToken = encrypt(access_token);

      // Create or update connection
      const connection = await GitHubConnection.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(stateData.companyId),
          ...(stateData.scope === 'organization' 
            ? { organizationName: stateData.organizationName }
            : { username: userData.login }
          )
        },
        {
          connectionType: 'oauth',
          scope: stateData.scope,
          username: userData.login,
          organizationName: stateData.scope === 'organization' ? stateData.organizationName : undefined,
          accessToken: encryptedToken,
          permissions: grantedScopes.split(','),
          status: 'connected',
          lastSync: new Date(),
          isActive: true
        },
        {
          upsert: true,
          new: true
        }
      );

      return {
        success: true,
        connectionId: connection._id,
        username: userData.login,
        organizationName: stateData.organizationName
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      throw error;
    }
  }

  async createPersonalAccessTokenConnection(
    companyId: string,
    token: string,
    scope: 'user' | 'organization',
    organizationName?: string
  ): Promise<any> {
    try {
      // Verify token by making a test API call
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const userData = userResponse.data;

      // Encrypt the token
      const encryptedToken = encrypt(token);

      // Create connection
      const connection = await GitHubConnection.create({
        companyId: new mongoose.Types.ObjectId(companyId),
        connectionType: 'personal-access-token',
        scope,
        organizationName: scope === 'organization' ? organizationName : undefined,
        username: userData.login,
        accessToken: encryptedToken,
        permissions: [], // PAT permissions are not easily queryable
        status: 'connected',
        lastSync: new Date(),
        isActive: true
      });

      return {
        success: true,
        connectionId: connection._id,
        username: userData.login
      };
    } catch (error) {
      console.error('Personal access token connection error:', error);
      throw error;
    }
  }

  async getConnections(companyId: string): Promise<any[]> {
    const connections = await GitHubConnection.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    }).select('-accessToken -refreshToken');

    // Transform _id to id for frontend compatibility
    return connections.map(conn => ({
      id: (conn._id as any).toString(),
      ...conn.toObject(),
      _id: undefined
    }));
  }

  async getConnection(connectionId: string, companyId: string): Promise<any> {
    const connection = await GitHubConnection.findOne({
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

  async disconnectConnection(connectionId: string, companyId: string): Promise<void> {
    await GitHubConnection.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(connectionId),
        companyId: new mongoose.Types.ObjectId(companyId)
      },
      {
        status: 'disconnected',
        isActive: false
      }
    );

    // Also mark all related data as inactive
    const { GitHubUser, GitHubTeam, GitHubRepository } = await import('../../../../database/models');
    
    await Promise.all([
      GitHubUser.updateMany({ connectionId, companyId }, { isActive: false }),
      GitHubTeam.updateMany({ connectionId, companyId }, { isActive: false }),
      GitHubRepository.updateMany({ connectionId, companyId }, { isActive: false })
    ]);
  }

  async refreshConnection(connectionId: string, companyId: string): Promise<void> {
    const connection = await this.getConnection(connectionId, companyId);
    const token = await this.getDecryptedToken(connectionId, companyId);

    try {
      // Test the token
      await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `${connection.connectionType === 'oauth' ? 'Bearer' : 'token'} ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      // Update status if successful
      await GitHubConnection.findByIdAndUpdate(connectionId, {
        status: 'connected',
        lastSync: new Date()
      });
    } catch (error: any) {
      // Update status if failed
      const status = error.response?.status === 401 ? 'expired' : 'error';
      await GitHubConnection.findByIdAndUpdate(connectionId, {
        status
      });
      throw error;
    }
  }

  async updatePersonalAccessTokenConnection(
    connectionId: string,
    companyId: string,
    newToken: string
  ): Promise<any> {
    try {
      // Verify the new token
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${newToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const userData = userResponse.data;

      // Encrypt the new token
      const encryptedToken = encrypt(newToken);

      // Update the connection
      const connection = await GitHubConnection.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(connectionId),
          companyId: new mongoose.Types.ObjectId(companyId)
        },
        {
          accessToken: encryptedToken,
          username: userData.login,
          status: 'connected',
          lastSync: new Date()
        },
        { new: true }
      );

      if (!connection) {
        throw new Error('Connection not found');
      }

      return {
        success: true,
        connectionId: connection._id,
        username: userData.login
      };
    } catch (error) {
      console.error('Error updating personal access token connection:', error);
      throw error;
    }
  }
}
