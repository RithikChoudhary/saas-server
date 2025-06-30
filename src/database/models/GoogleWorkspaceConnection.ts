import mongoose, { Schema, Document } from 'mongoose';

export interface IGoogleWorkspaceConnection extends Document {
  companyId: mongoose.Types.ObjectId;
  domain: string;
  customerID: string;
  organizationName: string;
  accessToken: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  refreshToken: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  scope: string[];
  connectionType: 'oauth' | 'service_account';
  isActive: boolean;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleWorkspaceConnectionSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  domain: {
    type: String,
    required: true
  },
  customerID: {
    type: String,
    required: true
  },
  organizationName: {
    type: String,
    required: true
  },
  accessToken: {
    encrypted: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true }
  },
  refreshToken: {
    encrypted: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true }
  },
  scope: [{
    type: String
  }],
  connectionType: {
    type: String,
    enum: ['oauth', 'service_account'],
    default: 'oauth'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSync: Date
}, {
  timestamps: true,
  collection: 'google_workspace_connections'
});

// Indexes
GoogleWorkspaceConnectionSchema.index({ companyId: 1, domain: 1 }, { unique: true });
GoogleWorkspaceConnectionSchema.index({ companyId: 1, isActive: 1 });
GoogleWorkspaceConnectionSchema.index({ domain: 1 });

export const GoogleWorkspaceConnection = mongoose.model<IGoogleWorkspaceConnection>('GoogleWorkspaceConnection', GoogleWorkspaceConnectionSchema);
