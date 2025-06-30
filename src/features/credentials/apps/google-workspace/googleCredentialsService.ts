export class GoogleCredentialsService {
  
  async testCredentials(credentials: { [key: string]: string }): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { serviceAccountKey, adminEmail, customerId } = credentials;
      
      if (!serviceAccountKey || !adminEmail) {
        return {
          success: false,
          message: 'Missing required credentials: Service Account Key and Admin Email'
        };
      }

      // Basic validation for Google Workspace credentials
      try {
        const serviceAccount = JSON.parse(serviceAccountKey);
        
        if (!serviceAccount.type || serviceAccount.type !== 'service_account') {
          return {
            success: false,
            message: 'Invalid Service Account Key. Must be a service account JSON file.'
          };
        }

        if (!serviceAccount.client_email || !serviceAccount.private_key) {
          return {
            success: false,
            message: 'Invalid Service Account Key. Missing client_email or private_key.'
          };
        }

      } catch (error) {
        return {
          success: false,
          message: 'Invalid Service Account Key format. Must be valid JSON.'
        };
      }

      // Validate admin email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminEmail)) {
        return {
          success: false,
          message: 'Invalid admin email format.'
        };
      }

      return {
        success: true,
        message: 'Google Workspace credentials format is valid.',
        details: {
          adminEmail,
          customerId: customerId || 'Not specified',
          hasServiceAccount: !!serviceAccountKey
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Failed to validate Google Workspace credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
