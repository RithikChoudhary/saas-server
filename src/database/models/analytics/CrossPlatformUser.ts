import mongoose, { Schema, Document } from 'mongoose';

export interface ICrossPlatformUser extends Document {
  companyId: mongoose.Types.ObjectId;
  primaryEmail: string;
  platforms: {
    googleWorkspace?: {
      userId: string;
      lastLogin?: Date;
      isAdmin: boolean;
      has2FA: boolean;
      suspended: boolean;
      orgUnitPath?: string;
    };
    github?: {
      userId: string;
      lastActivity?: Date;
      isAdmin: boolean;
      suspended: boolean;
      login: string;
    };
    slack?: {
      userId: string;
      lastActivity?: Date;
      isAdmin: boolean;
      suspended: boolean;
      workspaceId: string;
    };
    zoom?: {
      userId: string;
      lastLogin?: Date;
      licenseType: string;
      suspended: boolean;
      accountId: string;
    };
    aws?: {
      userId: string;
      lastActivity?: Date;
      isAdmin: boolean;
      suspended: boolean;
      accountId: string;
    };
  };
  ghostStatus: {
    isGhost: boolean;
    neverLoggedInPlatforms: string[];
    inactiveDays: number;
    lastCalculated: Date;
  };
  licenseWaste: {
    totalMonthlyCost: number;
    wastedCost: number;
    recommendations: string[];
    lastCalculated: Date;
  };
  securityRisks: {
    adminWithout2FA: string[];
    suspendedWithAccess: string[];
    riskScore: number;
    lastCalculated: Date;
  };
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CrossPlatformUserSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  primaryEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  platforms: {
    googleWorkspace: {
      userId: String,
      lastLogin: Date,
      isAdmin: { type: Boolean, default: false },
      has2FA: { type: Boolean, default: false },
      suspended: { type: Boolean, default: false },
      orgUnitPath: String
    },
    github: {
      userId: String,
      lastActivity: Date,
      isAdmin: { type: Boolean, default: false },
      suspended: { type: Boolean, default: false },
      login: String
    },
    slack: {
      userId: String,
      lastActivity: Date,
      isAdmin: { type: Boolean, default: false },
      suspended: { type: Boolean, default: false },
      workspaceId: String
    },
    zoom: {
      userId: String,
      lastLogin: Date,
      licenseType: String,
      suspended: { type: Boolean, default: false },
      accountId: String
    },
    aws: {
      userId: String,
      lastActivity: Date,
      isAdmin: { type: Boolean, default: false },
      suspended: { type: Boolean, default: false },
      accountId: String
    }
  },
  ghostStatus: {
    isGhost: { type: Boolean, default: false },
    neverLoggedInPlatforms: [{ type: String }],
    inactiveDays: { type: Number, default: 0 },
    lastCalculated: { type: Date, default: Date.now }
  },
  licenseWaste: {
    totalMonthlyCost: { type: Number, default: 0 },
    wastedCost: { type: Number, default: 0 },
    recommendations: [{ type: String }],
    lastCalculated: { type: Date, default: Date.now }
  },
  securityRisks: {
    adminWithout2FA: [{ type: String }],
    suspendedWithAccess: [{ type: String }],
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    lastCalculated: { type: Date, default: Date.now }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSync: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'cross_platform_users'
});

// Performance-optimized indexes for analytics queries
CrossPlatformUserSchema.index({ companyId: 1, primaryEmail: 1 }, { unique: true });
CrossPlatformUserSchema.index({ companyId: 1, isActive: 1 });
CrossPlatformUserSchema.index({ companyId: 1, 'ghostStatus.isGhost': 1 });
CrossPlatformUserSchema.index({ companyId: 1, 'securityRisks.riskScore': 1 });
CrossPlatformUserSchema.index({ companyId: 1, 'licenseWaste.wastedCost': 1 });

// Platform presence indexes
CrossPlatformUserSchema.index({ companyId: 1, 'platforms.googleWorkspace': 1 });
CrossPlatformUserSchema.index({ companyId: 1, 'platforms.github': 1 });
CrossPlatformUserSchema.index({ companyId: 1, 'platforms.slack': 1 });
CrossPlatformUserSchema.index({ companyId: 1, 'platforms.zoom': 1 });
CrossPlatformUserSchema.index({ companyId: 1, 'platforms.aws': 1 });

// Email search index
CrossPlatformUserSchema.index({ primaryEmail: 'text' });

// Compound indexes for complex queries
CrossPlatformUserSchema.index({ 
  companyId: 1, 
  isActive: 1, 
  'ghostStatus.isGhost': 1 
});

CrossPlatformUserSchema.index({ 
  companyId: 1, 
  isActive: 1, 
  'securityRisks.riskScore': -1 
});

export const CrossPlatformUser = mongoose.model<ICrossPlatformUser>('CrossPlatformUser', CrossPlatformUserSchema);
