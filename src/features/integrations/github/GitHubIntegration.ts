import axios from 'axios';
import { BaseIntegration, IntegrationConfig, ConnectionResult, UserData } from '../base/BaseIntegration';

export class GitHubIntegration extends BaseIntegration {
  config: IntegrationConfig = {
    name: 'GitHub',
    category: 'development',
    description: 'Git repository hosting with collaboration features, CI/CD, and project management.',
    logo: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    website: 'https://github.com',
    features: ['Git Repositories', 'Pull Requests', 'Issues', 'Actions (CI/CD)', 'Project Boards'],
    integrations: ['SSO', 'API', 'Webhook', 'OAuth'],
    pricing: {
      model: 'per_user_monthly',
      tiers: [
        { name: 'Free', price: 0, features: ['Unlimited public repos', '2000 Actions minutes'] },
        { name: 'Team', price: 4, features: ['Unlimited private repos', '3000 Actions minutes'] },
        { name: 'Enterprise', price: 21, features: ['Advanced security', 'SAML SSO'] }
      ]
    },
    credentials: {
      fields: [
        {
          name: 'personalAccessToken',
          label: 'Personal Access Token',
          type: 'password',
          placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
          required: true,
          description: 'GitHub personal access token'
        },
        {
          name: 'organization',
          label: 'Organization',
          type: 'text',
          placeholder: 'your-org-name',
          required: false,
          description: 'GitHub organization name (optional)'
        }
      ],
      permissions: [
        'read:user',
        'read:org',
        'admin:org (for member management)'
      ],
      setupSteps: [
        '1. Go to GitHub Settings > Developer settings',
        '2. Navigate to Personal access tokens > Tokens (classic)',
        '3. Generate new token (classic)',
        '4. Select required scopes: read:user, read:org',
        '5. Copy the generated token'
      ]
    }
  };

  async testConnection(credentials: Record<string, string>): Promise<ConnectionResult> {
    try {
      console.log('🔗 Testing GitHub connection...');
      
      const headers = { 'Authorization': `token ${credentials.personalAccessToken}` };
      
      // Test connection by getting user info
      const userResponse = await axios.get('https://api.github.com/user', { headers });
      
      console.log('✅ GitHub connected successfully');
      return {
        success: true,
        message: 'Successfully connected to GitHub',
        data: {
          user: userResponse.data,
          organization: credentials.organization
        }
      };
    } catch (error: any) {
      console.error('❌ GitHub connection failed:', error.message);
      return {
        success: false,
        error: `GitHub connection failed: ${error.message}`
      };
    }
  }

  async getUsers(credentials: Record<string, string>): Promise<UserData[]> {
    try {
      console.log('👥 Fetching GitHub users...');
      
      const headers = { 'Authorization': `token ${credentials.personalAccessToken}` };
      let users: UserData[] = [];
      
      if (credentials.organization) {
        // Get organization members
        const membersResponse = await axios.get(
          `https://api.github.com/orgs/${credentials.organization}/members`,
          { headers }
        );
        
        users = membersResponse.data.map((member: any) => ({
          id: member.id.toString(),
          email: member.email || `${member.login}@github.local`,
          name: member.login,
          firstName: member.login,
          lastName: 'User',
          isActive: true,
          role: 'Developer',
          department: 'GitHub',
          externalId: member.id.toString()
        }));
      } else {
        // Get current user info
        const userResponse = await axios.get('https://api.github.com/user', { headers });
        users.push({
          id: userResponse.data.id.toString(),
          email: userResponse.data.email || `${userResponse.data.login}@github.local`,
          name: userResponse.data.name || userResponse.data.login,
          firstName: userResponse.data.name?.split(' ')[0] || userResponse.data.login,
          lastName: userResponse.data.name?.split(' ').slice(1).join(' ') || 'User',
          isActive: true,
          role: 'Developer',
          department: 'GitHub',
          externalId: userResponse.data.id.toString()
        });
      }
      
      console.log(`✅ Found ${users.length} GitHub users`);
      return users;
      
    } catch (error: any) {
      console.error('❌ Failed to fetch GitHub users:', error.message);
      throw new Error(`Failed to fetch GitHub users: ${error.message}`);
    }
  }
}
