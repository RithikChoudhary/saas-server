export class AWSCredentialsService {
  
  async testCredentials(credentials: { [key: string]: string }): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { accessKey, secretKey, region } = credentials;
      
      if (!accessKey || !secretKey) {
        return {
          success: false,
          message: 'Missing required credentials: Access Key ID and Secret Access Key'
        };
      }

      // Basic validation for AWS credentials
      if (!/^AKIA[0-9A-Z]{16}$/.test(accessKey)) {
        return {
          success: false,
          message: 'Invalid Access Key ID format. Should start with AKIA followed by 16 characters.'
        };
      }

      if (secretKey.length !== 40) {
        return {
          success: false,
          message: 'Invalid Secret Access Key format. Should be 40 characters long.'
        };
      }

      return {
        success: true,
        message: 'AWS credentials format is valid.',
        details: {
          accessKey: accessKey.substring(0, 8) + '...',
          region: region || 'us-east-1',
          hasSecretKey: !!secretKey
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Failed to validate AWS credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
