import mongoose, { Schema, Document } from 'mongoose';

export interface IAWSAccount extends Document {
  companyId: mongoose.Types.ObjectId;
  accountId: string;
  accountName: string;
  alias?: string;
  email?: string;
  region: string;
  status: 'connected' | 'error' | 'syncing' | 'pending';
  accountStatus?: 'ACTIVE' | 'SUSPENDED';
  accessType: 'cross-account-role' | 'access-keys' | 'sso';
  credentials: {
    roleArn?: string;
    externalId?: string;
    accessKeyId?: string;
    secretAccessKey?: string | { encrypted: string; iv: string; authTag: string };
    sessionToken?: string | { encrypted: string; iv: string; authTag: string };
    ssoUrl?: string;
  };
  credentialSetName?: string;
  organizationUnit?: string;
  organizationId?: string;
  organizationalUnitId?: string;
  joinedMethod?: 'INVITED' | 'CREATED';
  joinedTimestamp?: Date;
  lastSync?: Date;
  syncStatus?: string;
  users: number;
  resources: {
    ec2: number;
    s3: number;
    iam: number;
    lambda: number;
  };
  monthlyCost: number;
  securityScore?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSyncFormatted: string;
}

export interface IAWSAccountModel extends mongoose.Model<IAWSAccount> {
  findByCompany(companyId: string): Promise<IAWSAccount[]>;
  findByAccountId(accountId: string): Promise<IAWSAccount | null>;
  getCompanyStats(companyId: string): Promise<any[]>;
}

const AWSAccountSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  accountId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  accountName: {
    type: String,
    required: true
  },
  alias: {
    type: String,
    sparse: true
  },
  email: {
    type: String,
    sparse: true
  },
  region: {
    type: String,
    required: true,
    default: 'us-east-1'
  },
  status: {
    type: String,
    enum: ['connected', 'error', 'syncing', 'pending'],
    default: 'pending'
  },
  accountStatus: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  accessType: {
    type: String,
    enum: ['cross-account-role', 'access-keys', 'sso'],
    required: true
  },
  credentials: {
    roleArn: String,
    externalId: String,
    accessKeyId: String,
    secretAccessKey: Schema.Types.Mixed,  // Can be string or encrypted object
    sessionToken: Schema.Types.Mixed,      // Can be string or encrypted object
    ssoUrl: String
  },
  credentialSetName: {
    type: String,
    sparse: true
  },
  organizationUnit: {
    type: String,
    default: null
  },
  organizationId: {
    type: String,
    sparse: true
  },
  organizationalUnitId: {
    type: String,
    sparse: true
  },
  joinedMethod: {
    type: String,
    enum: ['INVITED', 'CREATED'],
    sparse: true
  },
  joinedTimestamp: {
    type: Date,
    sparse: true
  },
  lastSync: {
    type: Date,
    default: null
  },
  syncStatus: {
    type: String,
    default: null
  },
  users: {
    type: Number,
    default: 0
  },
  resources: {
    ec2: { type: Number, default: 0 },
    s3: { type: Number, default: 0 },
    iam: { type: Number, default: 0 },
    lambda: { type: Number, default: 0 }
  },
  monthlyCost: {
    type: Number,
    default: 0
  },
  securityScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'aws_accounts'
});

// Indexes for performance
AWSAccountSchema.index({ companyId: 1, accountId: 1 }, { unique: true });
AWSAccountSchema.index({ companyId: 1, status: 1 });
AWSAccountSchema.index({ companyId: 1, isActive: 1 });

// Virtual for formatted last sync
AWSAccountSchema.virtual('lastSyncFormatted').get(function(this: IAWSAccount) {
  if (!this.lastSync) return 'Never';
  
  const now = new Date();
  const diff = now.getTime() - this.lastSync.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
});

// Pre-save middleware to encrypt sensitive data
AWSAccountSchema.pre('save', function(next) {
  // TODO: Implement encryption for credentials
  // For now, we'll store them as-is but in production should encrypt
  next();
});

// Static methods
AWSAccountSchema.statics.findByCompany = function(companyId: string) {
  return this.find({ companyId, isActive: true });
};

AWSAccountSchema.statics.findByAccountId = function(accountId: string) {
  return this.findOne({ accountId, isActive: true });
};

AWSAccountSchema.statics.getCompanyStats = function(companyId: string) {
  return this.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), isActive: true } },
    {
      $group: {
        _id: null,
        totalAccounts: { $sum: 1 },
        connectedAccounts: {
          $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] }
        },
        totalUsers: { $sum: '$users' },
        totalCost: { $sum: '$monthlyCost' },
        totalResources: {
          $sum: {
            $add: ['$resources.ec2', '$resources.s3', '$resources.iam', '$resources.lambda']
          }
        },
        avgSecurityScore: { $avg: '$securityScore' }
      }
    }
  ]);
};

export const AWSAccount = mongoose.model<IAWSAccount, IAWSAccountModel>('AWSAccount', AWSAccountSchema);
