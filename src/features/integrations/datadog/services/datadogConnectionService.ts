import { DatadogConnection, DatadogUser, DatadogTeam } from '../../../../database/models';
import { AppCredentials } from '../../../../database/models/AppCredentials';
import { encrypt, decrypt } from '../../../../utils/encryption';
import { CredentialsService } from '../../../credentials/services/credentialsService';
import mongoose from 'mongoose';
import axios from 'axios';

export class DatadogConnectionService {
  private credentialsService: CredentialsService;

  constructor() {
    this.credentialsService = new CredentialsService();
  }

  /**
   * Check if there's a credentials-based connection (similar to Google Workspace)
   */
  async checkCredentialsConnection(companyId: string): Promise<any> {
    try {
      const credentials = await AppCredentials.findOne({
        companyId: new mongoose.Types.ObjectId(companyId),
        appType: 'datadog',
        isActive: true
      });

      if (!credentials) {
        return null;
      }

      // Decrypt credentials
      const decryptedCreds: { [key: string]: string } = {};
      for (const [key, encryptedValue] of Object.entries(credentials.credentials)) {
        if (encryptedValue && typeof encryptedValue === 'object') {
          const encObj = encryptedValue as any;
          if (encObj.encrypted && encObj.iv && encObj.authTag) {
            decryptedCreds[key] = decrypt(encObj);
          }
        }
      }

      if (decryptedCreds.apiKey && decryptedCreds.applicationKey) {
        // Create a virtual connection object that matches the DatadogConnection structure
        return {
          id: (credentials as any)._id.toString(),
          organizationId: `creds-${(credentials as any)._id.toString()}`,
          organizationName: decryptedCreds.organizationName || credentials.appName,
          site: decryptedCreds.site || 'datadoghq.com',
          connectionType: 'credentials',
          isActive: true,
          syncStatus: 'ready',
          lastSync: credentials.updatedAt,
          createdAt: credentials.createdAt,
          hasApiKey: true,
          hasApplicationKey: true
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking credentials connection:', error);
      return null;
    }
  }

  async createConnection(companyId: string): Promise<any> {
    try {
      // Get company-specific Datadog credentials
      const credentialsData = await this.credentialsService.getDecryptedCredentials(companyId, 'datadog');
      
      if (!credentialsData) {
        throw new Error('Datadog credentials not configured for this company');
      }

      const { apiKey, applicationKey, site = 'datadoghq.com' } = credentialsData;
      
      if (!apiKey || !applicationKey) {
        throw new Error('Both API Key and Application Key are required for Datadog integration');
      }

      // Test the connection by fetching organization info
      const baseUrl = `https://api.${site}`;
      
      const response = await axios.get(`${baseUrl}/api/v1/org`, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': applicationKey,
          'Content-Type': 'application/json'
        }
      });

      const orgData = response.data.org;

      // Encrypt and store credentials
      const encryptedApiKey = encrypt(apiKey);
      const encryptedApplicationKey = encrypt(applicationKey);

      // Create or update connection (FIX: Convert companyId to ObjectId)
      const connection = await DatadogConnection.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(companyId),
          organizationId: orgData.public_id
        },
        {
          companyId: new mongoose.Types.ObjectId(companyId),
          organizationName: orgData.name,
          organizationId: orgData.public_id,
          site,
          apiKey: encryptedApiKey,
          applicationKey: encryptedApplicationKey,
          connectionType: 'api-key',
          isActive: true,
          syncStatus: 'pending',
          lastSync: new Date()
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        connectionId: connection._id,
        organizationName: orgData.name,
        organizationId: orgData.public_id,
        site: site
      };
    } catch (error: any) {
      console.error('Datadog connection test failed:', error);
      throw new Error(`Failed to connect to Datadog: ${error.response?.data?.errors?.[0] || error.message}`);
    }
  }

  async getConnections(companyId: string): Promise<any[]> {
    try {
      // Get formal DatadogConnection records
      const formalConnections = await DatadogConnection.find({
        companyId: new mongoose.Types.ObjectId(companyId),
        isActive: true
      }).select('-apiKey -applicationKey');

      const connections = formalConnections.map((conn: any) => ({
        id: conn._id.toString(),
        organizationId: conn.organizationId,
        organizationName: conn.organizationName,
        site: conn.site,
        connectionType: conn.connectionType,
        isActive: conn.isActive,
        syncStatus: conn.syncStatus,
        lastSync: conn.lastSync,
        createdAt: conn.createdAt
      }));

      // Check for credentials-based connection (hybrid approach like Google Workspace)
      const credentialsConn = await this.checkCredentialsConnection(companyId);
      if (credentialsConn) {
        // Only add if we don't already have a formal connection for this org
        const existingFormalConn = connections.find(conn => 
          conn.organizationId === credentialsConn.organizationId ||
          conn.organizationName === credentialsConn.organizationName
        );
        
        if (!existingFormalConn) {
          connections.push(credentialsConn);
        }
      }

      return connections;
    } catch (error) {
      console.error('Error fetching Datadog connections:', error);
      throw error;
    }
  }

  async testConnection(connectionId: string, companyId: string): Promise<any> {
    try {
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
        console.log('Testing formal DatadogConnection');
        
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
          return {
            success: false,
            message: 'Failed to decrypt credentials. Please reconnect your Datadog integration.'
          };
        }

        site = connection.site;
      } else {
        // No formal connection - check if this is a credentials-based connection
        console.log('No formal connection found, checking credentials-based connection for test');
        
        const credentialsData = await this.credentialsService.getDecryptedCredentials(companyId, 'datadog');
        
        if (!credentialsData) {
          throw new Error('Connection not found - no formal connection or credentials available');
        }

        apiKey = credentialsData.apiKey;
        applicationKey = credentialsData.applicationKey;
        site = credentialsData.site || 'datadoghq.com';

        console.log('Testing credentials-based connection');
      }

      const baseUrl = `https://api.${site}`;

      try {
        const response = await axios.get(`${baseUrl}/api/v1/validate`, {
          headers: {
            'DD-API-KEY': apiKey,
            'DD-APPLICATION-KEY': applicationKey,
            'Content-Type': 'application/json'
          }
        });

        return {
          success: response.data.valid,
          message: response.data.valid ? 'Connection successful' : 'Invalid credentials'
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Connection failed: ${error.response?.data?.errors?.[0] || error.message}`
        };
      }
    } catch (error: any) {
      console.error('Error testing Datadog connection:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async disconnectConnection(connectionId: string, companyId: string): Promise<any> {
    const connection = await DatadogConnection.findOneAndUpdate(
      {
        _id: connectionId,
        companyId
      },
      {
        isActive: false,
        syncStatus: 'failed',
        errorMessage: 'Connection manually disconnected'
      },
      { new: true }
    );

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Also deactivate related users and teams
    await DatadogUser.updateMany(
      { connectionId, companyId },
      { status: 'Disabled' }
    );

    return {
      success: true,
      message: 'Connection disconnected successfully'
    };
  }

  async getConnectionStats(connectionId: string, companyId: string): Promise<any> {
    try {
      // First try to find a formal DatadogConnection
      let connection = await DatadogConnection.findOne({
        _id: connectionId,
        companyId,
        isActive: true
      });

      let organizationName: string = 'Unknown';
      let organizationId: string = 'unknown';
      let site: string = 'datadoghq.com';
      let lastSync: Date | null = null;
      let syncStatus: string = 'ready';

      if (connection) {
        // Formal connection found - use it
        organizationName = connection.organizationName;
        organizationId = connection.organizationId;
        site = connection.site;
        lastSync = connection.lastSync;
        syncStatus = connection.syncStatus;
      } else {
        // No formal connection - check if this is a credentials-based connection
        const credentialsConn = await this.checkCredentialsConnection(companyId);
        
        if (!credentialsConn) {
          throw new Error('Connection not found - no formal connection or credentials available');
        }

        organizationName = credentialsConn.organizationName;
        organizationId = credentialsConn.organizationId;
        site = credentialsConn.site;
        lastSync = credentialsConn.lastSync;
        syncStatus = credentialsConn.syncStatus;
      }

      const [userCount, teamCount] = await Promise.all([
        DatadogUser.countDocuments({ connectionId, companyId }),
        DatadogTeam.countDocuments({ connectionId, companyId })
      ]);

      const activeUsers = await DatadogUser.countDocuments({ 
        connectionId, 
        companyId, 
        status: 'Active' 
      });

      return {
        organizationName,
        organizationId,
        site,
        totalUsers: userCount,
        activeUsers,
        totalTeams: teamCount,
        lastSync,
        syncStatus
      };
    } catch (error: any) {
      console.error('Error getting connection stats:', error);
      throw error;
    }
  }
}
