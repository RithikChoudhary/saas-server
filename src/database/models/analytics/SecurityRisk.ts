import mongoose, { Schema, Document } from 'mongoose';

export interface ISecurityRisk extends Document {
  companyId: mongoose.Types.ObjectId;
  userId: string;
  userEmail: string;
  platform: 'google-workspace' | 'github' | 'slack' | 'zoom' | 'aws';
  riskType: 'admin_without_2fa' | 'suspended_with_access' | 'excessive_permissions' | 'inactive_admin' | 'shared_account';
  severity: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  description: string;
  recommendations: string[];
  affectedPlatforms: string[];
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  detectedAt: Date;
  lastChecked: Date;
  metadata: {
    adminRoles?: string[];
    lastActivity?: Date;
    permissions?: string[];
    suspensionReason?: string;
    accountAge?: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SecurityRiskSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  platform: {
    type: String,
    enum: ['google-workspace', 'github', 'slack', 'zoom', 'aws'],
    required: true
  },
  riskType: {
    type: String,
    enum: ['admin_without_2fa', 'suspended_with_access', 'excessive_permissions', 'inactive_admin', 'shared_account'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  description: {
    type: String,
    required: true
  },
  recommendations: [{
    type: String
  }],
  affectedPlatforms: [{
    type: String
  }],
  isResolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: String
  },
  detectedAt: {
    type: Date,
    default: Date.now
  },
  lastChecked: {
    type: Date,
    default: Date.now
  },
  metadata: {
    adminRoles: [{ type: String }],
    lastActivity: { type: Date },
    permissions: [{ type: String }],
    suspensionReason: { type: String },
    accountAge: { type: Number }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'security_risks'
});

// Risk assessment indexes
SecurityRiskSchema.index({ companyId: 1, riskType: 1, severity: 1 });
SecurityRiskSchema.index({ companyId: 1, platform: 1, riskScore: -1 });
SecurityRiskSchema.index({ companyId: 1, userId: 1, isResolved: 1 });
SecurityRiskSchema.index({ companyId: 1, userEmail: 1 });
SecurityRiskSchema.index({ companyId: 1, detectedAt: -1 });
SecurityRiskSchema.index({ companyId: 1, isResolved: 1, severity: 1 });

// Performance indexes for dashboard queries
SecurityRiskSchema.index({ companyId: 1, isActive: 1, isResolved: 1 });
SecurityRiskSchema.index({ companyId: 1, riskScore: -1, isResolved: 1 });

// Compound indexes for complex queries
SecurityRiskSchema.index({ 
  companyId: 1, 
  platform: 1, 
  isResolved: 1, 
  severity: 1 
});

SecurityRiskSchema.index({ 
  companyId: 1, 
  riskType: 1, 
  isResolved: 1, 
  detectedAt: -1 
});

export const SecurityRisk = mongoose.model<ISecurityRisk>('SecurityRisk', SecurityRiskSchema);
