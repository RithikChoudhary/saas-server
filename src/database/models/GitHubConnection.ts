import mongoose, { Schema, Document } from 'mongoose';

export interface IGitHubConnection extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionType: 'oauth' | 'personal-access-token';
  scope: 'user' | 'organization';
  organizationName?: string;
  username?: string;
  credentialSetName?: string;
  accessToken: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  refreshToken?: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  tokenExpiresAt?: Date;
  webhookSecret?: string;
  permissions: string[];
  status: 'connected' | 'error' | 'expired';
  lastSync?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GitHubConnectionSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  connectionType: {
    type: String,
    enum: ['oauth', 'personal-access-token'],
    required: true
  },
  scope: {
    type: String,
    enum: ['user', 'organization'],
    required: true
  },
  organizationName: {
    type: String,
    sparse: true
  },
  username: {
    type: String,
    sparse: true
  },
  credentialSetName: {
    type: String,
    sparse: true
  },
  accessToken: {
    encrypted: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true }
  },
  refreshToken: {
    encrypted: String,
    iv: String,
    authTag: String
  },
  tokenExpiresAt: Date,
  webhookSecret: String,
  permissions: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['connected', 'error', 'expired'],
    default: 'connected'
  },
  lastSync: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'github_connections'
});

// Indexes
GitHubConnectionSchema.index({ companyId: 1, organizationName: 1 });
GitHubConnectionSchema.index({ companyId: 1, username: 1 });
GitHubConnectionSchema.index({ companyId: 1, status: 1 });

export const GitHubConnection = mongoose.model<IGitHubConnection>('GitHubConnection', GitHubConnectionSchema);
