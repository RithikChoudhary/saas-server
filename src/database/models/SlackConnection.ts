import mongoose, { Schema, Document } from 'mongoose';

export interface ISlackConnection extends Document {
  companyId: mongoose.Types.ObjectId;
  workspaceId: string;
  workspaceName: string;
  workspaceDomain: string;
  teamId: string;
  teamName?: string;
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
  botToken?: {
    encrypted: string;
    iv: string;
    authTag: string;
  };
  scope: string[];
  connectionType: 'oauth' | 'bot';
  status?: 'connected' | 'disconnected' | 'error';
  isActive: boolean;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SlackConnectionSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  workspaceId: {
    type: String,
    required: true
  },
  workspaceName: {
    type: String,
    required: true
  },
  workspaceDomain: {
    type: String,
    required: true
  },
  teamId: {
    type: String,
    required: true
  },
  teamName: {
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
  botToken: {
    encrypted: String,
    iv: String,
    authTag: String
  },
  scope: [{
    type: String
  }],
  connectionType: {
    type: String,
    enum: ['oauth', 'bot'],
    required: true
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'error'],
    default: 'connected'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSync: Date
}, {
  timestamps: true,
  collection: 'slack_connections'
});

// Indexes
SlackConnectionSchema.index({ companyId: 1, workspaceId: 1 }, { unique: true });
SlackConnectionSchema.index({ companyId: 1, teamId: 1 });
SlackConnectionSchema.index({ companyId: 1, isActive: 1 });

export const SlackConnection = mongoose.model<ISlackConnection>('SlackConnection', SlackConnectionSchema);
