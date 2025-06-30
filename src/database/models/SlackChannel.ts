import mongoose, { Schema, Document } from 'mongoose';

export interface ISlackChannel extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  slackId: string;
  name: string;
  purpose?: string;
  topic?: string;
  isChannel: boolean;
  isGroup: boolean;
  isIm: boolean;
  isMpim: boolean;
  isPrivate: boolean;
  isArchived: boolean;
  isGeneral: boolean;
  isShared: boolean;
  isExtShared: boolean;
  isOrgShared: boolean;
  creator?: string;
  created: Date;
  numMembers?: number;
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SlackChannelSchema: Schema = new Schema({
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
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'SlackWorkspace',
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
  purpose: String,
  topic: String,
  isChannel: {
    type: Boolean,
    default: false
  },
  isGroup: {
    type: Boolean,
    default: false
  },
  isIm: {
    type: Boolean,
    default: false
  },
  isMpim: {
    type: Boolean,
    default: false
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isGeneral: {
    type: Boolean,
    default: false
  },
  isShared: {
    type: Boolean,
    default: false
  },
  isExtShared: {
    type: Boolean,
    default: false
  },
  isOrgShared: {
    type: Boolean,
    default: false
  },
  creator: String,
  created: {
    type: Date,
    required: true
  },
  numMembers: {
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
  collection: 'slack_channels'
});

// Indexes
SlackChannelSchema.index({ companyId: 1, slackId: 1 }, { unique: true });
SlackChannelSchema.index({ companyId: 1, connectionId: 1 });
SlackChannelSchema.index({ companyId: 1, workspaceId: 1 });
SlackChannelSchema.index({ companyId: 1, isActive: 1 });
SlackChannelSchema.index({ companyId: 1, isPrivate: 1 });
SlackChannelSchema.index({ companyId: 1, isArchived: 1 });

export const SlackChannel = mongoose.model<ISlackChannel>('SlackChannel', SlackChannelSchema);
