import mongoose, { Schema, Document } from 'mongoose';

export interface ISlackUser extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  workspaceId?: mongoose.Types.ObjectId;
  slackId: string;
  teamId?: string;
  name: string;
  realName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  statusText?: string;
  statusEmoji?: string;
  avatar?: string;
  isBot: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isPrimaryOwner: boolean;
  isRestricted: boolean;
  isUltraRestricted: boolean;
  isDeleted: boolean;
  isAppUser?: boolean;
  has2FA?: boolean;
  timezone?: string;
  timezoneLabel?: string;
  timezoneOffset?: number;
  lastActiveAt?: Date;
  isActive: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SlackUserSchema: Schema = new Schema({
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
    index: true
  },
  slackId: {
    type: String,
    required: true,
    unique: true
  },
  teamId: String,
  name: {
    type: String,
    required: true
  },
  realName: String,
  displayName: String,
  email: String,
  phone: String,
  title: String,
  department: String,
  statusText: String,
  statusEmoji: String,
  avatar: String,
  isBot: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isOwner: {
    type: Boolean,
    default: false
  },
  isPrimaryOwner: {
    type: Boolean,
    default: false
  },
  isRestricted: {
    type: Boolean,
    default: false
  },
  isUltraRestricted: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isAppUser: {
    type: Boolean,
    default: false
  },
  has2FA: {
    type: Boolean,
    default: false
  },
  timezone: String,
  timezoneLabel: String,
  timezoneOffset: Number,
  lastActiveAt: Date,
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
  collection: 'slack_users'
});

// Indexes
SlackUserSchema.index({ companyId: 1, slackId: 1 }, { unique: true });
SlackUserSchema.index({ companyId: 1, connectionId: 1 });
SlackUserSchema.index({ companyId: 1, workspaceId: 1 });
SlackUserSchema.index({ companyId: 1, isActive: 1 });
SlackUserSchema.index({ companyId: 1, isBot: 1 });
SlackUserSchema.index({ companyId: 1, isAdmin: 1 });
SlackUserSchema.index({ companyId: 1, isDeleted: 1 });
SlackUserSchema.index({ email: 1 });

export const SlackUser = mongoose.model<ISlackUser>('SlackUser', SlackUserSchema);
