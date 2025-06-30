import axios from 'axios';
import { BaseIntegration, IntegrationConfig, ConnectionResult, UserData } from '../base/BaseIntegration';

export class Office365Integration extends BaseIntegration {
  config: IntegrationConfig = {
    name: 'Office 365',
    category: 'productivity',
    description: 'Microsoft productivity suite with Word, Excel, PowerPoint, Teams, and cloud services.',
    logo: 'https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RE4wtct',
    website: 'https://www.microsoft.com/microsoft-365',
    features: ['Office Apps', 'Teams', 'OneDrive', 'SharePoint', 'Exchange'],
    integrations: ['SSO', 'SCIM', 'API', 'SAML'],
    pricing: {
      model: 'per_user_monthly',
      tiers: [
        { name: 'Business Basic', price: 6, features: ['Web and mobile apps', '1TB OneDrive', 'Teams'] },
        { name: 'Business Standard', price: 12.5, features: ['Desktop apps', 'Teams', 'Exchange'] },
        { name: 'Business Premium', price: 22, features: ['Advanced security', 'Device management'] }
      ]
    },
    credentials: {
      fields: [
        {
          name: 'tenantId',
          label: 'Tenant ID',
          type: 'text',
          placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          required: true,
          description: 'Your Azure AD Tenant ID'
        },
        {
          name: 'clientId',
          label: 'Client ID',
          type: 'text',
          placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          required: true,
          description: 'Application (client) ID from Azure AD'
        },
        {
          name: 'clientSecret',
          label: 'Client Secret',
          type: 'password',
          placeholder: 'your-client-secret',
          required: true,
          description: 'Client secret from Azure AD app registration'
        }
      ],
      permissions: [
        'User.Read.All',
        'Directory.Read.All',
        'Group.Read.All'
      ],
      setupSteps: [
        '1. Go to Azure Portal > Azure Active Directory',
        '2. Navigate to App registrations > New registration',
        '3. Register your application',
        '4. Go to API permissions and add required permissions',
        '5. Create a client secret under Certificates & secrets',
        '6. Copy Tenant ID, Client ID, and Client Secret'
      ]
    }
  };

  async testConnection(credentials: Record<string, string>): Promise<ConnectionResult> {
    try {
      console.log('🔗 Testing Office 365 connection...');
      
      // Get access token
      const tokenResponse = await axios.post(
        `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials'
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const accessToken = tokenResponse.data.access_token;

      // Test connection by getting organization info
      const orgResponse = await axios.get('https://graph.microsoft.com/v1.0/organization', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      console.log('✅ Office 365 connected successfully');
      return {
        success: true,
        message: 'Successfully connected to Office 365',
        data: {
          organization: orgResponse.data.value[0],
          accessToken
        }
      };
    } catch (error: any) {
      console.error('❌ Office 365 connection failed:', error.message);
      return {
        success: false,
        error: `Office 365 connection failed: ${error.message}`
      };
    }
  }

  async getUsers(credentials: Record<string, string>): Promise<UserData[]> {
    try {
      console.log('👥 Fetching Office 365 users...');
      
      // Get access token
      const tokenResponse = await axios.post(
        `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials'
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const accessToken = tokenResponse.data.access_token;

      // Get users
      const usersResponse = await axios.get('https://graph.microsoft.com/v1.0/users', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      const users = usersResponse.data.value.map((user: any) => ({
        id: user.id,
        email: user.mail || user.userPrincipalName,
        firstName: user.givenName || 'Unknown',
        lastName: user.surname || 'User',
        name: user.displayName,
        isActive: user.accountEnabled,
        role: user.jobTitle || 'User',
        department: user.department || 'Office 365',
        externalId: user.id
      }));

      console.log(`✅ Found ${users.length} Office 365 users`);
      return users;
      
    } catch (error: any) {
      console.error('❌ Failed to fetch Office 365 users:', error.message);
      throw new Error(`Failed to fetch Office 365 users: ${error.message}`);
    }
  }
}
