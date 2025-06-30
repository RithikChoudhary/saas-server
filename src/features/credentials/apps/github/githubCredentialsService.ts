export class GitHubCredentialsService {
  
  async testCredentials(credentials: { [key: string]: string }): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { personalAccessToken, organization, apiUrl } = credentials;
      
      if (!personalAccessToken) {
        return {
          success: false,
          message: 'Missing required credential: Personal Access Token'
        };
      }

      // Basic validation for GitHub PAT
      if (!/^gh[ps]_[A-Za-z0-9_]{36,255}$/.test(personalAccessToken)) {
        return {
          success: false,
          message: 'Invalid Personal Access Token format. Should start with ghp_ or ghs_ followed by alphanumeric characters.'
        };
      }

      return {
        success: true,
        message: 'GitHub credentials format is valid.',
        details: {
          tokenPrefix: personalAccessToken.substring(0, 8) + '...',
          organization: organization || 'Personal account',
          apiUrl: apiUrl || 'https://api.github.com'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Failed to validate GitHub credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
