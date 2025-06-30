import { Document, Types } from 'mongoose';

// User Roles
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  COMPANY_ADMIN = 'company_admin',
  DEPT_MANAGER = 'dept_manager',
  IT_MANAGER = 'it_manager',
  HR_MANAGER = 'hr_manager',
  USER = 'user'
}

// Subscription Plans
export enum SubscriptionPlan {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

// Subscription Status
export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRIAL = 'trial',
  SUSPENDED = 'suspended'
}

// App Categories
export enum AppCategory {
  PRODUCTIVITY = 'productivity',
  COMMUNICATION = 'communication',
  DEVELOPMENT = 'development',
  DESIGN = 'design',
  MARKETING = 'marketing',
  FINANCE = 'finance',
  HR = 'hr',
  SALES = 'sales',
  ANALYTICS = 'analytics',
  SECURITY = 'security',
  INFRASTRUCTURE = 'infrastructure',
  BUSINESS = 'business',
  SUPPORT = 'support',
  LOGISTICS = 'logistics',
  DATABASE = 'database'
}

// Company Interface
export interface ICompany extends Document {
  _id: Types.ObjectId;
  name: string;
  domain: string;
  logo?: string;
  industry: string;
  size: string;
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    startDate: Date;
    endDate: Date;
    maxUsers: number;
    maxApps: number;
  };
  settings: {
    allowSelfRegistration: boolean;
    requireEmailVerification: boolean;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
    ssoEnabled: boolean;
    mfaRequired: boolean;
  };
  billing: {
    email: string;
    address: string;
    paymentMethod?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// User Interface
export interface IUser extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string;
  jobTitle?: string;
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  preferences: {
    theme: 'light' | 'dark';
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      browser: boolean;
      mobile: boolean;
    };
  };
  // AWS-specific fields
  awsUserId?: string;
  awsArn?: string;
  awsUserName?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual fields
  fullName: string;
  isLocked: boolean;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateEmailVerificationToken(): string;
  generatePasswordResetToken(): string;
  incLoginAttempts(): Promise<IUser>;
  resetLoginAttempts(): Promise<IUser>;
}

// App Interface
export interface IApp extends Document {
  _id: Types.ObjectId;
  name: string;
  category: AppCategory;
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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Company App Interface
export interface ICompanyApp extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  appId: Types.ObjectId;
  subscriptionTier: string;
  isActive: boolean;
  subscriptionStart: Date;
  subscriptionEnd: Date;
  monthlyCost: number;
  licenseCount: number;
  settings: {
    ssoEnabled: boolean;
    autoProvisioning: boolean;
    customDomain?: string;
  };
  usage: {
    activeUsers: number;
    lastSyncDate: Date;
    storageUsed?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// User App Access Interface
export interface IUserAppAccess extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  appId: Types.ObjectId;
  companyAppId: Types.ObjectId;
  accessLevel: 'full' | 'limited' | 'read_only';
  permissions: string[];
  grantedBy: Types.ObjectId;
  grantedAt: Date;
  lastAccessed?: Date;
  accessCount: number;
  isActive: boolean;
  expiresAt?: Date;
  externalUserId?: string;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// JWT Payload Interface
export interface IJWTPayload {
  userId: string;
  companyId: string;
  role: UserRole;
  email: string;
}

// Request Interface Extensions
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    companyId: string;
    role: UserRole;
    email: string;
  };
}

// API Response Interface
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Login Request Interface
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Register Request Interface
export interface RegisterRequest {
  companyName: string;
  companyDomain: string;
  industry: string;
  companySize: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

// Dashboard Stats Interface
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalApps: number;
  activeApps: number;
  monthlyCost: number;
  recentActivity: {
    type: string;
    description: string;
    timestamp: Date;
    user: string;
  }[];
}
