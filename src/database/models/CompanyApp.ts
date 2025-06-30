import mongoose, { Schema } from 'mongoose';
import { ICompanyApp } from '../../shared/types';

const CompanyAppSchema = new Schema<ICompanyApp>({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company ID is required']
  },
  appId: {
    type: Schema.Types.ObjectId,
    ref: 'App',
    required: [true, 'App ID is required']
  },
  subscriptionTier: {
    type: String,
    required: [true, 'Subscription tier is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  subscriptionStart: {
    type: Date,
    default: Date.now
  },
  subscriptionEnd: {
    type: Date,
    required: [true, 'Subscription end date is required']
  },
  monthlyCost: {
    type: Number,
    required: [true, 'Monthly cost is required'],
    min: 0
  },
  licenseCount: {
    type: Number,
    required: [true, 'License count is required'],
    min: 1
  },
  settings: {
    ssoEnabled: {
      type: Boolean,
      default: false
    },
    autoProvisioning: {
      type: Boolean,
      default: false
    },
    customDomain: {
      type: String,
      trim: true,
      default: null
    }
  },
  usage: {
    activeUsers: {
      type: Number,
      default: 0,
      min: 0
    },
    lastSyncDate: {
      type: Date,
      default: Date.now
    },
    storageUsed: {
      type: String,
      default: null
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
CompanyAppSchema.index({ companyId: 1, appId: 1 }, { unique: true });
CompanyAppSchema.index({ companyId: 1 });
CompanyAppSchema.index({ appId: 1 });
CompanyAppSchema.index({ isActive: 1 });
CompanyAppSchema.index({ subscriptionEnd: 1 });

// Virtual for subscription status
CompanyAppSchema.virtual('subscriptionStatus').get(function(this: ICompanyApp) {
  const now = new Date();
  if (this.subscriptionEnd < now) return 'expired';
  if (!this.isActive) return 'inactive';
  return 'active';
});

// Virtual for days remaining
CompanyAppSchema.virtual('daysRemaining').get(function(this: ICompanyApp) {
  const now = new Date();
  const endDate = new Date(this.subscriptionEnd);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Virtual for utilization percentage
CompanyAppSchema.virtual('utilizationPercentage').get(function(this: ICompanyApp) {
  if (this.licenseCount === 0) return 0;
  return Math.round((this.usage.activeUsers / this.licenseCount) * 100);
});

export default mongoose.model<ICompanyApp>('CompanyApp', CompanyAppSchema);
