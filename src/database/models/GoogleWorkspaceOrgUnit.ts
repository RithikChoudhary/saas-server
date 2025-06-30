import mongoose, { Schema, Document } from 'mongoose';

export interface IGoogleWorkspaceOrgUnit extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  googleOrgUnitId: string;
  name: string;
  description?: string;
  orgUnitPath: string;
  parentOrgUnitPath?: string;
  parentOrgUnitId?: string;
  blockInheritance: boolean;
  etag: string;
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleWorkspaceOrgUnitSchema: Schema = new Schema({
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
  googleOrgUnitId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  orgUnitPath: {
    type: String,
    required: true
  },
  parentOrgUnitPath: String,
  parentOrgUnitId: String,
  blockInheritance: {
    type: Boolean,
    default: false
  },
  etag: {
    type: String,
    required: true
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
  collection: 'google_workspace_org_units'
});

// Indexes
GoogleWorkspaceOrgUnitSchema.index({ companyId: 1, googleOrgUnitId: 1 }, { unique: true });
GoogleWorkspaceOrgUnitSchema.index({ companyId: 1, connectionId: 1 });
GoogleWorkspaceOrgUnitSchema.index({ companyId: 1, orgUnitPath: 1 });
GoogleWorkspaceOrgUnitSchema.index({ companyId: 1, parentOrgUnitPath: 1 });
GoogleWorkspaceOrgUnitSchema.index({ companyId: 1, isActive: 1 });
GoogleWorkspaceOrgUnitSchema.index({ orgUnitPath: 1 });

export const GoogleWorkspaceOrgUnit = mongoose.model<IGoogleWorkspaceOrgUnit>('GoogleWorkspaceOrgUnit', GoogleWorkspaceOrgUnitSchema);
