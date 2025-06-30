import mongoose, { Schema, Document } from 'mongoose';

export interface IGoogleWorkspaceUsageStats extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  date: Date;
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  archivedUsers: number;
  adminUsers: number;
  superAdminUsers: number;
  users2svEnrolled: number;
  users2svEnforced: number;
  totalGroups: number;
  totalOrgUnits: number;
  totalSharedDrives: number;
  totalStorageUsed: number; // in bytes
  totalStorageQuota: number; // in bytes
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleWorkspaceUsageStatsSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  connectionId: {
    type: Schema.Types.ObjectId,
    ref: 'GoogleWorkspaceConnection',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  totalUsers: {
    type: Number,
    default: 0
  },
  activeUsers: {
    type: Number,
    default: 0
  },
  suspendedUsers: {
    type: Number,
    default: 0
  },
  archivedUsers: {
    type: Number,
    default: 0
  },
  adminUsers: {
    type: Number,
    default: 0
  },
  superAdminUsers: {
    type: Number,
    default: 0
  },
  users2svEnrolled: {
    type: Number,
    default: 0
  },
  users2svEnforced: {
    type: Number,
    default: 0
  },
  totalGroups: {
    type: Number,
    default: 0
  },
  totalOrgUnits: {
    type: Number,
    default: 0
  },
  totalSharedDrives: {
    type: Number,
    default: 0
  },
  totalStorageUsed: {
    type: Number,
    default: 0
  },
  totalStorageQuota: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'google_workspace_usage_stats'
});

// Indexes
GoogleWorkspaceUsageStatsSchema.index({ companyId: 1, connectionId: 1, date: 1 }, { unique: true });
GoogleWorkspaceUsageStatsSchema.index({ companyId: 1, date: 1 });
GoogleWorkspaceUsageStatsSchema.index({ companyId: 1, isActive: 1 });

export const GoogleWorkspaceUsageStats = mongoose.model<IGoogleWorkspaceUsageStats>('GoogleWorkspaceUsageStats', GoogleWorkspaceUsageStatsSchema);
