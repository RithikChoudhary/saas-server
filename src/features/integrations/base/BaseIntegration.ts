export interface CredentialField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'textarea' | 'file';
  placeholder: string;
  required: boolean;
  description?: string;
}

export interface IntegrationConfig {
  name: string;
  category: string;
  description: string;
  logo: string;
  website: string;
  features: string[];
  integrations: string[];
  pricing: {
    model: string;
    tiers: {
      name: string;
      price: number;
      features: string[];
    }[];
  };
  credentials: {
    fields: CredentialField[];
    permissions: string[];
    setupSteps: string[];
  };
}

export interface ConnectionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface UserData {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  role?: string;
  department?: string;
  externalId?: string;
}

export abstract class BaseIntegration {
  abstract config: IntegrationConfig;
  
  abstract testConnection(credentials: Record<string, string>): Promise<ConnectionResult>;
  abstract getUsers(credentials: Record<string, string>): Promise<UserData[]>;
  
  async createUser?(credentials: Record<string, string>, userData: UserData): Promise<ConnectionResult> {
    return { success: false, error: 'Create user not implemented for this integration' };
  }
  
  async updateUser?(credentials: Record<string, string>, userId: string, userData: UserData): Promise<ConnectionResult> {
    return { success: false, error: 'Update user not implemented for this integration' };
  }
  
  async deleteUser?(credentials: Record<string, string>, userId: string): Promise<ConnectionResult> {
    return { success: false, error: 'Delete user not implemented for this integration' };
  }
}
