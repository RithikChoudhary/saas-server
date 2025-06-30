import mongoose, { Schema, Document } from 'mongoose';

export interface IGoogleWorkspaceUser extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  googleUserId: string;
  primaryEmail: string;
  firstName: string;
  lastName: string;
  fullName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isDelegatedAdmin: boolean;
  suspended: boolean;
  archived: boolean;
  changePasswordAtNextLogin: boolean;
  ipWhitelisted: boolean;
  orgUnitPath: string;
  lastLoginTime?: Date;
  creationTime: Date;
  deletionTime?: Date;
  suspensionReason?: string;
  // Profile fields
  jobTitle?: string;
  department?: string;
  location?: string;
  phoneNumber?: string;
  recoveryEmail?: string;
  recoveryPhone?: string;
  // Security
  isEnforcedIn2Sv: boolean;
  isEnrolledIn2Sv: boolean;
  agreedToTerms: boolean;
  // Storage
  quotaUsed: number; // in bytes
  quotaLimit: number; // in bytes
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleWorkspaceUserSchema: Schema = new Schema({
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
  googleUserId: {
    type: String,
    required: true,
    unique: true
  },
  primaryEmail: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  isDelegatedAdmin: {
    type: Boolean,
    default: false
  },
  suspended: {
    type: Boolean,
    default: false
  },
  archived: {
    type: Boolean,
    default: false
  },
  changePasswordAtNextLogin: {
    type: Boolean,
    default: false
  },
  ipWhitelisted: {
    type: Boolean,
    default: false
  },
  orgUnitPath: {
    type: String,
    required: true
  },
  lastLoginTime: Date,
  creationTime: {
    type: Date,
    required: true
  },
  deletionTime: Date,
  suspensionReason: String,
  // Profile fields
  jobTitle: String,
  department: String,
  location: String,
  phoneNumber: String,
  recoveryEmail: String,
  recoveryPhone: String,
  // Security
  isEnforcedIn2Sv: {
    type: Boolean,
    default: false
  },
  isEnrolledIn2Sv: {
    type: Boolean,
    default: false
  },
  agreedToTerms: {
    type: Boolean,
    default: false
  },
  // Storage
  quotaUsed: {
    type: Number,
    default: 0
  },
  quotaLimit: {
    type: Number,
    default: 0
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
  collection: 'google_workspace_users'
});

// Indexes
GoogleWorkspaceUserSchema.index({ companyId: 1, googleUserId: 1 }, { unique: true });
GoogleWorkspaceUserSchema.index({ companyId: 1, connectionId: 1 });
GoogleWorkspaceUserSchema.index({ companyId: 1, primaryEmail: 1 });
GoogleWorkspaceUserSchema.index({ companyId: 1, isActive: 1 });
GoogleWorkspaceUserSchema.index({ companyId: 1, suspended: 1 });
GoogleWorkspaceUserSchema.index({ companyId: 1, archived: 1 });
GoogleWorkspaceUserSchema.index({ companyId: 1, isAdmin: 1 });
GoogleWorkspaceUserSchema.index({ companyId: 1, isSuperAdmin: 1 });
GoogleWorkspaceUserSchema.index({ companyId: 1, lastLoginTime: 1 });
GoogleWorkspaceUserSchema.index({ companyId: 1, orgUnitPath: 1 });
GoogleWorkspaceUserSchema.index({ companyId: 1, isEnrolledIn2Sv: 1 });
GoogleWorkspaceUserSchema.index({ primaryEmail: 1 });

export const GoogleWorkspaceUser = mongoose.model<IGoogleWorkspaceUser>('GoogleWorkspaceUser', GoogleWorkspaceUserSchema);
