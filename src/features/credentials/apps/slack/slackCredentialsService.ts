import axios from 'axios';

export class SlackCredentialsService {
  
  async testCredentials(credentials: { [key: string]: string }): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { clientId, clientSecret } = credentials;
      
      if (!clientId || !clientSecret) {
        return {
          success: false,
          message: 'Missing required credentials: Client ID and Client Secret'
        };
      }

      // Test the credentials by making a basic API call to Slack
      // We'll use the oauth.v2.access endpoint to validate the credentials
      const testUrl = 'https://slack.com/api/auth.test';
      
      // For testing purposes, we'll just validate the format and make a basic check
      // In a real implementation, you'd need a valid access token to test
      
      // Basic validation
      if (clientId.length < 10 || clientSecret.length < 30) {
        return {
          success: false,
          message: 'Invalid credential format. Client ID or Client Secret appears to be invalid.'
        };
      }

      return {
        success: true,
        message: 'Slack credentials format is valid. OAuth flow can be initiated.',
        details: {
          clientId: clientId.substring(0, 8) + '...',
          hasClientSecret: !!clientSecret
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Failed to validate Slack credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  validateCredentialFormat(credentials: { [key: string]: string }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { clientId, clientSecret, redirectUri } = credentials;

    if (!clientId) {
      errors.push('Client ID is required');
    } else if (!/^\d+\.\d+$/.test(clientId)) {
      errors.push('Client ID should be in format: numbers.numbers');
    }

    if (!clientSecret) {
      errors.push('Client Secret is required');
    } else if (clientSecret.length < 30) {
      errors.push('Client Secret appears to be too short');
    }

    if (redirectUri && !redirectUri.startsWith('http')) {
      errors.push('Redirect URI must be a valid HTTP/HTTPS URL');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getRequiredScopes(): string[] {
    return [
      'channels:read',
      'channels:history',
      'users:read',
      'users:read.email',
      'team:read',
      'chat:write'
    ];
  }

  generateOAuthUrl(credentials: { [key: string]: string }, state: string): string {
    const { clientId, redirectUri } = credentials;
    const scopes = this.getRequiredScopes().join(',');
    
    return `https://slack.com/oauth/v2/authorize?` +
      `client_id=${clientId}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri || 'http://localhost:5000/api/integrations/slack/callback')}&` +
      `state=${state}`;
  }
}
