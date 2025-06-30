import { ZoomConnection, ZoomAccount } from '../../../../database/models';
import mongoose from 'mongoose';
import { encrypt, decrypt } from '../../../../utils/encryption';
import { AppCredentialsService } from '../../../apps/services/appCredentialsService';
import axios from 'axios';

export class ZoomConnectionService {
  private appCredentialsService: AppCredentialsService;

  constructor() {
    this.appCredentialsService = new AppCredentialsService();
  }

  async initiateOAuth(companyId: string): Promise<string> {
    // Get company-specific Zoom credentials
    const credentialsData = await this.appCredentialsService.getCredentials(companyId, 'zoom');
    
    if (!credentialsData) {
      throw new Error('Zoom credentials not configured for this company. Please add your Zoom app credentials first.');
    }

    const { clientId, clientSecret } = credentialsData.credentials;
    
    if (!clientId || !clientSecret) {
      throw new Error('Zoom credentials are incomplete. Please ensure both Client ID and Client Secret are provided.');
    }

    // Generate state for CSRF protection
    const state = Buffer.from(JSON.stringify({
      companyId,
      timestamp: Date.now()
    })).toString('base64');

    // Zoom OAuth scopes
    const scopes = [
      'user:read:admin',
      'user:write:admin',
      'meeting:read:admin',
      'meeting:write:admin',
      'report:read:admin',
      'account:read:admin',
      'dashboard:read:admin'
    ].join(' ');

    const redirectUri = credentialsData.credentials.redirectUri || 'http://localhost:5000/api/integrations/zoom/callback';

    const authUrl = `https://zoom.us/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${state}`;

    return authUrl;
  }

  async handleOAuthCallback(code: string, state: string): Promise<any> {
    try {
      // Decode and validate state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      
      // Get company-specific Zoom credentials
      const credentialsData = await this.appCredentialsService.getCredentials(stateData.companyId, 'zoom');
      
      if (!credentialsData) {
        throw new Error('Zoom credentials not found for this company');
      }

      const { clientId, clientSecret } = credentialsData.credentials;
      const redirectUri = credentialsData.credentials.redirectUri || 'http://localhost:5000/api/integrations/zoom/callback';
      
      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://zoom.us/oauth/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        }),
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokenData = tokenResponse.data;

      if (!tokenData.access_token) {
        throw new Error('Failed to obtain access token');
      }

      // Get account info
      const accountResponse = await axios.get('https://api.zoom.us/v2/accounts', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (!accountResponse.data.accounts || accountResponse.data.accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const accountData = accountResponse.data.accounts[0]; // Use first account

      // Encrypt tokens
      const encryptedAccessToken = encrypt(tokenData.access_token);
      const encryptedRefreshToken = encrypt(tokenData.refresh_token);

      // Create or update connection
      const connection = await ZoomConnection.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(stateData.companyId),
          accountId: accountData.id
        },
        {
          accountName: accountData.account_name,
          accountType: accountData.account_type || 'basic',
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          scope: tokenData.scope.split(' '),
          connectionType: 'oauth',
          isActive: true,
          lastSync: new Date()
        },
        {
          upsert: true,
          new: true
        }
      );

      // Create or update account
      await ZoomAccount.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(stateData.companyId),
          zoomAccountId: accountData.id
        },
        {
          connectionId: connection._id,
          accountName: accountData.account_name,
          accountType: accountData.account_type || 'basic',
          planType: accountData.plan_type || 'basic',
          licenseCount: accountData.license_count || 0,
          usedLicenses: accountData.used_licenses || 0,
          maxUsers: accountData.max_users || 0,
          timezone: accountData.timezone || 'UTC',
          language: accountData.language || 'en-US',
          country: accountData.country || 'US',
          phoneCountry: accountData.phone_country || 'US',
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
        accountName: accountData.account_name,
        accountType: accountData.account_type
      };
    } catch (error) {
      console.error('Zoom OAuth callback error:', error);
      throw error;
    }
  }

  async getConnections(companyId: string): Promise<any[]> {
    const connections = await ZoomConnection.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true
    }).select('-accessToken -refreshToken');

    return connections.map((conn: any) => ({
      id: conn._id.toString(),
      accountId: conn.accountId,
      accountName: conn.accountName,
      accountType: conn.accountType,
      connectionType: conn.connectionType,
      scope: conn.scope,
      isActive: conn.isActive,
      lastSync: conn.lastSync,
      createdAt: conn.createdAt
    }));
  }

  async getConnection(connectionId: string, companyId: string): Promise<any> {
    const connection = await ZoomConnection.findOne({
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

  async getDecryptedRefreshToken(connectionId: string, companyId: string): Promise<string> {
    const connection = await this.getConnection(connectionId, companyId);
    return decrypt(connection.refreshToken);
  }

  async disconnectConnection(connectionId: string, companyId: string): Promise<void> {
    await ZoomConnection.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(connectionId),
        companyId: new mongoose.Types.ObjectId(companyId)
      },
      {
        isActive: false
      }
    );

    // Also mark all related data as inactive
    const { ZoomAccount, ZoomUser, ZoomMeeting, ZoomUsageStats } = await import('../../../../database/models');
    
    await Promise.all([
      ZoomAccount.updateMany({ connectionId, companyId }, { isActive: false }),
      ZoomUser.updateMany({ connectionId, companyId }, { isActive: false }),
      ZoomMeeting.updateMany({ connectionId, companyId }, { isActive: false }),
      ZoomUsageStats.updateMany({ connectionId, companyId }, { isActive: false })
    ]);
  }

  async refreshConnection(connectionId: string, companyId: string): Promise<void> {
    const connection = await this.getConnection(connectionId, companyId);
    const refreshToken = await this.getDecryptedRefreshToken(connectionId, companyId);

    // Get company-specific Zoom credentials
    const credentialsData = await this.appCredentialsService.getCredentials(companyId, 'zoom');
    
    if (!credentialsData) {
      throw new Error('Zoom credentials not found for this company');
    }

    const { clientId, clientSecret } = credentialsData.credentials;

    try {
      // Refresh the token
      const tokenResponse = await axios.post(
        'https://zoom.us/oauth/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokenData = tokenResponse.data;

      if (!tokenData.access_token) {
        throw new Error('Failed to refresh access token');
      }

      // Encrypt new tokens
      const encryptedAccessToken = encrypt(tokenData.access_token);
      const encryptedRefreshToken = encrypt(tokenData.refresh_token);

      // Update connection with new tokens
      await ZoomConnection.findByIdAndUpdate(connectionId, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        lastSync: new Date()
      });
    } catch (error: any) {
      console.error('Zoom token refresh error:', error);
      
      // Mark connection as inactive if token refresh fails
      await ZoomConnection.findByIdAndUpdate(connectionId, {
        isActive: false
      });
      
      throw error;
    }
  }

  async testConnection(connectionId: string, companyId: string): Promise<any> {
    const token = await this.getDecryptedToken(connectionId, companyId);

    try {
      const response = await axios.get('https://api.zoom.us/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return {
        success: true,
        user: response.data
      };
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Try to refresh token
        await this.refreshConnection(connectionId, companyId);
        
        // Retry with new token
        const newToken = await this.getDecryptedToken(connectionId, companyId);
        const retryResponse = await axios.get('https://api.zoom.us/v2/users/me', {
          headers: {
            'Authorization': `Bearer ${newToken}`
          }
        });

        return {
          success: true,
          user: retryResponse.data,
          refreshed: true
        };
      }
      
      throw error;
    }
  }
}
