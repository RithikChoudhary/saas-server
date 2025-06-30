import mongoose, { Schema, Document } from 'mongoose';

export interface ISlackWorkspace extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  slackId: string;
  name: string;
  domain: string;
  emailDomain?: string;
  icon?: {
    image_34?: string;
    image_44?: string;
    image_68?: string;
    image_88?: string;
    image_102?: string;
    image_132?: string;
  };
  enterpriseId?: string;
  enterpriseName?: string;
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SlackWorkspaceSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  connectionId: {
    type: Schema.Types.ObjectId,
    ref: 'SlackConnection',
    required: true,
    index: true
  },
  slackId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  domain: {
    type: String,
    required: true
  },
  emailDomain: String,
  icon: {
    image_34: String,
    image_44: String,
    image_68: String,
    image_88: String,
    image_102: String,
    image_132: String
  },
  enterpriseId: String,
  enterpriseName: String,
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
  collection: 'slack_workspaces'
});

// Indexes
SlackWorkspaceSchema.index({ companyId: 1, slackId: 1 }, { unique: true });
SlackWorkspaceSchema.index({ companyId: 1, connectionId: 1 });
SlackWorkspaceSchema.index({ companyId: 1, isActive: 1 });

export const SlackWorkspace = mongoose.model<ISlackWorkspace>('SlackWorkspace', SlackWorkspaceSchema);
