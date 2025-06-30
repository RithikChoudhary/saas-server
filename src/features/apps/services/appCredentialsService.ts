import { AppCredentials } from '../../../database/models';
import { encrypt, decrypt } from '../../../utils/encryption';
import mongoose from 'mongoose';

export class AppCredentialsService {
  
  async saveCredentials(
    companyId: string,
    appType: string,
    appName: string,
    credentials: any,
    createdBy: string
  ): Promise<any> {
    try {
      // Encrypt sensitive credentials
      const encryptedCredentials: any = {};
      
      for (const [key, value] of Object.entries(credentials)) {
        if (typeof value === 'string' && this.isSensitiveField(key)) {
          encryptedCredentials[key] = encrypt(value);
        } else {
          encryptedCredentials[key] = value;
        }
      }

      const appCredentials = await AppCredentials.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(companyId),
          appType,
          appName
        },
        {
          credentials: encryptedCredentials,
          isActive: true,
          createdBy: new mongoose.Types.ObjectId(createdBy)
        },
        {
          upsert: true,
          new: true
        }
      );

      if (!appCredentials) {
        throw new Error('Failed to save credentials');
      }

      return {
        id: (appCredentials as any)._id.toString(),
        appType: appCredentials.appType,
        appName: appCredentials.appName,
        isActive: appCredentials.isActive,
        createdAt: appCredentials.createdAt
      };
    } catch (error) {
      console.error('Error saving app credentials:', error);
      throw error;
    }
  }

  async getCredentials(companyId: string, appType: string, appName?: string): Promise<any> {
    try {
      const query: any = {
        companyId: new mongoose.Types.ObjectId(companyId),
        appType,
        isActive: true
      };

      if (appName) {
        query.appName = appName;
      }

      const appCredentials = await AppCredentials.findOne(query);

      if (!appCredentials) {
        return null;
      }

      // Decrypt sensitive credentials
      const decryptedCredentials: any = {};
      
      for (const [key, value] of Object.entries(appCredentials.credentials)) {
        if (typeof value === 'string' && this.isSensitiveField(key)) {
          try {
            // Handle both old string format and new object format
            if (typeof value === 'string' && value.includes('encrypted')) {
              decryptedCredentials[key] = decrypt(JSON.parse(value));
            } else {
              decryptedCredentials[key] = value; // Assume it's plain text
            }
          } catch (decryptError) {
            // If decryption fails, assume it's not encrypted
            decryptedCredentials[key] = value;
          }
        } else {
          decryptedCredentials[key] = value;
        }
      }

      return {
        id: (appCredentials as any)._id.toString(),
        appType: appCredentials.appType,
        appName: appCredentials.appName,
        credentials: decryptedCredentials,
        isActive: appCredentials.isActive,
        createdAt: appCredentials.createdAt
      };
    } catch (error) {
      console.error('Error getting app credentials:', error);
      throw error;
    }
  }

  async getAllCredentials(companyId: string): Promise<any[]> {
    try {
      const appCredentials = await AppCredentials.find({
        companyId: new mongoose.Types.ObjectId(companyId),
        isActive: true
      }).select('-credentials'); // Don't return actual credentials in list

      return appCredentials.map((cred: any) => ({
        id: cred._id.toString(),
        appType: cred.appType,
        appName: cred.appName,
        isActive: cred.isActive,
        createdAt: cred.createdAt,
        hasCredentials: true
      }));
    } catch (error) {
      console.error('Error getting all app credentials:', error);
      throw error;
    }
  }

  async deleteCredentials(companyId: string, appType: string, appName: string): Promise<void> {
    try {
      await AppCredentials.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(companyId),
          appType,
          appName
        },
        {
          isActive: false
        }
      );
    } catch (error) {
      console.error('Error deleting app credentials:', error);
      throw error;
    }
  }

  async hasCredentials(companyId: string, appType: string, appName?: string): Promise<boolean> {
    try {
      const query: any = {
        companyId: new mongoose.Types.ObjectId(companyId),
        appType,
        isActive: true
      };

      if (appName) {
        query.appName = appName;
      }

      const count = await AppCredentials.countDocuments(query);
      return count > 0;
    } catch (error) {
      console.error('Error checking app credentials:', error);
      return false;
    }
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'clientSecret',
      'client_secret',
      'secretKey',
      'secret_key',
      'accessKey',
      'access_key',
      'privateKey',
      'private_key',
      'password',
      'token',
      'secret',
      'key'
    ];

    return sensitiveFields.some(field => 
      fieldName.toLowerCase().includes(field.toLowerCase())
    );
  }

  // Helper method to validate required fields for each app type
  validateCredentials(appType: string, credentials: any): { isValid: boolean; missingFields: string[] } {
    const requiredFields: { [key: string]: string[] } = {
      slack: ['clientId', 'clientSecret'],
      zoom: ['clientId', 'clientSecret'],
      'google-workspace': ['clientId', 'clientSecret'],
      github: ['clientId', 'clientSecret'],
      aws: ['accessKey', 'secretKey', 'region'],
      azure: ['clientId', 'clientSecret', 'tenantId'],
      office365: ['clientId', 'clientSecret', 'tenantId']
    };

    const required = requiredFields[appType] || [];
    const missingFields = required.filter(field => !credentials[field]);

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }
}
