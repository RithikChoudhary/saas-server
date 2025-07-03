export interface CredentialValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class CredentialsValidator {
  
  static validateSlackCredentials(credentials: { [key: string]: string }): CredentialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const { clientId, clientSecret, redirectUri } = credentials;

    // Required fields validation
    if (!clientId) {
      errors.push('Client ID is required');
    } else if (!/^\d+\.\d+$/.test(clientId)) {
      errors.push('Client ID should be in format: numbers.numbers (e.g., 123456789.987654321)');
    }

    if (!clientSecret) {
      errors.push('Client Secret is required');
    } else if (clientSecret.length < 30) {
      errors.push('Client Secret appears to be too short (should be at least 30 characters)');
    }

    // Optional fields validation
    if (redirectUri) {
      try {
        new URL(redirectUri);
        if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) {
          warnings.push('Redirect URI should use HTTP or HTTPS protocol');
        }
      } catch {
        errors.push('Redirect URI must be a valid URL');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateGoogleWorkspaceCredentials(credentials: { [key: string]: string }): CredentialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const { serviceAccountKey, adminEmail, customerId } = credentials;

    // Required fields validation
    if (!serviceAccountKey) {
      errors.push('Service Account JSON Key is required');
    } else {
      try {
        const keyData = JSON.parse(serviceAccountKey);
        
        const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri'];
        const missingFields = requiredFields.filter(field => !keyData[field]);
        
        if (missingFields.length > 0) {
          errors.push(`Service Account Key is missing required fields: ${missingFields.join(', ')}`);
        }
        
        if (keyData.type !== 'service_account') {
          errors.push('Service Account Key must be of type "service_account"');
        }
        
        if (!keyData.private_key?.includes('BEGIN PRIVATE KEY')) {
          errors.push('Service Account Key appears to have an invalid private key format');
        }
        
      } catch (parseError) {
        errors.push('Service Account Key must be valid JSON');
      }
    }

    if (!adminEmail) {
      errors.push('Admin Email is required for domain-wide delegation');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      errors.push('Admin Email must be a valid email address');
    }

    // Optional fields validation
    if (customerId && !/^C[a-zA-Z0-9]{8,}$/.test(customerId)) {
      warnings.push('Customer ID should start with "C" followed by alphanumeric characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateGitHubCredentials(credentials: { [key: string]: string }): CredentialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const { personalAccessToken, organization, apiUrl } = credentials;

    // Required fields validation
    if (!personalAccessToken) {
      errors.push('Personal Access Token is required');
    } else {
      // GitHub PATs start with 'ghp_' for fine-grained or 'github_pat_' for classic
      if (!personalAccessToken.startsWith('ghp_') && !personalAccessToken.startsWith('github_pat_') && personalAccessToken.length < 40) {
        warnings.push('Personal Access Token format appears unusual. Ensure it has the required scopes.');
      }
    }

    // Optional fields validation
    if (organization && !/^[a-zA-Z0-9\-_.]+$/.test(organization)) {
      warnings.push('Organization name contains invalid characters');
    }

    if (apiUrl) {
      try {
        new URL(apiUrl);
        if (!apiUrl.includes('api.github.com') && !apiUrl.includes('github.com/api')) {
          warnings.push('API URL should point to GitHub API endpoint');
        }
      } catch {
        errors.push('API URL must be a valid URL');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateZoomCredentials(credentials: { [key: string]: string }): CredentialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const { clientId, clientSecret, redirectUri } = credentials;

    // Required fields validation
    if (!clientId) {
      errors.push('Client ID is required');
    } else if (clientId.length < 10) {
      warnings.push('Client ID appears to be too short');
    }

    if (!clientSecret) {
      errors.push('Client Secret is required');
    } else if (clientSecret.length < 20) {
      warnings.push('Client Secret appears to be too short');
    }

    // Optional fields validation
    if (redirectUri) {
      try {
        new URL(redirectUri);
        if (!redirectUri.startsWith('http://') && !redirectUri.startsWith('https://')) {
          warnings.push('Redirect URI should use HTTP or HTTPS protocol');
        }
      } catch {
        errors.push('Redirect URI must be a valid URL');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateAWSCredentials(credentials: { [key: string]: string }): CredentialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const { accessKey, secretKey, region } = credentials;

    // Required fields validation
    if (!accessKey) {
      errors.push('Access Key ID is required');
    } else if (!/^AKIA[0-9A-Z]{16}$/.test(accessKey) && !/^ASIA[0-9A-Z]{16}$/.test(accessKey)) {
      warnings.push('Access Key ID format appears unusual (should start with AKIA or ASIA)');
    }

    if (!secretKey) {
      errors.push('Secret Access Key is required');
    } else if (secretKey.length !== 40) {
      warnings.push('Secret Access Key should be exactly 40 characters long');
    }

    if (!region) {
      errors.push('Region is required');
    } else if (!/^[a-z]{2}-[a-z]+-\d{1}$/.test(region)) {
      warnings.push('Region format appears unusual (e.g., us-east-1, eu-west-1)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateDatadogCredentials(credentials: { [key: string]: string }): CredentialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const { organizationName, site, apiKey, applicationKey } = credentials;

    // Required fields validation
    if (!organizationName) {
      errors.push('Organization Name is required');
    } else if (organizationName.length < 2) {
      warnings.push('Organization Name appears to be too short');
    }

    if (!site) {
      errors.push('Datadog Site is required');
    } else {
      const validSites = [
        'datadoghq.com',
        'us3.datadoghq.com', 
        'us5.datadoghq.com',
        'datadoghq.eu',
        'ap1.datadoghq.com'
      ];
      if (!validSites.includes(site)) {
        warnings.push(`Site should be one of: ${validSites.join(', ')}`);
      }
    }

    if (!apiKey) {
      errors.push('API Key is required');
    } else if (apiKey.length !== 32) {
      warnings.push('API Key should be exactly 32 characters long');
    }

    if (!applicationKey) {
      errors.push('Application Key is required');
    } else if (applicationKey.length !== 40) {
      warnings.push('Application Key should be exactly 40 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateCredentials(appType: string, credentials: { [key: string]: string }): CredentialValidationResult {
    console.log(`🔍 Validating ${appType} credentials...`);
    
    let result: CredentialValidationResult;
    
    switch (appType) {
      case 'slack':
        result = this.validateSlackCredentials(credentials);
        break;
      case 'google-workspace':
        result = this.validateGoogleWorkspaceCredentials(credentials);
        break;
      case 'github':
        result = this.validateGitHubCredentials(credentials);
        break;
      case 'zoom':
        result = this.validateZoomCredentials(credentials);
        break;
      case 'aws':
        result = this.validateAWSCredentials(credentials);
        break;
      case 'datadog':
        result = this.validateDatadogCredentials(credentials);
        break;
      default:
        result = {
          isValid: false,
          errors: [`Validation not implemented for app type: ${appType}`],
          warnings: []
        };
    }
    
    if (result.isValid) {
      console.log(`✅ ${appType} credentials validation passed`);
    } else {
      console.log(`❌ ${appType} credentials validation failed:`, result.errors);
    }
    
    if (result.warnings.length > 0) {
      console.log(`⚠️ ${appType} credentials validation warnings:`, result.warnings);
    }
    
    return result;
  }
}

// Legacy function for backward compatibility
export const validateCredentials = (creds: any) => {
  if (!creds) return false;
  
  // Basic validation - at least one credential field should exist
  const hasCredentials = Object.keys(creds).some(key => 
    creds[key] && typeof creds[key] === 'string' && creds[key].trim().length > 0
  );
  
  return hasCredentials;
};
