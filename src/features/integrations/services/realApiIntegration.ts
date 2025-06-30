import axios from 'axios';
import { User } from '../../../database/models';

// Real API Integration Service
export class RealApiIntegrationService {
  
  // Office 365 Integration
  static async connectOffice365(credentials: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
  }) {
    try {
      console.log('🔗 Connecting to Office 365...');
      
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
        organization: orgResponse.data.value[0],
        accessToken
      };
    } catch (error: any) {
      console.error('❌ Office 365 connection failed:', error.message);
      throw new Error(`Office 365 connection failed: ${error.message}`);
    }
  }

  // GitHub Integration
  static async connectGitHub(credentials: {
    personalAccessToken: string;
    organization?: string;
  }) {
    try {
      console.log('🔗 Connecting to GitHub...');
      
      const headers = { 'Authorization': `token ${credentials.personalAccessToken}` };
      
      // Test connection by getting user info
      const userResponse = await axios.get('https://api.github.com/user', { headers });
      
      console.log('✅ GitHub connected successfully');
      return {
        success: true,
        user: userResponse.data,
        organization: credentials.organization
      };
    } catch (error: any) {
      console.error('❌ GitHub connection failed:', error.message);
      throw new Error(`GitHub connection failed: ${error.message}`);
    }
  }

  // Slack Integration
  static async connectSlack(credentials: {
    botToken: string;
    workspaceId?: string;
  }) {
    try {
      console.log('🔗 Connecting to Slack...');
      
      const headers = { 'Authorization': `Bearer ${credentials.botToken}` };
      
      // Test connection by getting team info
      const teamResponse = await axios.get('https://slack.com/api/team.info', { headers });
      
      if (!teamResponse.data.ok) {
        throw new Error(teamResponse.data.error || 'Slack API error');
      }

      console.log('✅ Slack connected successfully');
      return {
        success: true,
        team: teamResponse.data.team
      };
    } catch (error: any) {
      console.error('❌ Slack connection failed:', error.message);
      throw new Error(`Slack connection failed: ${error.message}`);
    }
  }

  // Atlassian JIRA Integration
  static async connectJira(credentials: {
    domain: string;
    email: string;
    apiToken: string;
  }) {
    try {
      console.log('🔗 Connecting to JIRA...');
      
      const auth = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64');
      const headers = { 'Authorization': `Basic ${auth}` };
      
      // Test connection by getting current user
      const userResponse = await axios.get(`https://${credentials.domain}.atlassian.net/rest/api/3/myself`, { headers });
      
      console.log('✅ JIRA connected successfully');
      return {
        success: true,
        user: userResponse.data,
        domain: credentials.domain
      };
    } catch (error: any) {
      console.error('❌ JIRA connection failed:', error.message);
      throw new Error(`JIRA connection failed: ${error.message}`);
    }
  }

  // Notion Integration
  static async connectNotion(credentials: {
    integrationToken: string;
  }) {
    try {
      console.log('🔗 Connecting to Notion...');
      
      const headers = {
        'Authorization': `Bearer ${credentials.integrationToken}`,
        'Notion-Version': '2022-06-28'
      };
      
      // Test connection by listing users
      const usersResponse = await axios.get('https://api.notion.com/v1/users', { headers });
      
      console.log('✅ Notion connected successfully');
      return {
        success: true,
        users: usersResponse.data.results
      };
    } catch (error: any) {
      console.error('❌ Notion connection failed:', error.message);
      throw new Error(`Notion connection failed: ${error.message}`);
    }
  }

  // Google Cloud Platform Integration (Temporarily disabled - googleapis removed for memory optimization)
  static async connectGoogleCloudPlatform(credentials: {
    serviceAccountKey: string;
    projectId: string;
  }) {
    console.log('⚠️  Google Cloud Platform integration temporarily disabled');
    console.log('   The googleapis package was removed to optimize memory usage.');
    console.log('   To re-enable, install @google-cloud/iam instead of googleapis');
    
    return {
      success: false,
      message: 'GCP integration temporarily disabled for memory optimization',
      projectId: credentials.projectId
    };
  }
  
  // Get real users from Google Cloud Platform
  static async getGoogleCloudUsers(credentials: {
    serviceAccountKey: string;
    projectId: string;
  }) {
    console.log('⚠️  Google Cloud Platform user fetching temporarily disabled');
    return [];
  }
  
  // Docker Hub Integration
  static async connectDockerHub(credentials: {
    username: string;
    password: string;
  }) {
    try {
      console.log('🔗 Connecting to Docker Hub...');
      
      // Authenticate with Docker Hub
      const loginResponse = await axios.post('https://hub.docker.com/v2/users/login/', {
        username: credentials.username,
        password: credentials.password
      });
      
      const token = loginResponse.data.token;
      
      // Test connection by getting user profile
      const profileResponse = await axios.get('https://hub.docker.com/v2/user/', {
        headers: {
          'Authorization': `JWT ${token}`
        }
      });
      
      console.log('✅ Docker Hub connected successfully');
      return {
        success: true,
        token,
        profile: profileResponse.data
      };
      
    } catch (error: any) {
      console.error('❌ Docker Hub connection failed:', error.message);
      throw new Error(`Docker Hub connection failed: ${error.message}`);
    }
  }
  
  // Get Docker Hub organization members
  static async getDockerHubUsers(credentials: {
    username: string;
    password: string;
    organization?: string;
  }) {
    try {
      console.log('👥 Fetching Docker Hub users...');
      
      // Login to get token
      const loginResponse = await axios.post('https://hub.docker.com/v2/users/login/', {
        username: credentials.username,
        password: credentials.password
      });
      
      const token = loginResponse.data.token;
      const headers = { 'Authorization': `JWT ${token}` };
      
      let users = [];
      
      if (credentials.organization) {
        // Get organization members
        try {
          const orgResponse = await axios.get(
            `https://hub.docker.com/v2/orgs/${credentials.organization}/members/`,
            { headers }
          );
          
          users = orgResponse.data.results.map((member: any) => ({
            id: member.id,
            username: member.username,
            email: member.email || `${member.username}@dockerhub.local`,
            fullName: member.full_name || member.username,
            isActive: member.is_active
          }));
        } catch (orgError) {
          console.log('ℹ️ Organization members not accessible, using personal account');
        }
      }
      
      // If no org users or no org specified, add the authenticated user
      if (users.length === 0) {
        const profileResponse = await axios.get('https://hub.docker.com/v2/user/', { headers });
        users.push({
          id: profileResponse.data.id,
          username: profileResponse.data.username,
          email: profileResponse.data.email || `${profileResponse.data.username}@dockerhub.local`,
          fullName: profileResponse.data.full_name || profileResponse.data.username,
          isActive: true
        });
      }
      
      console.log(`✅ Found ${users.length} Docker Hub users`);
      return users;
      
    } catch (error: any) {
      console.error('❌ Failed to fetch Docker Hub users:', error.message);
      throw new Error(`Failed to fetch Docker Hub users: ${error.message}`);
    }
  }
  
  // Figma Integration
  static async connectFigma(credentials: {
    personalAccessToken: string;
  }) {
    try {
      console.log('🔗 Connecting to Figma...');
      
      // Test connection by getting user info
      const response = await axios.get('https://api.figma.com/v1/me', {
        headers: {
          'X-Figma-Token': credentials.personalAccessToken
        }
      });
      
      console.log('✅ Figma connected successfully');
      return {
        success: true,
        user: response.data
      };
      
    } catch (error: any) {
      console.error('❌ Figma connection failed:', error.message);
      throw new Error(`Figma connection failed: ${error.message}`);
    }
  }
  
  // Get Figma team members
  static async getFigmaUsers(credentials: {
    personalAccessToken: string;
    teamId?: string;
  }) {
    try {
      console.log('👥 Fetching Figma users...');
      
      const headers = { 'X-Figma-Token': credentials.personalAccessToken };
      let users = [];
      
      if (credentials.teamId) {
        // Get team members
        const teamResponse = await axios.get(
          `https://api.figma.com/v1/teams/${credentials.teamId}/members`,
          { headers }
        );
        
        users = teamResponse.data.members.map((member: any) => ({
          id: member.id,
          email: member.email,
          handle: member.handle,
          imgUrl: member.img_url,
          role: member.role
        }));
      } else {
        // Get current user info
        const userResponse = await axios.get('https://api.figma.com/v1/me', { headers });
        users.push({
          id: userResponse.data.id,
          email: userResponse.data.email,
          handle: userResponse.data.handle,
          imgUrl: userResponse.data.img_url,
          role: 'owner'
        });
      }
      
      console.log(`✅ Found ${users.length} Figma users`);
      return users;
      
    } catch (error: any) {
      console.error('❌ Failed to fetch Figma users:', error.message);
      throw new Error(`Failed to fetch Figma users: ${error.message}`);
    }
  }
  
  // Generic API test function
  static async testApiConnection(appName: string, credentials: any) {
    try {
      switch (appName.toLowerCase()) {
        case 'google cloud platform':
          return await this.connectGoogleCloudPlatform(credentials);
        case 'docker':
          return await this.connectDockerHub(credentials);
        case 'figma':
          return await this.connectFigma(credentials);
        default:
          throw new Error(`Unsupported app: ${appName}`);
      }
    } catch (error: any) {
      throw new Error(`API connection test failed: ${error.message}`);
    }
  }
  
  // Generic user fetch function
  static async fetchUsersFromApp(appName: string, credentials: any) {
    try {
      switch (appName.toLowerCase()) {
        case 'google cloud platform':
          return await this.getGoogleCloudUsers(credentials);
        case 'docker':
          return await this.getDockerHubUsers(credentials);
        case 'figma':
          return await this.getFigmaUsers(credentials);
        default:
          throw new Error(`Unsupported app: ${appName}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to fetch users from ${appName}: ${error.message}`);
    }
  }
}

// Helper function to create platform users from external app users
export async function createUserFromExternalApp(
  externalUser: any, 
  companyId: string, 
  appName: string
) {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ 
      email: externalUser.email, 
      companyId 
    });
    
    if (existingUser) {
      console.log(`👤 User ${externalUser.email} already exists`);
      return existingUser;
    }
    
    // Extract name information
    let firstName = 'Unknown';
    let lastName = 'User';
    
    if (externalUser.displayName || externalUser.fullName) {
      const nameParts = (externalUser.displayName || externalUser.fullName).split(' ');
      firstName = nameParts[0] || 'Unknown';
      lastName = nameParts.slice(1).join(' ') || 'User';
    } else if (externalUser.handle) {
      firstName = externalUser.handle;
      lastName = 'User';
    } else if (externalUser.username) {
      firstName = externalUser.username;
      lastName = 'User';
    } else if (externalUser.email) {
      const emailParts = externalUser.email.split('@')[0].split('.');
      firstName = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Unknown';
      lastName = emailParts[1] ? emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1) : 'User';
    }
    
    // Create new user
    const newUser = new User({
      companyId,
      email: externalUser.email,
      firstName,
      lastName,
      role: 'user',
      isActive: externalUser.isActive !== false, // Default to true unless explicitly false
      isEmailVerified: false,
      password: Math.random().toString(36).slice(-12), // Temporary password
      department: `Imported from ${appName}`
    });
    
    await newUser.save();
    console.log(`✅ Created user: ${newUser.email} from ${appName}`);
    
    return newUser;
    
  } catch (error: any) {
    console.error(`❌ Failed to create user from ${appName}:`, error.message);
    throw error;
  }
}
