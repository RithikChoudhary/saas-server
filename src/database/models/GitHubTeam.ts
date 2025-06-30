import mongoose, { Schema, Document } from 'mongoose';

export interface IGitHubTeam extends Document {
  companyId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  githubId: number;
  nodeId: string;
  slug: string;
  name: string;
  description?: string;
  privacy: 'closed' | 'secret';
  permission: string;
  membersCount: number;
  reposCount: number;
  organization: string;
  parentTeamId?: number;
  createdAt: Date;
  updatedAt: Date;
  lastSync: Date;
  isActive: boolean;
}

const GitHubTeamSchema: Schema = new Schema({
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  connectionId: {
    type: Schema.Types.ObjectId,
    ref: 'GitHubConnection',
    required: true,
    index: true
  },
  githubId: {
    type: Number,
    required: true,
    index: true
  },
  nodeId: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  privacy: {
    type: String,
    enum: ['closed', 'secret'],
    default: 'closed'
  },
  permission: {
    type: String,
    default: 'pull'
  },
  membersCount: {
    type: Number,
    default: 0
  },
  reposCount: {
    type: Number,
    default: 0
  },
  organization: {
    type: String,
    required: true,
    index: true
  },
  parentTeamId: Number,
  lastSync: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'github_teams'
});

// Compound indexes
GitHubTeamSchema.index({ companyId: 1, githubId: 1 }, { unique: true });
GitHubTeamSchema.index({ companyId: 1, organization: 1, slug: 1 });
GitHubTeamSchema.index({ companyId: 1, isActive: 1 });

export const GitHubTeam = mongoose.model<IGitHubTeam>('GitHubTeam', GitHubTeamSchema);
