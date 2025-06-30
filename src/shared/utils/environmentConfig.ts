/**
 * Environment Configuration Utility
 * Simplified version for localhost development
 */

export interface EnvironmentConfig {
  frontendUrl: string;
  backendUrl: string;
  isProduction: boolean;
  isDevelopment: boolean;
}

/**
 * Get environment-specific configuration
 * Always uses localhost for development
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = !isProduction;

  const frontendUrl = isProduction 
    ? process.env.FRONTEND_URL_PROD || 'https://saasdor.com'
    : process.env.FRONTEND_URL_DEV || 'http://localhost:3000';

  const backendUrl = isProduction 
    ? process.env.BACKEND_URL_PROD || 'https://server.saasdor.com'
    : process.env.BACKEND_URL_DEV || 'http://localhost:5000';

  return {
    frontendUrl,
    backendUrl,
    isProduction,
    isDevelopment
  };
}

/**
 * Get OAuth redirect URI for a specific service
 * Automatically uses correct domain based on environment
 */
export function getOAuthRedirectUri(service: string): string {
  const { backendUrl } = getEnvironmentConfig();
  return `${backendUrl}/api/integrations/${service}/callback`;
}

/**
 * Get CORS origins - simplified to always allow localhost
 */
export function getCorsOrigins(): string[] {
  return [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:5173',
    'https://saasdor.com',
    'https://www.saasdor.com',
    'https://server.saasdor.com'
  ];
}

/**
 * Log current environment configuration
 */
export function logEnvironmentConfig(): void {
  const config = getEnvironmentConfig();
  console.log('🌐 Environment Configuration:');
  console.log(`   Mode: ${config.isProduction ? 'Production' : 'Development'}`);
  console.log(`   Frontend URL: ${config.frontendUrl}`);
  console.log(`   Backend URL: ${config.backendUrl}`);
  console.log(`   CORS Origins: ${getCorsOrigins().join(', ')}`);
}
