import mongoose, { Schema, Document } from 'mongoose';

export interface ILicenseOptimization extends Document {
  companyId: mongoose.Types.ObjectId;
  platform: 'google-workspace' | 'github' | 'slack' | 'zoom' | 'aws';
  optimizationType: 'ghost_user_removal' | 'license_downgrade' | 'unused_feature_removal' | 'bulk_discount' | 'renewal_timing';
  priority: 'low' | 'medium' | 'high' | 'critical';
  potentialSavings: {
    monthly: number;
    annual: number;
    currency: string;
  };
  currentCost: {
    monthly: number;
    annual: number;
    currency: string;
  };
  affectedUsers: [{
    userId: string;
    userEmail: string;
    currentLicense: string;
    recommendedAction: string;
    monthlySaving: number;
  }];
  recommendation: {
    title: string;
    description: string;
    actionItems: string[];
    implementation: string;
    riskLevel: 'low' | 'medium' | 'high';
    timeToImplement: string;
  };
  metrics: {
    totalLicenses: number;
    unusedLicenses: number;
    underutilizedLicenses: number;
    utilizationRate: number;
    wastePercentage: number;
  };
  isImplemented: boolean;
  implementedAt?: Date;
  implementedBy?: string;
  actualSavings?: {
    monthly: number;
    annual: number;
  };
  lastCalculated: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LicenseOptimizationSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['google-workspace', 'github', 'slack', 'zoom', 'aws'],
    required: true
  },
  optimizationType: {
    type: String,
    enum: ['ghost_user_removal', 'license_downgrade', 'unused_feature_removal', 'bulk_discount', 'renewal_timing'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  potentialSavings: {
    monthly: { type: Number, required: true },
    annual: { type: Number, required: true },
    currency: { type: String, default: 'USD' }
  },
  currentCost: {
    monthly: { type: Number, required: true },
    annual: { type: Number, required: true },
    currency: { type: String, default: 'USD' }
  },
  affectedUsers: [{
    userId: { type: String, required: true },
    userEmail: { type: String, required: true },
    currentLicense: { type: String, required: true },
    recommendedAction: { type: String, required: true },
    monthlySaving: { type: Number, required: true }
  }],
  recommendation: {
    title: { type: String, required: true },
    description: { type: String, required: true },
    actionItems: [{ type: String }],
    implementation: { type: String, required: true },
    riskLevel: { 
      type: String, 
      enum: ['low', 'medium', 'high'], 
      default: 'low' 
    },
    timeToImplement: { type: String, required: true }
  },
  metrics: {
    totalLicenses: { type: Number, default: 0 },
    unusedLicenses: { type: Number, default: 0 },
    underutilizedLicenses: { type: Number, default: 0 },
    utilizationRate: { type: Number, default: 0, min: 0, max: 100 },
    wastePercentage: { type: Number, default: 0, min: 0, max: 100 }
  },
  isImplemented: {
    type: Boolean,
    default: false
  },
  implementedAt: {
    type: Date
  },
  implementedBy: {
    type: String
  },
  actualSavings: {
    monthly: { type: Number },
    annual: { type: Number }
  },
  lastCalculated: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'license_optimizations'
});

// License optimization indexes
LicenseOptimizationSchema.index({ companyId: 1, platform: 1, isImplemented: 1 });
LicenseOptimizationSchema.index({ companyId: 1, priority: 1, isImplemented: 1 });
LicenseOptimizationSchema.index({ companyId: 1, 'potentialSavings.monthly': -1 });
LicenseOptimizationSchema.index({ companyId: 1, optimizationType: 1 });
LicenseOptimizationSchema.index({ companyId: 1, lastCalculated: -1 });

// Performance indexes for dashboard queries
LicenseOptimizationSchema.index({ companyId: 1, isActive: 1, isImplemented: 1 });
LicenseOptimizationSchema.index({ companyId: 1, 'potentialSavings.annual': -1, isImplemented: 1 });

// Compound indexes for complex queries
LicenseOptimizationSchema.index({ 
  companyId: 1, 
  platform: 1, 
  priority: 1, 
  isImplemented: 1 
});

LicenseOptimizationSchema.index({ 
  companyId: 1, 
  optimizationType: 1, 
  isImplemented: 1, 
  lastCalculated: -1 
});

export const LicenseOptimization = mongoose.model<ILicenseOptimization>('LicenseOptimization', LicenseOptimizationSchema);
