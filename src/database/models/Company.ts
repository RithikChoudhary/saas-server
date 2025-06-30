import mongoose, { Schema } from 'mongoose';
import { ICompany, SubscriptionPlan, SubscriptionStatus } from '../../shared/types';

const CompanySchema = new Schema<ICompany>({
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  domain: {
    type: String,
    required: [true, 'Company domain is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, 'Please provide a valid domain']
  },
  logo: {
    type: String,
    default: null
  },
  industry: {
    type: String,
    required: [true, 'Industry is required'],
    enum: [
      'technology',
      'healthcare',
      'finance',
      'education',
      'manufacturing',
      'retail',
      'consulting',
      'media',
      'real estate',
      'other'
    ]
  },
  size: {
    type: String,
    required: [true, 'Company size is required'],
    enum: ['1-10', '11-50', '51-200', '1-10 employees', '11-50 employees', '51-200 employees', '201-500 employees', '501-1000 employees', '1000+ employees', '201-500', '501-1000', '1000+']
  },
  subscription: {
    plan: {
      type: String,
      enum: Object.values(SubscriptionPlan),
      default: SubscriptionPlan.STARTER
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.TRIAL
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days trial
    },
    maxUsers: {
      type: Number,
      default: 25
    },
    maxApps: {
      type: Number,
      default: 10
    }
  },
  settings: {
    allowSelfRegistration: {
      type: Boolean,
      default: true
    },
    requireEmailVerification: {
      type: Boolean,
      default: true
    },
    passwordPolicy: {
      minLength: {
        type: Number,
        default: 8
      },
      requireUppercase: {
        type: Boolean,
        default: true
      },
      requireLowercase: {
        type: Boolean,
        default: true
      },
      requireNumbers: {
        type: Boolean,
        default: true
      },
      requireSpecialChars: {
        type: Boolean,
        default: true
      }
    },
    ssoEnabled: {
      type: Boolean,
      default: false
    },
    mfaRequired: {
      type: Boolean,
      default: false
    }
  },
  billing: {
    email: {
      type: String,
      required: [true, 'Billing email is required'],
      match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please provide a valid email']
    },
    address: {
      type: String,
      required: [true, 'Billing address is required']
    },
    paymentMethod: {
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
CompanySchema.index({ domain: 1 }, { unique: true });
CompanySchema.index({ 'subscription.status': 1 });
CompanySchema.index({ createdAt: -1 });

// Virtual for subscription plan limits
CompanySchema.virtual('planLimits').get(function() {
  const limits = {
    [SubscriptionPlan.STARTER]: { maxUsers: 25, maxApps: 10 },
    [SubscriptionPlan.PROFESSIONAL]: { maxUsers: 100, maxApps: 25 },
    [SubscriptionPlan.ENTERPRISE]: { maxUsers: -1, maxApps: -1 } // Unlimited
  };
  return limits[this.subscription.plan];
});

// Virtual for subscription days remaining
CompanySchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const endDate = new Date(this.subscription.endDate);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Pre-save middleware to update subscription limits based on plan
CompanySchema.pre('save', function(next) {
  if (this.isModified('subscription.plan')) {
    const limits = {
      [SubscriptionPlan.STARTER]: { maxUsers: 25, maxApps: 10 },
      [SubscriptionPlan.PROFESSIONAL]: { maxUsers: 100, maxApps: 25 },
      [SubscriptionPlan.ENTERPRISE]: { maxUsers: 1000, maxApps: 100 }
    };
    
    const planLimits = limits[this.subscription.plan];
    this.subscription.maxUsers = planLimits.maxUsers;
    this.subscription.maxApps = planLimits.maxApps;
  }
  next();
});

export default mongoose.model<ICompany>('Company', CompanySchema);
