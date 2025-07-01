import mongoose, { Schema, Document } from 'mongoose';

export interface IGoogleWorkspaceGroup extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  googleGroupId: string;
  email: string;
  name: string;
  description?: string;
  directMembersCount: number;
  adminCreated: boolean;
  aliases: string[];
  nonEditableAliases: string[];
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleWorkspaceGroupSchema: Schema = new Schema({
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
  googleGroupId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  directMembersCount: {
    type: Number,
    default: 0
  },
  adminCreated: {
    type: Boolean,
    default: false
  },
  aliases: [{
    type: String
  }],
  nonEditableAliases: [{
    type: String
  }],
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
  collection: 'google_workspace_groups'
});

// Indexes
GoogleWorkspaceGroupSchema.index({ companyId: 1, googleGroupId: 1 }, { unique: true });
GoogleWorkspaceGroupSchema.index({ companyId: 1, connectionId: 1 });
GoogleWorkspaceGroupSchema.index({ companyId: 1, email: 1 }, { unique: true }); // Unique email per company
GoogleWorkspaceGroupSchema.index({ companyId: 1, isActive: 1 });
GoogleWorkspaceGroupSchema.index({ companyId: 1, directMembersCount: 1 });
GoogleWorkspaceGroupSchema.index({ companyId: 1, adminCreated: 1 });

export const GoogleWorkspaceGroup = mongoose.model<IGoogleWorkspaceGroup>('GoogleWorkspaceGroup', GoogleWorkspaceGroupSchema);
