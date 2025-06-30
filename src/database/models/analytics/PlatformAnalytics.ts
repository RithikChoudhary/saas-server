import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformAnalytics extends Document {
  companyId: mongoose.Types.ObjectId;
  date: Date;
  platform: 'google-workspace' | 'github' | 'slack' | 'zoom' | 'aws';
  metrics: {
    totalUsers: number;
    activeUsers: number;
    ghostUsers: number;
    adminUsers: number;
    users2FA: number;
    suspendedUsers: number;
    licenseCost: number;
    wastedCost: number;
    storageUsed?: number;
    storageQuota?: number;
  };
  trends: {
    userGrowth: number;
    activityChange: number;
    costChange: number;
    ghostUserChange: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformAnalyticsSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  platform: {
    type: String,
    enum: ['google-workspace', 'github', 'slack', 'zoom', 'aws'],
    required: true
  },
  metrics: {
    totalUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    ghostUsers: { type: Number, default: 0 },
    adminUsers: { type: Number, default: 0 },
    users2FA: { type: Number, default: 0 },
    suspendedUsers: { type: Number, default: 0 },
    licenseCost: { type: Number, default: 0 },
    wastedCost: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 },
    storageQuota: { type: Number, default: 0 }
  },
  trends: {
    userGrowth: { type: Number, default: 0 },
    activityChange: { type: Number, default: 0 },
    costChange: { type: Number, default: 0 },
    ghostUserChange: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'platform_analytics'
});

// Time-series analytics indexes
PlatformAnalyticsSchema.index({ companyId: 1, date: 1, platform: 1 }, { unique: true });
PlatformAnalyticsSchema.index({ companyId: 1, platform: 1, date: -1 });
PlatformAnalyticsSchema.index({ companyId: 1, date: -1 });

// Metrics analysis indexes
PlatformAnalyticsSchema.index({ companyId: 1, 'metrics.ghostUsers': 1 });
PlatformAnalyticsSchema.index({ companyId: 1, 'metrics.wastedCost': 1 });
PlatformAnalyticsSchema.index({ companyId: 1, 'metrics.totalUsers': 1 });
PlatformAnalyticsSchema.index({ companyId: 1, 'metrics.licenseCost': 1 });

// Platform-specific indexes
PlatformAnalyticsSchema.index({ companyId: 1, platform: 1, isActive: 1 });

// Compound indexes for complex queries
PlatformAnalyticsSchema.index({ 
  companyId: 1, 
  platform: 1, 
  date: -1, 
  isActive: 1 
});

export const PlatformAnalytics = mongoose.model<IPlatformAnalytics>('PlatformAnalytics', PlatformAnalyticsSchema);
