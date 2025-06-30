import mongoose, { Schema, Document } from 'mongoose';

export interface IAWSUser extends Document {
  _id: mongoose.Types.ObjectId;
  userName: string;
  arn: string;
  email?: string;
  createDate: Date;
  lastActivity?: Date;
  status: 'active' | 'inactive' | 'locked';
  groups: string[];
  policies: string[];
  accessKeys: number;
  mfaEnabled: boolean;
  accountId: string;
  accountName: string;
  companyId: mongoose.Types.ObjectId;
  region: string;
  lastSync: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AWSUserSchema = new Schema<IAWSUser>({
  userName: {
    type: String,
    required: true,
    index: true
  },
  arn: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    sparse: true
  },
  createDate: {
    type: Date,
    required: true
  },
  lastActivity: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'locked'],
    default: 'active'
  },
  groups: [{
    type: String
  }],
  policies: [{
    type: String
  }],
  accessKeys: {
    type: Number,
    default: 0
  },
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  accountId: {
    type: String,
    required: true,
    index: true
  },
  accountName: {
    type: String,
    required: true
  },
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  region: {
    type: String,
    required: true
  },
  lastSync: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'aws_users'
});

// Indexes for performance
AWSUserSchema.index({ companyId: 1, accountId: 1 });
AWSUserSchema.index({ companyId: 1, status: 1 });
AWSUserSchema.index({ userName: 1, accountId: 1 }, { unique: true });

// Static methods
AWSUserSchema.statics.findByCompany = function(companyId: string) {
  return this.find({ 
    companyId: new mongoose.Types.ObjectId(companyId),
    isActive: true 
  });
};

AWSUserSchema.statics.findByAccount = function(companyId: string, accountId: string) {
  return this.find({ 
    companyId: new mongoose.Types.ObjectId(companyId),
    accountId,
    isActive: true 
  });
};

AWSUserSchema.statics.getCompanyStats = function(companyId: string) {
  return this.aggregate([
    {
      $match: {
        companyId: new mongoose.Types.ObjectId(companyId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        mfaEnabledUsers: {
          $sum: { $cond: ['$mfaEnabled', 1, 0] }
        },
        totalAccessKeys: { $sum: '$accessKeys' },
        accounts: { $addToSet: '$accountId' }
      }
    },
    {
      $project: {
        _id: 0,
        totalUsers: 1,
        activeUsers: 1,
        mfaEnabledUsers: 1,
        totalAccessKeys: 1,
        totalAccounts: { $size: '$accounts' }
      }
    }
  ]);
};

export const AWSUser = mongoose.model<IAWSUser>('AWSUser', AWSUserSchema);
