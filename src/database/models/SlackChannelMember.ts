import mongoose, { Schema, Document } from 'mongoose';

export interface ISlackChannelMember extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  channelId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  isAdmin: boolean;
  joinedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SlackChannelMemberSchema: Schema = new Schema({
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
  channelId: {
    type: Schema.Types.ObjectId,
    ref: 'SlackChannel',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'SlackUser',
    required: true,
    index: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  joinedAt: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'slack_channel_members'
});

// Indexes
SlackChannelMemberSchema.index({ companyId: 1, channelId: 1, userId: 1 }, { unique: true });
SlackChannelMemberSchema.index({ companyId: 1, connectionId: 1 });
SlackChannelMemberSchema.index({ companyId: 1, isActive: 1 });
SlackChannelMemberSchema.index({ channelId: 1, isAdmin: 1 });

export const SlackChannelMember = mongoose.model<ISlackChannelMember>('SlackChannelMember', SlackChannelMemberSchema);
